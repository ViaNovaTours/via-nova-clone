import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { getConnectorAccessToken } from "../_shared/connectors.ts";

type UploadPayload = {
  fileData?: string;
  fileName?: string;
  fileType?: string;
  tourName?: string;
  orderId?: string;
  firstName?: string;
  lastName?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-user-jwt, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const receiptsFolderEnv = Deno.env.get("GOOGLE_DRIVE_RECEIPTS_FOLDER_ID") ?? "";

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const safeFilePart = (value: string) =>
  value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const escapeQueryValue = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

const parseGoogleDriveFolderId = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const urlMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/i);
  if (urlMatch?.[1]) {
    return urlMatch[1];
  }
  return trimmed;
};

const extractOrderNumber = (orderId: string, fileName: string) => {
  const byLabel = orderId.match(/order[\s#:-]*([a-z0-9-]+)/i);
  if (byLabel?.[1]) return byLabel[1];

  const bySuffix = orderId.match(/(?:^|[-_])(\d+)(?:$|[^0-9])/);
  if (bySuffix?.[1]) return bySuffix[1];

  const byFileName = fileName.match(/order[\s#_-]*(\d+)/i);
  if (byFileName?.[1]) return byFileName[1];

  return safeFilePart(orderId) || "UNKNOWN";
};

const getExtension = (fileName: string, fileType: string) => {
  const name = fileName.trim();
  const index = name.lastIndexOf(".");
  if (index > -1 && index < name.length - 1) {
    return `.${name.slice(index + 1).toLowerCase()}`;
  }
  if (fileType.toLowerCase().includes("pdf")) {
    return ".pdf";
  }
  return "";
};

const driveRequest = async (
  url: string,
  accessToken: string,
  init: RequestInit = {}
) => {
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${accessToken}`);
  const response = await fetch(url, {
    ...init,
    headers,
  });
  return response;
};

const ensureTourFolder = async (
  accessToken: string,
  rootFolderId: string,
  tourName: string
) => {
  const escapedTourName = escapeQueryValue(tourName);
  const query =
    `name='${escapedTourName}' and ` +
    `'${rootFolderId}' in parents and ` +
    "mimeType='application/vnd.google-apps.folder' and trashed=false";

  const searchUrl =
    "https://www.googleapis.com/drive/v3/files?" +
    new URLSearchParams({
      q: query,
      fields: "files(id,name)",
      orderBy: "createdTime desc",
      pageSize: "1",
    }).toString();

  const searchResponse = await driveRequest(searchUrl, accessToken);
  if (!searchResponse.ok) {
    const details = await searchResponse.text();
    throw new Error(`Failed searching Google Drive tour folder: ${details}`);
  }

  const searchData = await searchResponse.json();
  const existingFolderId = searchData?.files?.[0]?.id;
  if (existingFolderId) {
    return existingFolderId;
  }

  const createResponse = await driveRequest(
    "https://www.googleapis.com/drive/v3/files?fields=id,name",
    accessToken,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: tourName,
        mimeType: "application/vnd.google-apps.folder",
        parents: [rootFolderId],
      }),
    }
  );

  if (!createResponse.ok) {
    const details = await createResponse.text();
    throw new Error(`Failed creating Google Drive tour folder: ${details}`);
  }

  const created = await createResponse.json();
  if (!created?.id) {
    throw new Error("Google Drive did not return a folder id.");
  }
  return created.id as string;
};

const getRequestToken = (req: Request) => {
  const fromUserJwt = req.headers.get("x-user-jwt");
  if (fromUserJwt) {
    return fromUserJwt.replace(/^Bearer\s+/i, "").trim();
  }

  const authorization = req.headers.get("authorization") || "";
  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }
  return token.trim();
};

const requireAuthenticated = async (req: Request) => {
  const token = getRequestToken(req);
  if (!token) {
    return {
      ok: false as const,
      response: jsonResponse({ success: false, error: "Unauthorized" }, 401),
    };
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return {
      ok: false as const,
      response: jsonResponse({ success: false, error: "Unauthorized" }, 401),
    };
  }

  return { ok: true as const, context: { user: data.user } };
};

const decodeBase64 = (value: string) => {
  const cleanValue = value.includes(",") ? value.split(",").pop() || "" : value;
  const decoded = atob(cleanValue);
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }
  return bytes;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      { success: false, error: "Missing Supabase service role configuration" },
      500
    );
  }

  const auth = await requireAuthenticated(req);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const payload = (await req.json()) as UploadPayload;

    if (!payload.fileData || !payload.fileName || !payload.tourName) {
      return jsonResponse(
        {
          success: false,
          error: "fileData, fileName, and tourName are required",
        },
        400
      );
    }

    const receiptsFolderId = parseGoogleDriveFolderId(receiptsFolderEnv);
    if (!receiptsFolderId) {
      return jsonResponse(
        {
          success: false,
          error: "GOOGLE_DRIVE_RECEIPTS_FOLDER_ID is not configured.",
        },
        500
      );
    }

    const accessToken = await getConnectorAccessToken("googledrive");
    const fileBytes = decodeBase64(payload.fileData);
    const tourName = safeFilePart(payload.tourName);
    const firstName = safeFilePart(payload.firstName || "");
    const lastName = safeFilePart(payload.lastName || "");
    const fullName = `${firstName} ${lastName}`.trim() || "Customer";
    const orderId = payload.orderId || "UNKNOWN";
    const orderNumber = extractOrderNumber(orderId, payload.fileName);
    const extension = getExtension(payload.fileName, payload.fileType || "");
    const finalFileName = `${fullName} - ${tourName} - ORDER ${orderNumber}${extension || ".pdf"}`;

    const tourFolderId = await ensureTourFolder(
      accessToken,
      receiptsFolderId,
      tourName
    );

    const metadataResponse = await driveRequest(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,webViewLink,webContentLink",
      accessToken,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Upload-Content-Type": payload.fileType || "application/pdf",
          "X-Upload-Content-Length": String(fileBytes.byteLength),
        },
        body: JSON.stringify({
          name: finalFileName,
          parents: [tourFolderId],
        }),
      }
    );

    if (!metadataResponse.ok) {
      const details = await metadataResponse.text();
      return jsonResponse(
        {
          success: false,
          error: `Failed to initiate Google Drive upload: ${details}`,
        },
        500
      );
    }

    const uploadUrl = metadataResponse.headers.get("location");
    if (!uploadUrl) {
      return jsonResponse(
        {
          success: false,
          error: "Google Drive did not return an upload URL.",
        },
        500
      );
    }

    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": payload.fileType || "application/pdf",
      },
      body: fileBytes,
    });

    if (!uploadResponse.ok) {
      const details = await uploadResponse.text();
      return jsonResponse(
        {
          success: false,
          error: `Failed to upload file to Google Drive: ${details}`,
        },
        500
      );
    }

    const uploaded = await uploadResponse.json();
    const fileId = uploaded?.id;
    if (!fileId) {
      return jsonResponse(
        {
          success: false,
          error: "Google Drive upload succeeded but no file id was returned.",
        },
        500
      );
    }

    const fileUrl = uploaded?.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;

    return jsonResponse({
      success: true,
      fileId,
      fileUrl,
      fileName: finalFileName,
      tourFolder: tourName,
      tourFolderId,
    });
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown upload error",
      },
      500
    );
  }
});

