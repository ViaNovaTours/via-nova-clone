import { base44 } from "@/api/base44Client";

export async function fixCompleteStatus(payload = {}) {
  return base44.functions.invoke("fixCompleteStatus", payload);
}

