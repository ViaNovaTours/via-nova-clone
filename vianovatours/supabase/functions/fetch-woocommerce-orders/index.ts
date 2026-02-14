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
    "authorization, x-user-jwt, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const normalizeBearer = (raw: string | null) => {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;
  if (value.toLowerCase().startsWith("bearer ")) {
    const token = value.slice(7).trim();
    return token || null;
  }
  return value;
};

const getRequestToken = (req: Request) => {
  const forwarded = normalizeBearer(req.headers.get("x-user-jwt"));
  if (forwarded) return forwarded;

  const authorization = req.headers.get("authorization") || "";
  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }
  return token;
};

const getAppRole = (user: any) => {
  const raw = user?.app_metadata?.role || user?.user_metadata?.role || null;
  if (typeof raw !== "string") return null;
  const role = raw.trim().toLowerCase();
  if (!role) return null;
  if (["authenticated", "anon", "service_role"].includes(role)) {
    return null;
  }
  return role;
};

const getProfileRole = async (userId: string) => {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (error) return null;
  const role = String(data?.role || "").trim().toLowerCase();
  return role || null;
};

const requireAdmin = async (req: Request) => {
  const token = getRequestToken(req);
  if (!token) {
    return {
      ok: false as const,
      response: jsonResponse({ success: false, error: "Unauthorized" }, 401),
    };
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    return {
      ok: false as const,
      response: jsonResponse({ success: false, error: "Unauthorized" }, 401),
    };
  }

  const role = getAppRole(data.user) || (await getProfileRole(data.user.id));
  if (role !== "admin") {
    return {
      ok: false as const,
      response: jsonResponse(
        { success: false, error: "Forbidden: admin access required" },
        403
      ),
    };
  }

  return {
    ok: true as const,
    context: {
      user: {
        id: data.user.id,
        email: data.user.email,
        role: "admin",
      },
    },
  };
};

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

