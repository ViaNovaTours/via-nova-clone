import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/deployment-config";

const hasCredentials = Boolean(env.supabaseUrl && env.supabaseAnonKey);

export const supabase = hasCredentials
  ? createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export const hasSupabaseConfig = hasCredentials;

export const getSupabaseClient = () => {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
    );
  }
  return supabase;
};

