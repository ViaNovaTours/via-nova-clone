import { requireAdmin } from "../_shared/auth.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { loadWooSites, mapWooStatusToInternal } from "../_shared/woo.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";

type RequestPayload = {
  order_ids?: string[];
};

const isPastDate = (tourDate: string | null | undefined) => {
  if (!tourDate) return false;
  const date = new Date(tourDate);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  return date < now;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const admin = await requireAdmin(req);
  if (!admin.ok) {
    return admin.response;
  }

  try {
    const payload: RequestPayload = await req.json().catch(() => ({}));

    const { data: allOrders, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id,order_id,first_name,last_name,tour_date,status");

    if (orderError) {
      throw new Error(`Failed to load orders: ${orderError.message}`);
    }

    const sites = await loadWooSites();
    const siteByName = new Map(sites.map((site) => [site.site_name, site]));

    const ordersToCheck = payload.order_ids?.length
      ? (allOrders || []).filter((order) => payload.order_ids!.includes(order.order_id))
      : (allOrders || []).filter(
          (order) =>
            ["new", "unprocessed", "pending"].includes(order.status) &&
            isPastDate(order.tour_date)
        );

    const results: Array<Record<string, unknown>> = [];
    let updatedCount = 0;

    for (const order of ordersToCheck) {
      const orderId = String(order.order_id || "");
      if (!orderId.includes("-")) {
        continue;
      }

      const [siteName, wooOrderId] = orderId.split("-");
      const site = siteByName.get(siteName);
      if (!site) {
        results.push({
          order_id: order.order_id,
          error: "Site configuration not found",
        });
        continue;
      }

      try {
        const auth = btoa(`${site.consumer_key}:${site.consumer_secret}`);
        const response = await fetch(`${site.api_url}/orders/${wooOrderId}`, {
          headers: { Authorization: `Basic ${auth}` },
        });

        if (!response.ok) {
          results.push({
            order_id: order.order_id,
            error: `WooCommerce API error ${response.status}`,
          });
          continue;
        }

        const wooOrder = await response.json();
        const mappedStatus = mapWooStatusToInternal(String(wooOrder.status || ""));

        results.push({
          order_id: order.order_id,
          customer: `${order.first_name || ""} ${order.last_name || ""}`.trim(),
          tour_date: order.tour_date,
          current_status_in_our_system: order.status,
          woocommerce_status: wooOrder.status,
          mapped_status: mappedStatus,
          needs_update: order.status !== mappedStatus,
        });

        if (order.status !== mappedStatus) {
          const { error: updateError } = await supabaseAdmin
            .from("orders")
            .update({ status: mappedStatus })
            .eq("id", order.id);
          if (updateError) {
            results.push({
              order_id: order.order_id,
              error: `Failed to update status: ${updateError.message}`,
            });
          } else {
            updatedCount += 1;
          }
        }
      } catch (orderError) {
        results.push({
          order_id: order.order_id,
          error:
            orderError instanceof Error ? orderError.message : "Unknown update error",
        });
      }
    }

    return jsonResponse({
      success: true,
      orders_checked: results.length,
      orders_updated: updatedCount,
      results,
    });
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown status synchronization error",
      },
      500
    );
  }
});

