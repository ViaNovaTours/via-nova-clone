import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  return jsonResponse({
    success: false,
    error:
      "fetch-woocommerce-orders is a project-specific integration. Implement your WooCommerce sync logic in this function.",
    total_new_orders: 0,
    status_updates: 0,
    merged_duplicates: 0,
    errors: [],
  });
});

