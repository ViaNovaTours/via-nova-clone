import { supabaseAdmin } from "../_shared/supabase.ts";

type MaintenanceRequest = {
  functionName?: string;
  payload?: Record<string, unknown>;
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
  let role =
    user?.app_metadata?.role || user?.user_metadata?.role || user?.role || null;

  if (!role) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    role = profile?.role || "user";
  }

  if (role !== "admin") {
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

const invokeEdge = async (
  functionName: string,
  payload: unknown,
  authorization?: string | null
) => {
  const { data, error } = await supabaseAdmin.functions.invoke(functionName, {
    body: payload ?? {},
    headers: authorization
      ? {
          authorization,
        }
      : undefined,
  });
  if (error) {
    throw new Error(`Failed invoking ${functionName}: ${error.message}`);
  }
  return data;
};

const normalizeFunctionName = (name: string) =>
  name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .toLowerCase();

const migrateStatusesToTags = async () => {
  const { data: orders, error } = await supabaseAdmin
    .from("orders")
    .select("id,status,tags")
    .in("status", ["reserved_date", "awaiting_reply"]);

  if (error) {
    throw new Error(error.message);
  }

  let updated = 0;
  for (const order of orders || []) {
    const tags = Array.isArray(order.tags) ? [...order.tags] : [];
    if (order.status === "reserved_date" && !tags.includes("reserved_date")) {
      tags.push("reserved_date");
    }
    if (order.status === "awaiting_reply" && !tags.includes("awaiting_reply")) {
      tags.push("awaiting_reply");
    }

    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        tags,
        status: "unprocessed",
      })
      .eq("id", order.id);
    if (!updateError) {
      updated += 1;
    }
  }

  return {
    success: true,
    updated_count: updated,
  };
};

const resetReservedDates = async () => {
  const { data: orders, error } = await supabaseAdmin
    .from("orders")
    .select("id,status")
    .eq("status", "reserved_date");
  if (error) throw new Error(error.message);

  let updated = 0;
  for (const order of orders || []) {
    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({ status: "new" })
      .eq("id", order.id);
    if (!updateError) updated += 1;
  }
  return { success: true, updated_count: updated };
};

const logAdSpend = async (payload: Record<string, unknown>) => {
  const date = String(payload.date || "").slice(0, 10);
  const tourName = String(payload.tour_name || payload.tour || "").trim();
  const source = String(payload.source || "unknown").trim();
  const cost = Number(payload.cost || 0);
  const currency = String(payload.currency || "USD").toUpperCase();

  if (!date || !tourName || !Number.isFinite(cost)) {
    throw new Error("date, tour_name, and cost are required");
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("ad_spend")
    .select("id,cost")
    .eq("date", date)
    .eq("tour_name", tourName)
    .eq("source", source)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);

  if (existing?.id) {
    const { error } = await supabaseAdmin
      .from("ad_spend")
      .update({ cost, currency })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    return { success: true, action: "updated", id: existing.id };
  }

  const { data: inserted, error } = await supabaseAdmin
    .from("ad_spend")
    .insert({ date, tour_name: tourName, source, cost, currency })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { success: true, action: "created", id: inserted.id };
};

const backfillPurchaseUrls = async () => {
  const { data: credentials, error: credError } = await supabaseAdmin
    .from("woo_commerce_credentials")
    .select("tour_name,website_url,site_name");
  if (credError) throw new Error(credError.message);

  const urlByTour = new Map<string, string>();
  (credentials || []).forEach((row) => {
    if (row.tour_name && row.website_url) {
      urlByTour.set(String(row.tour_name).toLowerCase(), row.website_url);
    }
  });

  const { data: orders, error: orderError } = await supabaseAdmin
    .from("orders")
    .select("id,tour,purchase_url")
    .or("purchase_url.is.null,purchase_url.eq.");
  if (orderError) throw new Error(orderError.message);

  let updated = 0;
  for (const order of orders || []) {
    const url = urlByTour.get(String(order.tour || "").toLowerCase());
    if (!url) continue;
    const { error } = await supabaseAdmin
      .from("orders")
      .update({ purchase_url: url })
      .eq("id", order.id);
    if (!error) updated += 1;
  }
  return { success: true, updated_count: updated };
};

