import { createClient } from "npm:@supabase/supabase-js@2.57.4";

type WooSiteConfig = {
  site_name: string;
  tour_name: string;
  api_url: string;
  website_url: string;
  consumer_key: string;
  consumer_secret: string;
  timezone: string | null;
  official_site_url: string | null;
  profit_margin: number | null;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-wc-webhook-signature",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const mapWooStatusToInternal = (wooStatus: string) => {
  const statusMap: Record<string, string> = {
    pending: "pending",
    processing: "unprocessed",
    "on-hold": "on-hold",
    completed: "completed",
    cancelled: "cancelled",
    refunded: "refunded",
    failed: "failed",
    "pending-payment": "pending-payment",
  };
  return statusMap[wooStatus] || "unprocessed";
};

const extractPaymentMethod = (wooOrder: any) => {
  const method = wooOrder?.payment_method || "";
  const title = String(wooOrder?.payment_method_title || "").toLowerCase();

  if (title.includes("airwallex")) return "airwallex";
  if (title.includes("stripe")) return "stripe";
  if (title.includes("paypal")) return "paypal";

  if (method.includes("airwallex")) return "airwallex";
  if (method.includes("stripe") || method.includes("card")) return "stripe";
  if (method.includes("paypal")) return "paypal";
  return method || null;
};

const extractPaymentData = (wooOrder: any) => {
  const paymentStatus = wooOrder?.status;
  const mappedStatus =
    paymentStatus === "completed"
      ? { payment_status: "succeeded", payment_captured: true }
      : paymentStatus === "processing"
      ? { payment_status: "processing", payment_captured: true }
      : paymentStatus === "pending"
      ? { payment_status: "pending", payment_captured: false }
      : paymentStatus === "failed"
      ? { payment_status: "failed", payment_captured: false }
      : paymentStatus === "cancelled"
      ? { payment_status: "canceled", payment_captured: false }
      : paymentStatus === "refunded"
      ? { payment_status: "refunded", payment_captured: true }
      : { payment_status: null, payment_captured: null };

  return {
    payment_method: extractPaymentMethod(wooOrder),
    payment_transaction_id: wooOrder?.transaction_id || null,
    ...mappedStatus,
  };
};

const extractTourDate = (wooOrder: any) => {
  for (const item of wooOrder?.line_items || []) {
    const dateMeta = (item?.meta_data || []).find(
      (meta: any) => String(meta?.key || "").toLowerCase() === "date"
    );
    if (dateMeta?.value) {
      const parsed = new Date(dateMeta.value);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString().split("T")[0];
      }
    }
  }
  if (wooOrder?.date_created) {
    return new Date(wooOrder.date_created).toISOString().split("T")[0];
  }
  return new Date().toISOString().split("T")[0];
};

const extractTourTime = (wooOrder: any) => {
  for (const item of wooOrder?.line_items || []) {
    const timeMeta = (item?.meta_data || []).find(
      (meta: any) => String(meta?.key || "").toLowerCase() === "time"
    );
    if (timeMeta?.value) {
      const match = String(timeMeta.value).match(
        /(\d{1,2}:\d{2}\s*(?:am|pm))/i
      );
      if (match) return match[0];
    }
  }
  return "";
};

