import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

type Payload = {
  orderId?: string;
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const sendGridApiKey = Deno.env.get("SENDGRID_API_KEY") ?? "";
const fromEmail = Deno.env.get("SENDGRID_FROM_EMAIL") || "info@vianovatours.com";
const fromName = Deno.env.get("SENDGRID_FROM_NAME") || "Via Nova Tours";

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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

  try {
    const payload = (await req.json()) as Payload;

    if (!payload.orderId) {
      return jsonResponse(
        { success: false, error: "orderId is required" },
        400
      );
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("order_id", payload.orderId)
      .maybeSingle();

    if (orderError) {
      return jsonResponse(
        { success: false, error: orderError.message },
        500
      );
    }

    if (!order) {
      return jsonResponse(
        { success: false, error: `Order not found: ${payload.orderId}` },
        404
      );
    }

    if (!order.email) {
      return jsonResponse(
        { success: false, error: "Order has no customer email address" },
        400
      );
    }

    const html = `
      <h2>We've reserved your spot</h2>
      <p>Hi ${order.first_name || "there"},</p>
      <p>Your order has been received and your spot is reserved.</p>
      <p>If tickets are released closer to the date, we will send them to this email address as soon as they are available.</p>
      <p>Order ID: ${order.order_id}</p>
      <p>Tour: ${order.tour || "N/A"}</p>
      <p>Date: ${order.tour_date || "N/A"} ${order.tour_time || ""}</p>
      <p>Thanks,<br/>Via Nova Tours</p>
    `;

    const emailResponse = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sendGridApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: order.email }] }],
        from: { email: fromEmail, name: fromName },
        subject: "We've Reserved Your Spot(s)",
        content: [{ type: "text/html", value: html }],
      }),
    });

    if (!emailResponse.ok) {
      const details = await emailResponse.text();
      return jsonResponse(
        { success: false, error: `SendGrid failed: ${details}` },
        500
      );
    }

    const communicationEntry = {
      type: "reserved_email",
      sent_at: new Date().toISOString(),
      to: order.email,
      subject: "We've Reserved Your Spot(s)",
    };
    const existingComms = Array.isArray(order.email_communications)
      ? order.email_communications
      : [];

    await supabase
      .from("orders")
      .update({
        email_communications: [...existingComms, communicationEntry],
      })
      .eq("id", order.id);

    return jsonResponse({
      success: true,
      message: "Reserved email sent successfully",
    });
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown reserved email error",
      },
      500
    );
  }
});