const backfillPaymentData = async () => {
  const { data: orders, error } = await supabaseAdmin
    .from("orders")
    .select("id,status,payment_status,payment_captured");
  if (error) throw new Error(error.message);

  let updated = 0;
  for (const order of orders || []) {
    if (order.payment_status && order.payment_captured !== null) continue;
    const status = String(order.status || "");
    const paymentStatus =
      status === "completed"
        ? "succeeded"
        : status === "pending" || status === "pending-payment"
        ? "pending"
        : status === "failed"
        ? "failed"
        : status === "refunded"
        ? "refunded"
        : status === "cancelled"
        ? "canceled"
        : "processing";
    const captured = ["completed", "processing", "unprocessed"].includes(status);
    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        payment_status: paymentStatus,
        payment_captured: captured,
      })
      .eq("id", order.id);
    if (!updateError) updated += 1;
  }

  return { success: true, updated_count: updated };
};

const consolidateTours = async (payload: Record<string, unknown>) => {
  const mappings = Array.isArray(payload.mappings) ? payload.mappings : [];
  if (!mappings.length) {
    throw new Error("Provide payload.mappings as [{ old_name, new_name }]");
  }

  let updatedOrders = 0;
  let updatedAdSpend = 0;

  for (const mapping of mappings as any[]) {
    const oldName = String(mapping.old_name || "").trim();
    const newName = String(mapping.new_name || "").trim();
    if (!oldName || !newName) continue;

    const { error: orderError, count: orderCount } = await supabaseAdmin
      .from("orders")
      .update({ tour: newName })
      .eq("tour", oldName)
      .select("id", { count: "exact", head: true });
    if (!orderError && orderCount) {
      updatedOrders += orderCount;
    }

    const { error: adError, count: adCount } = await supabaseAdmin
      .from("ad_spend")
      .update({ tour_name: newName })
      .eq("tour_name", oldName)
      .select("id", { count: "exact", head: true });
    if (!adError && adCount) {
      updatedAdSpend += adCount;
    }
  }

  return { success: true, updated_orders: updatedOrders, updated_ad_spend: updatedAdSpend };
};

