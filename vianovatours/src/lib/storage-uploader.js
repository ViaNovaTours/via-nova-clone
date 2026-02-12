import { env } from "@/lib/deployment-config";
import { getSupabaseClient } from "@/lib/supabaseClient";

const safeSegment = (value) =>
  String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_");

export const uploadFileToSupabaseStorage = async (file) => {
  if (!file) {
    throw new Error("No file provided for upload.");
  }

  const client = getSupabaseClient();
  const bucket = env.supabaseStorageBucket;
  const randomPart =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}`;
  const filePath = `${new Date().toISOString().slice(0, 10)}/${randomPart}-${safeSegment(
    file.name
  )}`;

  const { error: uploadError } = await client.storage
    .from(bucket)
    .upload(filePath, file, {
      upsert: false,
      cacheControl: "3600",
      contentType: file.type || undefined,
    });

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  const {
    data: { publicUrl },
  } = client.storage.from(bucket).getPublicUrl(filePath);

  return {
    file_url: publicUrl,
    bucket,
    path: filePath,
  };
};

