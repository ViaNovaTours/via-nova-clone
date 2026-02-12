import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  return jsonResponse({
    success: false,
    error:
      "calculate-profits-for-all-orders is not implemented yet for Supabase.",
    updated_count: 0,
  });
});

