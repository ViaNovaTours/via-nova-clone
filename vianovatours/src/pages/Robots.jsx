import React, { useEffect } from "react";

export default function Robots() {
  useEffect(() => {
    const hostname = window.location.hostname;
    const configuredFunctionsUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const functionsBaseUrl = configuredFunctionsUrl
      ? configuredFunctionsUrl.replace(/\/$/, "")
      : supabaseUrl
        ? `${supabaseUrl}/functions/v1`
        : `${window.location.origin}/functions/v1`;

    window.location.href = `${functionsBaseUrl}/generate-robots-txt?domain=${encodeURIComponent(
      hostname
    )}`;
  }, []);

  return null;
}