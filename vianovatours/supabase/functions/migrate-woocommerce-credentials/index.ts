import { requireAdmin } from "../_shared/auth.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { LEGACY_WOOCOMMERCE_SITES } from "../_shared/woo.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const admin = await requireAdmin(req);
  if (!admin.ok) {
    return admin.response;
  }

  try {
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const site of LEGACY_WOOCOMMERCE_SITES) {
      const consumerKey = Deno.env.get(site.key_env);
      const consumerSecret = Deno.env.get(site.secret_env);

      if (!consumerKey || !consumerSecret) {
        skipped += 1;
        continue;
      }

      const { data: existing, error: existingError } = await supabaseAdmin
        .from("woo_commerce_credentials")
        .select("id")
        .eq("site_name", site.site_name)
        .maybeSingle();

      if (existingError) {
        errors.push(
          `${site.site_name}: failed to check existing credentials (${existingError.message})`
        );
        continue;
      }

      if (existing?.id) {
        skipped += 1;
        continue;
      }

      const { error: insertError } = await supabaseAdmin
        .from("woo_commerce_credentials")
        .insert({
          site_name: site.site_name,
          tour_name: site.tour_name,
          website_url: site.website_url,
          api_url: site.api_url,
          consumer_key: consumerKey,
          consumer_secret: consumerSecret,
          profit_margin: site.profit_margin,
          is_active: true,
        });

      if (insertError) {
        errors.push(
          `${site.site_name}: failed to insert credentials (${insertError.message})`
        );
      } else {
        imported += 1;
      }
    }

    return jsonResponse({
      success: true,
      imported,
      skipped,
      total_sites: LEGACY_WOOCOMMERCE_SITES.length,
      errors: errors.length ? errors : null,
      message:
        imported > 0
          ? `Successfully migrated ${imported} WooCommerce site credentials.`
          : "No credentials were migrated (already present or missing env values).",
    });
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown WooCommerce migration error",
      },
      500
    );
  }
});