const convertToTimezone = (utcDate: string, timezone: string | null) => {
  if (!timezone) return null;
  try {
    return new Date(utcDate).toLocaleString("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return null;
  }
};

const deriveTicketRows = (wooOrder: any) => {
  return (wooOrder?.line_items || []).map((item: any) => {
    let quantity = item?.quantity || 1;
    let type = String(item?.name || "").trim();

    const endPattern = type.match(/\s+x(\d+)$/i);
    if (endPattern) {
      quantity = Number.parseInt(endPattern[1], 10);
      type = type.replace(/\s+x\d+$/i, "").trim();
    } else {
      const parenPattern = type.match(/\(x(\d+)\)/i);
      if (parenPattern) {
        quantity = Number.parseInt(parenPattern[1], 10);
        type = type.replace(/\s*\(x\d+\)/i, "").trim();
      }
    }

    return {
      type,
      quantity,
      cost_per_ticket: 0,
    };
  });
};

const PROFIT_PER_TICKET_EURO = 11;

const transformWooOrder = (site: WooSiteConfig, wooOrder: any) => {
  const tickets = deriveTicketRows(wooOrder);
  const totalCost = Number.parseFloat(wooOrder?.total || "0") || 0;
  const totalTickets = tickets.reduce(
    (sum: number, item: any) => sum + (item.quantity || 0),
    0
  );
  const customerPaidPerTicket = totalTickets > 0 ? totalCost / totalTickets : 0;
  const agentCostPerTicket = Math.max(
    0,
    customerPaidPerTicket - PROFIT_PER_TICKET_EURO
  );

  const ticketsWithCosts = tickets.map((ticket: any) => ({
    ...ticket,
    cost_per_ticket: agentCostPerTicket,
  }));

  const totalTicketCost = ticketsWithCosts.reduce(
    (sum: number, ticket: any) => sum + ticket.cost_per_ticket * ticket.quantity,
    0
  );

  const payment = extractPaymentData(wooOrder);
  const purchaseDateUtc = wooOrder?.date_created || new Date().toISOString();

  return {
    order_id: `${site.site_name}-${wooOrder.id}`,
    tour: site.tour_name,
    tour_date: extractTourDate(wooOrder),
    tour_time: extractTourTime(wooOrder),
    tour_timezone: site.timezone,
    tickets: ticketsWithCosts,
    extras: [],
    first_name: wooOrder?.billing?.first_name || "",
    last_name: wooOrder?.billing?.last_name || "",
    email: wooOrder?.billing?.email || "",
    phone: wooOrder?.billing?.phone || "",
    address: wooOrder?.billing?.address_1 || "",
    city: wooOrder?.billing?.city || "",
    state_region: wooOrder?.billing?.state || "",
    zip: wooOrder?.billing?.postcode || "",
    country: wooOrder?.billing?.country || "",
    status: mapWooStatusToInternal(wooOrder?.status),
    priority: "normal",
    purchase_date: purchaseDateUtc,
    purchase_date_pst: convertToTimezone(purchaseDateUtc, "America/Los_Angeles"),
    purchase_date_tour_tz: convertToTimezone(purchaseDateUtc, site.timezone),
    purchase_url: site.website_url,
    official_site_url: site.official_site_url,
    fulfilled_by: null,
    venue: `${site.site_name} - Main Location`,
    currency: String(wooOrder?.currency || "USD").toUpperCase(),
    total_cost: totalCost,
    total_ticket_cost: totalTicketCost,
    projected_profit: totalCost - totalTicketCost,
    ...payment,
  };
};

const getWooWebhookSecret = (siteName: string) => {
  const globalSecret = Deno.env.get("WOOCOMMERCE_WEBHOOK_SECRET");
  const normalized = siteName
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .toUpperCase();
  const explicit = Deno.env.get(`WOOCOMMERCE_WEBHOOK_SECRET_${normalized}`);

  return explicit || globalSecret || null;
};

const loadWooSites = async (): Promise<WooSiteConfig[]> => {
  const { data: credentials, error } = await supabaseAdmin
    .from("woo_commerce_credentials")
    .select(
      "site_name,tour_name,api_url,website_url,consumer_key,consumer_secret,is_active,profit_margin"
    )
    .eq("is_active", true);

  if (error || !credentials?.length) {
    return [];
  }

  const { data: tours } = await supabaseAdmin
    .from("tours")
    .select("name,timezone,official_ticketing_url");

  const timezoneByTour = new Map<string, string>();
  const officialUrlByTour = new Map<string, string>();

  (tours || []).forEach((tour: any) => {
    const key = String(tour?.name || "").toLowerCase().trim();
    if (!key) return;
    if (tour?.timezone) timezoneByTour.set(key, String(tour.timezone));
    if (tour?.official_ticketing_url) {
      officialUrlByTour.set(key, String(tour.official_ticketing_url));
    }
  });

  return (credentials || [])
    .filter(
      (row: any) =>
        row?.site_name &&
        row?.tour_name &&
        row?.api_url &&
        row?.website_url &&
        row?.consumer_key &&
        row?.consumer_secret
    )
    .map((row: any) => {
      const key = String(row.tour_name || "").toLowerCase().trim();
      return {
        site_name: row.site_name,
        tour_name: row.tour_name,
        api_url: row.api_url,
        website_url: row.website_url,
        consumer_key: row.consumer_key,
        consumer_secret: row.consumer_secret,
        timezone: timezoneByTour.get(key) || null,
        official_site_url: officialUrlByTour.get(key) || null,
        profit_margin: row.profit_margin ?? null,
      } satisfies WooSiteConfig;
    });
};

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
      if (insertError.code === "23505") {
        return new Response(
          `Order ${externalOrderId} already exists (duplicate webhook ignored).`,
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "text/plain" },
          }
        );
      }
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

