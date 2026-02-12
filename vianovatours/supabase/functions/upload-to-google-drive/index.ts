import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

type UploadPayload = {
  fileData?: string;
  fileName?: string;
  fileType?: string;
  tourName?: string;
  orderId?: string;
  firstName?: string;
  lastName?: string;
};

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

const decodeBase64 = (value: string) => {
  const decoded = atob(value);
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

