import { base44 } from "@/api/base44Client";

export async function uploadToGoogleDrive(payload = {}) {
  return base44.functions.invoke("uploadToGoogleDrive", payload);
}

