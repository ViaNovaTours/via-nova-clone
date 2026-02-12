import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  return jsonResponse({
    success: true,
    threads: [],
    error:
      "fetch-gmail-threads is not implemented yet for Supabase. Connect Gmail API in this function.",
  });
});

