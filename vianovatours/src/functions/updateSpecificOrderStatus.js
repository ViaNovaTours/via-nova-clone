import { base44 } from "@/api/base44Client";

export async function updateSpecificOrderStatus(payload = {}) {
  return base44.functions.invoke("updateSpecificOrderStatus", payload);
}

