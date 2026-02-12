import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  return jsonResponse({
    success: false,
    error:
      "migrate-woocommerce-credentials requires custom migration logic from your previous backend.",
    message: "No credentials were migrated.",
  });
});

