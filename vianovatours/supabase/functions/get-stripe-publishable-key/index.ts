import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const publishableKey = Deno.env.get("STRIPE_PUBLISHABLE_KEY");

  if (!publishableKey) {
    return jsonResponse(
      { success: false, error: "Stripe publishable key not configured" },
      500
    );
  }

  return jsonResponse({
    success: true,
    publishable_key: publishableKey,
  });
});

