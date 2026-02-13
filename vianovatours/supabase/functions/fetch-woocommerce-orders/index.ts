import {
  extractPaymentData,
  loadWooSites,
  mapWooStatusToInternal,
  transformWooOrder,
} from "../_shared/woo.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";

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

const getRequestToken = (req: Request) => {
  const fromUserJwt = req.headers.get("x-user-jwt");
  if (fromUserJwt) {
    return fromUserJwt.replace(/^Bearer\s+/i, "").trim();
  }

  const authorization = req.headers.get("authorization") || "";
  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }
  return token.trim();
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

  const user = data.user as any;
  const metadataRoleRaw = user?.app_metadata?.role || user?.user_metadata?.role;
  let role =
    typeof metadataRoleRaw === "string" ? metadataRoleRaw.trim().toLowerCase() : null;

  if (!role || ["authenticated", "anon", "service_role"].includes(role)) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    role = String(profile?.role || "user").trim().toLowerCase();
  }

  if (String(role).toLowerCase() !== "admin") {
    return {
      ok: false as const,
      response: jsonResponse(
        {
          success: false,
          error: "Forbidden: admin access required",
        },
        403
      ),
    };
  }

  return { ok: true as const, context: { user: data.user, role } };
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
      .select("id,order_id,created_at");
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
        const sorted = [...group].sort(
          (a, b) =>
            new Date(a.created_at || 0).getTime() -
            new Date(b.created_at || 0).getTime()
        );
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

