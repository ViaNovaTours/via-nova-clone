import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

type EmailPayload = {
  to?: string;
  subject?: string;
  html?: string;
  text?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as EmailPayload;
    const apiKey = Deno.env.get("SENDGRID_API_KEY");
    const fromEmail = Deno.env.get("SENDGRID_FROM_EMAIL") || "info@vianovatours.com";
    const fromName = Deno.env.get("SENDGRID_FROM_NAME") || "Via Nova Tours";

    if (!payload.to || !payload.subject || (!payload.html && !payload.text)) {
      return jsonResponse(
        {
          success: false,
          error: "Missing required fields: to, subject, and either html or text",
        },
        400
      );
    }

    if (!apiKey) {
      return jsonResponse(
        {
          success: false,
          error: "SENDGRID_API_KEY is not configured",
        },
        500
      );
    }

    const content: Array<{ type: string; value: string }> = [];
    if (payload.text) {
      content.push({ type: "text/plain", value: payload.text });
    }
    if (payload.html) {
      content.push({ type: "text/html", value: payload.html });
    }

    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: payload.to }] }],
        from: { email: fromEmail, name: fromName },
        subject: payload.subject,
        content,
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      return jsonResponse(
        {
          success: false,
          error: "SendGrid request failed",
          details,
        },
        response.status
      );
    }

    return jsonResponse({
      success: true,
      message: "Email sent successfully",
    });
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown email error",
      },
      500
    );
  }
});

