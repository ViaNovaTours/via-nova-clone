import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";

const orderIdPattern = /(?:Order:?\s*|#)([a-zA-Z0-9-]+)/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      { success: false, error: "This endpoint accepts POST requests only." },
      405
    );
  }

  try {
    const secret = Deno.env.get("EMAIL_WEBHOOK_SECRET");
    if (!secret) {
      return jsonResponse(
        {
          success: false,
          error: "EMAIL_WEBHOOK_SECRET is not configured",
        },
        500
      );
    }

    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) {
      return jsonResponse(
        {
          success: false,
          error: "Unauthorized",
        },
        401
      );
    }

    const { from, subject, body } = await req.json();
    if (!from || !subject || !body) {
      return jsonResponse(
        {
          success: false,
          error: "Missing required fields: from, subject, body",
        },
        400
      );
    }

    const sender = String(from).trim().toLowerCase();
    let targetOrder: any = null;

    const subjectMatch = String(subject).match(orderIdPattern);
    const extractedOrderId = subjectMatch?.[1];

    if (extractedOrderId) {
      const { data, error } = await supabaseAdmin
        .from("orders")
        .select("id,order_id,email,customer_communication,purchase_date,created_at")
        .ilike("order_id", `%${extractedOrderId}%`)
        .order("purchase_date", { ascending: false, nullsFirst: false })
        .limit(1);

      if (!error && data?.length) {
        targetOrder = data[0];
      }
    }

    if (!targetOrder) {
      const { data, error } = await supabaseAdmin
        .from("orders")
        .select("id,order_id,email,customer_communication,purchase_date,created_at")
        .eq("email", sender)
        .order("purchase_date", { ascending: false, nullsFirst: false })
        .limit(1);
      if (!error && data?.length) {
        targetOrder = data[0];
      }
    }

    if (!targetOrder?.id) {
      return jsonResponse(
        {
          success: false,
          error: `Could not find matching order for sender ${sender}`,
        },
        404
      );
    }

    const newEntry = {
      timestamp: new Date().toISOString(),
      message: String(body),
      sent_by: sender,
      type: "email_received",
      subject: String(subject),
    };

    const existing = Array.isArray(targetOrder.customer_communication)
      ? targetOrder.customer_communication
      : [];

    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        customer_communication: [...existing, newEntry],
      })
      .eq("id", targetOrder.id);

    if (updateError) {
      return jsonResponse(
        {
          success: false,
          error: updateError.message,
        },
        500
      );
    }

    return jsonResponse({
      success: true,
      message: `Logged communication for order ${targetOrder.order_id}`,
      order_id: targetOrder.order_id,
    });
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown email logging error",
      },
      500
    );
  }
});

