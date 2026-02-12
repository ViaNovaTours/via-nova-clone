import { corsHeaders } from "../_shared/cors.ts";
import {
  extractPaymentData,
  getWooWebhookSecret,
  loadWooSites,
  mapWooStatusToInternal,
  transformWooOrder,
} from "../_shared/woo.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";

const hmacSha256Base64 = async (secret: string, payload: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  );

  const bytes = new Uint8Array(signature);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Webhook endpoint active. Awaiting POST data.", {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  }

  try {
    const url = new URL(req.url);
    const siteIdentifier = url.searchParams.get("site");
    if (!siteIdentifier) {
      return new Response("Missing `site` query parameter.", {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    const sites = await loadWooSites();
    const site = sites.find((entry) => entry.site_name === siteIdentifier);
    if (!site) {
      return new Response(`Site identifier '${siteIdentifier}' not found.`, {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    const signature = req.headers.get("x-wc-webhook-signature");
    if (!signature) {
      return new Response("Missing signature header.", {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    const rawBody = await req.text();
    const webhookSecret = getWooWebhookSecret(site.site_name) || site.consumer_secret;
    if (!webhookSecret) {
      return new Response("Webhook secret is not configured.", {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    const digest = await hmacSha256Base64(webhookSecret, rawBody);
    if (digest !== signature) {
      return new Response("Invalid webhook signature.", {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    const wooOrder = JSON.parse(rawBody);
    if (!wooOrder?.id) {
      return new Response("Webhook received, no order payload to process.", {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    const externalOrderId = `${site.site_name}-${wooOrder.id}`;
    const { data: existingOrder, error: existingError } = await supabaseAdmin
      .from("orders")
      .select("id,order_id,status")
      .eq("order_id", externalOrderId)
      .maybeSingle();

    if (existingError) {
      return new Response(
        `Failed loading existing order: ${existingError.message}`,
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "text/plain" },
        }
      );
    }

    if (existingOrder?.id) {
      if (["reserved_date", "awaiting_reply"].includes(existingOrder.status)) {
        return new Response(
          `Order ${externalOrderId} has manual status (${existingOrder.status}); skipping update.`,
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "text/plain" },
          }
        );
      }

      const updates = {
        status: mapWooStatusToInternal(String(wooOrder.status || "")),
        ...extractPaymentData(wooOrder),
      };

      const { error: updateError } = await supabaseAdmin
        .from("orders")
        .update(updates)
        .eq("id", existingOrder.id);

      if (updateError) {
        return new Response(
          `Failed to update order ${externalOrderId}: ${updateError.message}`,
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "text/plain" },
          }
        );
      }

      return new Response(`Order ${externalOrderId} updated successfully.`, {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    const transformedOrder = transformWooOrder(site, wooOrder);
    const { error: insertError } = await supabaseAdmin
      .from("orders")
      .insert(transformedOrder);

    if (insertError) {
      return new Response(
        `Failed to create order ${externalOrderId}: ${insertError.message}`,
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "text/plain" },
        }
      );
    }

    return new Response(`Order ${externalOrderId} created successfully.`, {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  } catch (error) {
    return new Response(
      error instanceof Error ? error.message : "Unknown WooCommerce webhook error",
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      }
    );
  }
});

