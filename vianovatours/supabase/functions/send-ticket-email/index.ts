import { createClient } from "npm:@supabase/supabase-js@2.57.4";

type Payload = {
  orderId?: string;
  downloadLink?: string;
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
const sendGridApiKey = Deno.env.get("SENDGRID_API_KEY") ?? "";
const fromEmail = Deno.env.get("SENDGRID_FROM_EMAIL") || "info@vianovatours.com";
const fromName = Deno.env.get("SENDGRID_FROM_NAME") || "Via Nova Tours";

const supabase = createClient(supabaseUrl, serviceRoleKey, {
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
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (error) return null;
  const role = String(data?.role || "").trim().toLowerCase();
  return role || null;
};

const requireStaffOrAdmin = async (req: Request) => {
  const token = getRequestToken(req);
  if (!token) {
    return {
      ok: false as const,
      response: jsonResponse({ success: false, error: "Unauthorized" }, 401),
    };
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return {
      ok: false as const,
      response: jsonResponse({ success: false, error: "Unauthorized" }, 401),
    };
  }

  const role = getAppRole(data.user) || (await getProfileRole(data.user.id));
  if (!["admin", "staff"].includes(String(role || "").toLowerCase())) {
    return {
      ok: false as const,
      response: jsonResponse(
        { success: false, error: "Forbidden: staff/admin access required" },
        403
      ),
    };
  }

  return {
    ok: true as const,
    context: {
      user: {
        id: data.user.id,
        email: data.user.email || null,
        role: String(role || "staff"),
      },
    },
  };
};

const sendEmail = async ({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) => {
  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sendGridApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: fromEmail, name: fromName },
      subject,
      content: [{ type: "text/html", value: html }],
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`SendGrid failed: ${details}`);
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      { success: false, error: "Method not allowed. Use POST." },
      405
    );
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      { success: false, error: "Missing Supabase service role configuration" },
      500
    );
  }

  if (!sendGridApiKey) {
    return jsonResponse(
      { success: false, error: "SENDGRID_API_KEY is not configured" },
      500
    );
  }

  const auth = await requireStaffOrAdmin(req);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const payload = (await req.json()) as Payload;
    const lookup = String(payload.orderId || "").trim();

    if (!lookup) {
      return jsonResponse({ success: false, error: "orderId is required" }, 400);
    }

    const { data: orderByOrderId, error: byOrderIdError } = await supabase
      .from("orders")
      .select("*")
      .eq("order_id", lookup)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (byOrderIdError) {
      return jsonResponse({ success: false, error: byOrderIdError.message }, 500);
    }

    let order = orderByOrderId;
    if (!order) {
      const { data: orderById, error: byIdError } = await supabase
        .from("orders")
        .select("*")
        .eq("id", lookup)
        .maybeSingle();
      if (byIdError) {
        return jsonResponse({ success: false, error: byIdError.message }, 500);
      }
      order = orderById;
    }

    if (!order) {
      return jsonResponse(
        { success: false, error: `Order not found: ${lookup}` },
        404
      );
    }

    if (!order.email) {
      return jsonResponse(
        { success: false, error: "Order has no customer email address" },
        400
      );
    }

    const ticketFiles = Array.isArray(order.ticket_files) ? order.ticket_files : [];
    const ticketLinks = ticketFiles
      .map(
        (url: string) =>
          `<li><a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a></li>`
      )
      .join("");

    const downloadSection = payload.downloadLink
      ? `<p><a href="${payload.downloadLink}" target="_blank" rel="noopener noreferrer">Download your ticket</a></p>`
      : "";

    const subject = `Your ${order.tour || "tour"} Ticket is Ready`;
    const html = `
      <h2>Your ${order.tour || "tour"} tickets</h2>
      <p>Hi ${order.first_name || "there"},</p>
      <p>Your booking is confirmed. Please find your ticket links below.</p>
      ${downloadSection}
      ${
        ticketLinks
          ? `<ul>${ticketLinks}</ul>`
          : "<p>Your ticket files will be attached shortly by our team.</p>"
      }
      <p>Order ID: ${order.order_id}</p>
      <p>Thanks,<br/>Via Nova Tours</p>
    `;

    await sendEmail({
      to: order.email,
      subject,
      html,
    });

    const communicationEntry = {
      type: "ticket_email",
      sent_at: new Date().toISOString(),
      to: order.email,
      subject,
      sent_by: auth.context.user.email || auth.context.user.id,
    };
    const existingComms = Array.isArray(order.email_communications)
      ? order.email_communications
      : [];

    const { error: commsError } = await supabase
      .from("orders")
      .update({
        email_communications: [...existingComms, communicationEntry],
      })
      .eq("id", order.id);

    if (commsError) {
      return jsonResponse(
        {
          success: false,
          error: `Email sent but failed to log communication: ${commsError.message}`,
        },
        500
      );
    }

    return jsonResponse({
      success: true,
      message: "Ticket email sent successfully",
    });
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown ticket email error",
      },
      500
    );
  }
});

