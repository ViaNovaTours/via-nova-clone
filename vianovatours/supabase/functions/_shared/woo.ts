import { supabaseAdmin } from "./supabase.ts";

type WooCredentialRow = {
  site_name: string;
  tour_name: string;
  api_url: string;
  website_url: string;
  consumer_key: string;
  consumer_secret: string;
  is_active?: boolean;
  profit_margin?: number;
};

type TourRow = {
  name: string;
  timezone?: string | null;
  official_ticketing_url?: string | null;
};

export type WooSiteConfig = {
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

export const LEGACY_WOOCOMMERCE_SITES = [
  {
    site_name: "AlcatrazTourism",
    tour_name: "Alcatraz Island Tour",
    api_url: "https://alcatraztourism.com/wp-json/wc/v3",
    website_url: "https://alcatraztourism.com",
    key_env: "WOOCOMMERCE_KEY_ALCATRAZ_TOURISM",
    secret_env: "WOOCOMMERCE_SECRET_ALCATRAZ_TOURISM",
    webhook_secret_env: "WOOCOMMERCE_SECRET_ALCATRAZ_TOURISM",
    profit_margin: 0.2,
  },
  {
    site_name: "PelesCastle",
    tour_name: "Peles Castle Tour",
    api_url: "https://pelescastle.ro/wp-json/wc/v3",
    website_url: "https://pelescastle.ro",
    key_env: "WOOCOMMERCE_KEY_PELES_CASTLE",
    secret_env: "WOOCOMMERCE_SECRET_PELES_CASTLE",
    webhook_secret_env: "WOOCOMMERCE_SECRET_PELES_CASTLE",
    profit_margin: 0.25,
  },
  {
    site_name: "BranCastle",
    tour_name: "Bran Castle Tour",
    api_url: "https://brancastletickets.ro/wp-json/wc/v3",
    website_url: "https://brancastletickets.ro",
    key_env: "WOOCOMMERCE_KEY_BRAN_CASTLE",
    secret_env: "WOOCOMMERCE_SECRET_BRAN_CASTLE",
    webhook_secret_env: "WOOCOMMERCE_SECRET_BRAN_CASTLE",
    profit_margin: 0.25,
  },
  {
    site_name: "StatueofLiberty",
    tour_name: "Statue of Liberty Tour",
    api_url: "https://statueoflibertytickets.org/wp-json/wc/v3",
    website_url: "https://statueoflibertytickets.org",
    key_env: "WOOCOMMERCE_KEY_STATUE_LIBERTY",
    secret_env: "WOOCOMMERCE_SECRET_STATUE_LIBERTY",
    webhook_secret_env: "WOOCOMMERCE_SECRET_STATUE_LIBERTY",
    profit_margin: 0.2,
  },
  {
    site_name: "CorvinCastle",
    tour_name: "Corvin Castle Tour",
    api_url: "https://corvincastle.ro/wp-json/wc/v3",
    website_url: "https://corvincastle.ro",
    key_env: "WOOCOMMERCE_KEY_CORVIN_CASTLE",
    secret_env: "WOOCOMMERCE_SECRET_CORVIN_CASTLE",
    webhook_secret_env: "WOOCOMMERCE_SECRET_CORVIN_CASTLE",
    profit_margin: 0.25,
  },
  {
    site_name: "HadriansVilla",
    tour_name: "Hadrian's Villa Tour",
    api_url: "https://hadrians-villa.it/wp-json/wc/v3",
    website_url: "https://hadrians-villa.it",
    key_env: "WOOCOMMERCE_KEY_HADRIANS_VILLA",
    secret_env: "WOOCOMMERCE_SECRET_HADRIANS_VILLA",
    webhook_secret_env: "WOOCOMMERCE_SECRET_HADRIANS_VILLA",
    profit_margin: 0.3,
  },
  {
    site_name: "PenaPalace",
    tour_name: "Pena Palace Tour",
    api_url: "https://penapalace.pt/wp-json/wc/v3",
    website_url: "https://penapalace.pt",
    key_env: "WOOCOMMERCE_KEY_PENA_PALACE",
    secret_env: "WOOCOMMERCE_SECRET_PENA_PALACE",
    webhook_secret_env: "WOOCOMMERCE_SECRET_PENA_PALACE",
    profit_margin: 0.25,
  },
  {
    site_name: "VillaEste",
    tour_name: "Villa d'Este Tour",
    api_url: "https://villa-d-este.it/wp-json/wc/v3",
    website_url: "https://villa-d-este.it",
    key_env: "WOOCOMMERCE_KEY_VILLA_ESTE",
    secret_env: "WOOCOMMERCE_SECRET_VILLA_ESTE",
    webhook_secret_env: "WOOCOMMERCE_SECRET_VILLA_ESTE",
    profit_margin: 0.3,
  },
  {
    site_name: "CasaDiGiulietta",
    tour_name: "Casa di Giulietta Tour",
    api_url: "https://casadigiulietta.it/wp-json/wc/v3",
    website_url: "https://casadigiulietta.it",
    key_env: "WOOCOMMERCE_KEY_CASA_DI_GIULIETTA",
    secret_env: "WOOCOMMERCE_SECRET_CASA_DI_GIULIETTA",
    webhook_secret_env: "WOOCOMMERCE_SECRET_CASA_DI_GIULIETTA",
    profit_margin: 0.3,
  },
] as const;

export const mapWooStatusToInternal = (wooStatus: string) => {
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

export const extractPaymentMethod = (wooOrder: any) => {
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

export const extractPaymentData = (wooOrder: any) => {
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

export const extractTourDate = (wooOrder: any) => {
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

export const extractTourTime = (wooOrder: any) => {
  for (const item of wooOrder?.line_items || []) {
    const timeMeta = (item?.meta_data || []).find(
      (meta: any) => String(meta?.key || "").toLowerCase() === "time"
    );
    if (timeMeta?.value) {
      const match = String(timeMeta.value).match(/(\d{1,2}:\d{2}\s*(?:am|pm))/i);
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

export const transformWooOrder = (
  site: WooSiteConfig,
  wooOrder: any
) => {
  const tickets = deriveTicketRows(wooOrder);
  const totalCost = Number.parseFloat(wooOrder?.total || "0") || 0;
  const totalTickets = tickets.reduce(
    (sum: number, item: any) => sum + (item.quantity || 0),
    0
  );
  const customerPaidPerTicket = totalTickets > 0 ? totalCost / totalTickets : 0;
  const agentCostPerTicket = Math.max(0, customerPaidPerTicket - PROFIT_PER_TICKET_EURO);

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

const getTourMetadataMaps = async () => {
  const { data: tours } = await supabaseAdmin
    .from("tours")
    .select("name,timezone,official_ticketing_url");

  const timezoneByTour = new Map<string, string>();
  const officialUrlByTour = new Map<string, string>();

  (tours || []).forEach((tour: TourRow) => {
    const key = String(tour.name || "").toLowerCase();
    if (!key) return;
    if (tour.timezone) {
      timezoneByTour.set(key, tour.timezone);
    }
    if (tour.official_ticketing_url) {
      officialUrlByTour.set(key, tour.official_ticketing_url);
    }
  });

  return { timezoneByTour, officialUrlByTour };
};

const resolveLegacyEnvCredential = (legacy: (typeof LEGACY_WOOCOMMERCE_SITES)[number]) => {
  const consumerKey = Deno.env.get(legacy.key_env);
  const consumerSecret = Deno.env.get(legacy.secret_env);
  if (!consumerKey || !consumerSecret) {
    return null;
  }

  return {
    site_name: legacy.site_name,
    tour_name: legacy.tour_name,
    api_url: legacy.api_url,
    website_url: legacy.website_url,
    consumer_key: consumerKey,
    consumer_secret: consumerSecret,
    profit_margin: legacy.profit_margin,
    is_active: true,
  } satisfies WooCredentialRow;
};

export const loadWooSites = async (): Promise<WooSiteConfig[]> => {
  const { data: credentials, error } = await supabaseAdmin
    .from("woo_commerce_credentials")
    .select(
      "site_name,tour_name,api_url,website_url,consumer_key,consumer_secret,is_active,profit_margin"
    )
    .eq("is_active", true);

  let sources: WooCredentialRow[] = [];
  if (!error && credentials && credentials.length > 0) {
    sources = credentials as WooCredentialRow[];
  } else {
    sources = LEGACY_WOOCOMMERCE_SITES.map(resolveLegacyEnvCredential).filter(
      Boolean
    ) as WooCredentialRow[];
  }

  const { timezoneByTour, officialUrlByTour } = await getTourMetadataMaps();

  return sources
    .filter(
      (row) =>
        row.site_name &&
        row.tour_name &&
        row.api_url &&
        row.website_url &&
        row.consumer_key &&
        row.consumer_secret
    )
    .map((row) => {
      const key = String(row.tour_name).toLowerCase();
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
      };
    });
};

export const getWooWebhookSecret = (siteName: string) => {
  const globalSecret = Deno.env.get("WOOCOMMERCE_WEBHOOK_SECRET");
  const normalized = siteName
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .toUpperCase();
  const explicit = Deno.env.get(`WOOCOMMERCE_WEBHOOK_SECRET_${normalized}`);

  const legacy = LEGACY_WOOCOMMERCE_SITES.find((site) => site.site_name === siteName);
  const legacySecret = legacy ? Deno.env.get(legacy.webhook_secret_env) : null;

  return explicit || legacySecret || globalSecret || null;
};

