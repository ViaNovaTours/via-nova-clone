import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

type Payload = {
  orderId?: string;
  downloadLink?: string;
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const sendGridApiKey = Deno.env.get("SENDGRID_API_KEY") ?? "";
const fromEmail = Deno.env.get("SENDGRID_FROM_EMAIL") || "info@vianovatours.com";
const fromName = Deno.env.get("SENDGRID_FROM_NAME") || "Via Nova Tours";

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

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
      subject: `Your ${order.tour || "tour"} Ticket is Ready`,
      html,
    });

    const communicationEntry = {
      type: "ticket_email",
      sent_at: new Date().toISOString(),
      to: order.email,
      subject: `Your ${order.tour || "tour"} Ticket is Ready`,
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

