import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      { success: false, error: "Missing Supabase service role configuration" },
      500
    );
  }

  const { data: matches, error: queryError } = await supabase
    .from("orders")
    .select("id,status")
    .eq("status", "complete");

  if (queryError) {
    return jsonResponse(
      { success: false, error: queryError.message },
      500
    );
  }

  const ids = (matches || []).map((row) => row.id);
  if (ids.length === 0) {
    return jsonResponse({
      success: true,
      total_fixed: 0,
      message: "No orders with status 'complete' found.",
    });
  }

  const { error: updateError } = await supabase
    .from("orders")
    .update({ status: "completed" })
    .in("id", ids);

  if (updateError) {
    return jsonResponse(
      { success: false, error: updateError.message },
      500
    );
  }

  return jsonResponse({
    success: true,
    total_fixed: ids.length,
    message: "Updated status from complete to completed.",
  });
});