const runKnownOperation = async (
  functionName: string,
  payload: Record<string, unknown>,
  authorization?: string | null
) => {
  const manualSyncFunctions = new Set([
    "fixSpecificOrderStatuses",
    "fixLiannesOrder",
    "fixTicketQuantities",
    "fixNatashaOrder",
    "fixBranOrders",
    "fixCharlesOrder",
    "fixKarinaOrder",
  ]);

  if (manualSyncFunctions.has(functionName)) {
    const orderIds = Array.isArray(payload.order_ids) ? payload.order_ids : [];
    if (orderIds.length > 0) {
      return invokeEdge(
        "update-specific-order-status",
        { order_ids: orderIds },
        authorization
      );
    }

    return {
      success: true,
      migrated: true,
      action: "noop",
      message:
        `${functionName} is available via legacy-maintenance. ` +
        "Pass payload.order_ids to run targeted status reconciliation.",
    };
  }

  if (
    functionName.startsWith("debug") ||
    ["testWebhookStatus", "scrapePenaPalaceAvailability"].includes(functionName)
  ) {
    const { data: sampleOrders } = await supabaseAdmin
      .from("orders")
      .select("id,order_id,status,tour,tour_date,created_at")
      .order("created_at", { ascending: false })
      .limit(25);

    return {
      success: true,
      migrated: true,
      action: "diagnostic",
      function: functionName,
      sample_orders: sampleOrders || [],
      message:
        `${functionName} is running in diagnostic compatibility mode. ` +
        "Review payload and create a dedicated edge function for exact legacy behavior if needed.",
    };
  }

  switch (functionName) {
    case "migrateStatusesToTags":
      return migrateStatusesToTags();
    case "resetReservedDates":
    case "updateReservedOrders":
      return resetReservedDates();
    case "logAdSpend":
      return logAdSpend(payload);
    case "backfillPurchaseUrls":
      return backfillPurchaseUrls();
    case "backfillPaymentData":
      return backfillPaymentData();
    case "consolidateTours":
      return consolidateTours(payload);
    case "verifyFailedOrders":
      return invokeEdge("update-specific-order-status", payload, authorization);
    case "verifyUnprocessedOrders":
      return invokeEdge("update-specific-order-status", payload, authorization);
    case "testGoogleDriveAuth":
      return {
        success: true,
        has_token: Boolean(
          Deno.env.get("GOOGLEDRIVE_ACCESS_TOKEN") ||
            Deno.env.get("GOOGLE_DRIVE_ACCESS_TOKEN") ||
            Deno.env.get("GOOGLE_OAUTH_REFRESH_TOKEN")
        ),
      };
    case "refreshCasaDiGiuliettaCredentials":
    case "fixCasaDiGiuliettaCredentials":
      return invokeEdge(
        "migrate-woocommerce-credentials",
        { site_name: "CasaDiGiulietta" },
        authorization
      );
    case "syncCasaDiGiulietta":
    case "fetchCasaDiGiuliettaOrders":
      return invokeEdge("fetch-woocommerce-orders", payload, authorization);
    default:
      return null;
  }
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
    const body: MaintenanceRequest = await req.json().catch(() => ({}));
    const authorization = req.headers.get("authorization");
    const functionName = String(body.functionName || "").trim();
    const payload = (body.payload || {}) as Record<string, unknown>;
    if (!functionName) {
      return jsonResponse(
        {
          success: false,
          error: "functionName is required",
        },
        400
      );
    }

    const delegatedMap: Record<string, string> = {
      syncCasaDiGiulietta: "fetch-woocommerce-orders",
      fetchCasaDiGiuliettaOrders: "fetch-woocommerce-orders",
      importMissingCorvinOrders: "fetch-woocommerce-orders",
      refreshCasaDiGiuliettaCredentials: "migrate-woocommerce-credentials",
      fixCasaDiGiuliettaCredentials: "migrate-woocommerce-credentials",
      migrateWooCommerceCredentials: "migrate-woocommerce-credentials",
      fixCompleteStatus: "fix-complete-status",
      calculateProfitsForAllOrders: "calculate-profits-for-all-orders",
      fetchWooCommerceOrders: "fetch-woocommerce-orders",
      updateSpecificOrderStatus: "update-specific-order-status",
      fetchGmailThreads: "fetch-gmail-threads",
      generateSitemap: "generate-sitemap",
      generateRobotsTxt: "generate-robots-txt",
      sendgridWebhook: "sendgrid-webhook",
      logEmailCommunication: "log-email-communication",
      wooCommerceWebhook: "woo-commerce-webhook",
    };

    const delegated = delegatedMap[functionName];
    if (delegated) {
      const data = await invokeEdge(delegated, payload, authorization);
      return jsonResponse({
        success: true,
        delegated_to: delegated,
        data,
      });
    }

    const known = await runKnownOperation(functionName, payload, authorization);
    if (known) {
      return jsonResponse(known);
    }

    const normalized = normalizeFunctionName(functionName);
    return jsonResponse({
      success: true,
      migrated: false,
      action: "compatibility-noop",
      function: functionName,
      suggestion:
        `Create or deploy edge function "${normalized}" and map it via VITE_SUPABASE_FUNCTION_MAP if needed.`,
      message:
        `Function "${functionName}" is available through legacy-maintenance compatibility mode.`,
    });
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown legacy maintenance error",
      },
      500
    );
  }
});

