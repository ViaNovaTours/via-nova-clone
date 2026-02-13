import { createClient } from "npm:@supabase/supabase-js@2.57.4";

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
const storageBucket = Deno.env.get("SUPABASE_TICKETS_BUCKET") || "tickets";

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const safeSegment = (value: string) =>
  value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_");

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

    if (!payload.fileData || !payload.fileName) {
      return jsonResponse(
        {
          success: false,
          error: "fileData and fileName are required",
        },
        400
      );
    }

    const fileBytes = decodeBase64(payload.fileData);
    const fileName = safeSegment(payload.fileName);
    const tourName = safeSegment(payload.tourName || "tour");
    const orderId = safeSegment(payload.orderId || "order");
    const path = `${tourName}/${orderId}/${Date.now()}-${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(storageBucket)
      .upload(path, fileBytes, {
        contentType: payload.fileType || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      return jsonResponse(
        {
          success: false,
          error: uploadError.message,
        },
        500
      );
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(storageBucket).getPublicUrl(path);

    return jsonResponse({
      success: true,
      fileUrl: publicUrl,
      storagePath: path,
      bucket: storageBucket,
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

