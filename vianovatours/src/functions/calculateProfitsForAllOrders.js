import { base44 } from "@/api/base44Client";

export async function calculateProfitsForAllOrders(payload = {}) {
  return base44.functions.invoke("calculateProfitsForAllOrders", payload);
}

