import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";

const normalizeEmail = (email: string) => email.trim().toLowerCase();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const webhookSecret = Deno.env.get("EMAIL_WEBHOOK_SECRET");
    if (webhookSecret) {
      const authHeader = req.headers.get("authorization");
      const headerSecret = req.headers.get("x-webhook-secret");
      const expected = `Bearer ${webhookSecret}`;
      if (authHeader !== expected && headerSecret !== webhookSecret) {
        return jsonResponse(
          { success: false, error: "Unauthorized webhook call" },
          401
        );
      }
    }

    const events = await req.json();
    if (!Array.isArray(events)) {
      return jsonResponse(
        { success: false, error: "Expected an array of SendGrid events" },
        400
      );
    }

    let processed = 0;

    for (const event of events) {
      const eventType = event?.event;
      const email = event?.email ? normalizeEmail(event.email) : null;
      const orderId = event?.order_id || event?.custom_args?.order_id || null;
      const timestamp = event?.timestamp
        ? new Date(Number(event.timestamp) * 1000).toISOString()
        : new Date().toISOString();
      const sgMessageId = event?.sg_message_id || null;

      let order: any = null;
      if (orderId) {
        const { data } = await supabaseAdmin
          .from("orders")
          .select("id,order_id,email,email_communications")
          .eq("order_id", orderId)
          .maybeSingle();
        order = data;
      } else if (email) {
        const { data } = await supabaseAdmin
          .from("orders")
          .select("id,order_id,email,email_communications,purchase_date,created_at")
          .eq("email", email)
          .order("purchase_date", { ascending: false, nullsFirst: false })
          .limit(1);
        order = data?.[0] || null;
      }

      if (!order?.id) {
        continue;
      }

      const eventMap: Record<string, string> = {
        delivered: "Email delivered",
        open: "Email opened",
        click: "Link clicked",
        bounce: "Email bounced",
        dropped: "Email dropped",
        spamreport: "Marked as spam",
        unsubscribe: "Unsubscribed",
      };

      const communication = {
        timestamp,
        message: eventMap[eventType] || `Email event: ${eventType}`,
        sent_by: "system",
        type: `email_${eventType}`,
        sg_message_id: sgMessageId,
      };

      const existing = Array.isArray(order.email_communications)
        ? order.email_communications
        : [];
      const isDuplicate = existing.some(
        (entry: any) =>
          entry?.type === communication.type &&
          entry?.sg_message_id === communication.sg_message_id
      );
      if (isDuplicate) {
        continue;
      }

      const { error } = await supabaseAdmin
        .from("orders")
        .update({
          email_communications: [...existing, communication],
        })
        .eq("id", order.id);

      if (!error) {
        processed += 1;
      }
    }

    return jsonResponse({
      success: true,
      processed,
      received: events.length,
    });
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown SendGrid webhook error",
      },
      500
    );
  }
});

