import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

if (!supabaseUrl || !serviceRoleKey) {
  console.warn(
    "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing for edge functions."
  );
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

export const supabaseAnon = anonKey
  ? createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
    })
  : null;

export const assertSupabaseEnv = () => {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase configuration. Expected SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
};