const getNumericWooOrderId = (orderId: string | null | undefined) => {
  if (!orderId || !orderId.includes("-")) return 0;
  const parsed = Number.parseInt(orderId.split("-").at(-1) || "0", 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const mergeAddressBackfill = (existingOrder: any, wooOrder: any) => {
  const updates: Record<string, unknown> = {};
  const billing = wooOrder?.billing || {};

  if (!existingOrder.address && billing.address_1) updates.address = billing.address_1;
  if (!existingOrder.city && billing.city) updates.city = billing.city;
  if (!existingOrder.state_region && billing.state) updates.state_region = billing.state;
  if (!existingOrder.zip && billing.postcode) updates.zip = billing.postcode;
  if (!existingOrder.country && billing.country) updates.country = billing.country;
  return updates;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const admin = await requireAdmin(req);
  if (!admin.ok) {
    return admin.response;
  }

  let totalImported = 0;
  let statusUpdated = 0;
  let mergedDuplicates = 0;
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const { data: existingOrders, error: ordersError } = await supabaseAdmin
      .from("orders")
      .select(
        "id,order_id,status,purchase_date,created_at,address,city,state_region,zip,country,payment_transaction_id,payment_status,payment_captured,official_site_url"
      )
      .order("created_at", { ascending: false });

    if (ordersError) {
      throw new Error(`Failed to load existing orders: ${ordersError.message}`);
    }

    const allDbOrders = existingOrders || [];
    const sites = await loadWooSites();
    if (sites.length === 0) {
      return jsonResponse(
        {
          success: false,
          error:
            "No active WooCommerce sites configured. Add credentials in WooCommerce setup.",
        },
        400
      );
    }

    for (const site of sites) {
      try {
        const siteOrders = allDbOrders.filter((order) =>
          String(order.order_id || "").startsWith(`${site.site_name}-`)
        );
        const highestId = Math.max(
          0,
          ...siteOrders.map((order) => getNumericWooOrderId(order.order_id))
        );

        const authHeader = `Basic ${btoa(
          `${site.consumer_key}:${site.consumer_secret}`
        )}`;
        let wooOrders: any[] = [];
        let page = 1;
        let hasMore = true;

        while (hasMore && page <= 5) {
          const response = await fetch(
            `${site.api_url}/orders?per_page=100&page=${page}&orderby=id&order=desc`,
            {
              headers: { Authorization: authHeader },
            }
          );

          if (!response.ok) {
            const contentType = response.headers.get("content-type") || "";
            if (contentType.includes("text/html")) {
              errors.push(
                `${site.site_name}: received HTML instead of JSON (status ${response.status})`
              );
            } else {
              errors.push(
                `${site.site_name}: WooCommerce API error ${response.status}`
              );
            }
            hasMore = false;
            break;
          }

          const pageOrders = await response.json();
          if (!Array.isArray(pageOrders) || pageOrders.length === 0) {
            hasMore = false;
            break;
          }

          wooOrders = wooOrders.concat(pageOrders);
          const lowestIdOnPage = Math.min(
            ...pageOrders.map((order: any) => Number(order.id) || 0)
          );

          if (lowestIdOnPage <= highestId) {
            hasMore = false;
          } else {
            page += 1;
          }
        }

        const missingOrders = wooOrders.filter(
          (order) => Number(order.id) > highestId
        );

        for (const wooOrder of missingOrders) {
          const transformed = transformWooOrder(site, wooOrder);
          const { error: insertError } = await supabaseAdmin
            .from("orders")
            .insert(transformed);
          if (insertError) {
            if (insertError.code === "23505") {
              // Another sync run inserted this row concurrently.
              warnings.push(
                `${site.site_name}: duplicate skipped for order ${wooOrder.id}`
              );
              continue;
            }
            errors.push(
              `${site.site_name}: failed to import order ${wooOrder.id} (${insertError.message})`
            );
            continue;
          }
          totalImported += 1;
        }

        const recentOrders = [...siteOrders]
          .sort((a, b) => {
            const dateA = new Date(a.purchase_date || a.created_at || 0).getTime();
            const dateB = new Date(b.purchase_date || b.created_at || 0).getTime();
            return dateB - dateA;
          })
          .slice(0, 20);

        for (const existingOrder of recentOrders) {
          const wooOrderId = getNumericWooOrderId(existingOrder.order_id);
          const wooOrder = wooOrders.find(
            (candidate) => Number(candidate.id) === wooOrderId
          );
          if (!wooOrder) continue;

          const mappedStatus = mapWooStatusToInternal(String(wooOrder.status || ""));
          const paymentData = extractPaymentData(wooOrder);
          const updates: Record<string, unknown> = {
            ...mergeAddressBackfill(existingOrder, wooOrder),
          };

          if (existingOrder.status !== mappedStatus) {
            updates.status = mappedStatus;
          }
          if (
            paymentData.payment_transaction_id &&
            existingOrder.payment_transaction_id !== paymentData.payment_transaction_id
          ) {
            updates.payment_transaction_id = paymentData.payment_transaction_id;
          }
          if (
            paymentData.payment_status &&
            existingOrder.payment_status !== paymentData.payment_status
          ) {
            updates.payment_status = paymentData.payment_status;
          }
          if (
            paymentData.payment_captured !== null &&
            existingOrder.payment_captured !== paymentData.payment_captured
          ) {
            updates.payment_captured = paymentData.payment_captured;
          }
          if (!existingOrder.official_site_url && site.official_site_url) {
            updates.official_site_url = site.official_site_url;
          }

          if (Object.keys(updates).length > 0) {
            const { error: updateError } = await supabaseAdmin
              .from("orders")
              .update(updates)
              .eq("id", existingOrder.id);
            if (updateError) {
              errors.push(
                `${site.site_name}: failed updating order ${existingOrder.order_id} (${updateError.message})`
              );
            } else {
              statusUpdated += 1;
            }
          }
        }
      } catch (siteError) {
        errors.push(
          `Error processing ${site.site_name}: ${
            siteError instanceof Error ? siteError.message : "Unknown error"
          }`
        );
      }
    }

    const { data: postImportOrders, error: reloadError } = await supabaseAdmin
      .from("orders")
      .select("id,order_id,created_at,updated_at,purchase_date,tags");
    if (reloadError) {
      warnings.push(`Duplicate cleanup skipped: ${reloadError.message}`);
    } else {
      const grouped = new Map<string, any[]>();
      for (const order of postImportOrders || []) {
        if (!order.order_id) continue;
        if (!grouped.has(order.order_id)) grouped.set(order.order_id, []);
        grouped.get(order.order_id)!.push(order);
      }

      for (const [orderId, group] of grouped.entries()) {
        if (group.length <= 1) continue;
        const sorted = [...group].sort((a, b) => {
          const tagsA = Array.isArray(a.tags) ? a.tags.length : 0;
          const tagsB = Array.isArray(b.tags) ? b.tags.length : 0;
          if (tagsA !== tagsB) {
            return tagsB - tagsA;
          }

          const tsA = new Date(
            a.updated_at || a.purchase_date || a.created_at || 0
          ).getTime();
          const tsB = new Date(
            b.updated_at || b.purchase_date || b.created_at || 0
          ).getTime();
          return tsB - tsA;
        });
        const toDelete = sorted.slice(1);
        for (const duplicate of toDelete) {
          const { error: deleteError } = await supabaseAdmin
            .from("orders")
            .delete()
            .eq("id", duplicate.id);
          if (deleteError) {
            warnings.push(
              `Could not delete duplicate order ${duplicate.id}: ${deleteError.message}`
            );
          } else {
            mergedDuplicates += 1;
          }
        }
      }
    }

    return jsonResponse({
      success: true,
      total_new_orders: totalImported,
      status_updates: statusUpdated,
      merged_duplicates: mergedDuplicates,
      warnings: warnings.length ? warnings : null,
      errors: errors.length ? errors : null,
    });
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown WooCommerce sync error",
      },
      500
    );
  }
});

