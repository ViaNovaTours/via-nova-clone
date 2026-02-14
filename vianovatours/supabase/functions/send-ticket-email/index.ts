import { createClient } from "npm:@supabase/supabase-js@2.57.4";

type Payload = {
  orderId?: string;
  downloadLink?: string;
  testMode?: boolean;
  testEmail?: string;
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
const fromEmail = "info@vianovatours.com";
const fromName = Deno.env.get("SENDGRID_FROM_NAME") || "Via Nova Tours";
const archiveBcc = Deno.env.get("SENDGRID_ARCHIVE_BCC") || "archive@vianovatours.com";
const googleDriveAccessToken = Deno.env.get("GOOGLEDRIVE_ACCESS_TOKEN") || "";

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
  bcc,
  subject,
  html,
  attachments,
}: {
  to: string;
  bcc?: string | null;
  subject: string;
  html: string;
  attachments?: Array<{
    content: string;
    type: string;
    filename: string;
  }>;
}) => {
  const personalization: Record<string, unknown> = {
    to: [{ email: to }],
  };
  if (bcc) {
    personalization.bcc = [{ email: bcc }];
  }

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sendGridApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [personalization],
      from: { email: fromEmail, name: fromName },
      subject,
      content: [{ type: "text/html", value: html }],
      attachments:
        Array.isArray(attachments) && attachments.length > 0
          ? attachments.map((file) => ({
              content: file.content,
              type: file.type,
              filename: file.filename,
              disposition: "attachment",
            }))
          : undefined,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`SendGrid failed: ${details}`);
  }
};

const extractGoogleDriveFileId = (rawUrl: string) => {
  try {
    const url = new URL(rawUrl);
    if (!/drive\.google\.com$/i.test(url.hostname) && !/docs\.google\.com$/i.test(url.hostname)) {
      return null;
    }

    const idFromQuery = url.searchParams.get("id");
    if (idFromQuery) return idFromQuery;

    const match = url.pathname.match(/\/d\/([^/]+)/);
    if (match?.[1]) return match[1];
  } catch {
    // ignore parsing error
  }
  return null;
};

const parseContentDispositionFilename = (header: string | null) => {
  if (!header) return null;
  const utf8Match = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }
  const basicMatch = header.match(/filename="?([^";]+)"?/i);
  return basicMatch?.[1] || null;
};

const guessFileNameFromUrl = (rawUrl: string, fallback: string) => {
  try {
    const url = new URL(rawUrl);
    const name = decodeURIComponent(url.pathname.split("/").filter(Boolean).at(-1) || "");
    if (name && name !== "view" && name !== "uc") {
      return name;
    }
  } catch {
    // ignore
  }
  return fallback;
};

const bytesToBase64 = (bytes: Uint8Array) => {
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
};

const isPdfBytes = (bytes: Uint8Array) =>
  bytes.length >= 4 &&
  bytes[0] === 0x25 &&
  bytes[1] === 0x50 &&
  bytes[2] === 0x44 &&
  bytes[3] === 0x46;

const fetchAttachment = async (fileUrl: string, index: number) => {
  const fallbackName = `ticket-${index + 1}.pdf`;
  const driveId = extractGoogleDriveFileId(fileUrl);

  const candidates: Array<{ url: string; headers?: Record<string, string> }> = [];
  if (driveId) {
    if (googleDriveAccessToken) {
      candidates.push({
        url: `https://www.googleapis.com/drive/v3/files/${driveId}?alt=media`,
        headers: { Authorization: `Bearer ${googleDriveAccessToken}` },
      });
    }
    candidates.push({
      url: `https://drive.google.com/uc?export=download&id=${driveId}`,
    });
  }
  candidates.push({ url: fileUrl });

  let lastError = "Unable to fetch attachment";

  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate.url, {
        headers: candidate.headers,
      });
      if (!response.ok) {
        lastError = `Attachment fetch failed (${response.status}) for ${candidate.url}`;
        continue;
      }

      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length === 0) {
        lastError = `Attachment response was empty for ${candidate.url}`;
        continue;
      }

      const contentType = response.headers.get("content-type") || "";
      const isPdf =
        contentType.toLowerCase().includes("application/pdf") || isPdfBytes(bytes);
      if (!isPdf) {
        lastError = `Attachment is not a PDF for ${candidate.url}`;
        continue;
      }

      const fromDisposition = parseContentDispositionFilename(
        response.headers.get("content-disposition")
      );
      const guessedName = fromDisposition || guessFileNameFromUrl(fileUrl, fallbackName);
      const fileName = guessedName.toLowerCase().endsWith(".pdf")
        ? guessedName
        : `${guessedName}.pdf`;

      return {
        filename: fileName,
        type: "application/pdf",
        content: bytesToBase64(bytes),
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Attachment fetch error";
    }
  }

  throw new Error(lastError);
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
    const testMode = Boolean(payload.testMode);
    const requestedTestEmail = String(payload.testEmail || "").trim();

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
        { success: false, error: `Order lookup failed: no matching order for ${lookup}` },
        400
      );
    }

    if (!order.email) {
      return jsonResponse(
        { success: false, error: "Order has no customer email address" },
        400
      );
    }

    const ticketFiles = Array.isArray(order.ticket_files) ? order.ticket_files : [];
    if (!ticketFiles.length) {
      return jsonResponse(
        { success: false, error: "No ticket PDFs found for this order" },
        400
      );
    }

    const attachments = [];
    for (let i = 0; i < ticketFiles.length; i += 1) {
      const fileUrl = String(ticketFiles[i] || "").trim();
      if (!fileUrl) continue;
      attachments.push(await fetchAttachment(fileUrl, i));
    }

    if (!attachments.length) {
      return jsonResponse(
        { success: false, error: "No valid ticket PDF attachments could be prepared" },
        400
      );
    }

    const downloadSection = payload.downloadLink
      ? `<p><a href="${payload.downloadLink}" target="_blank" rel="noopener noreferrer">Download your ticket</a></p>`
      : "";

    const destinationEmail = testMode
      ? requestedTestEmail || archiveBcc
      : order.email;
    const bccEmail =
      !testMode && archiveBcc && archiveBcc.toLowerCase() !== destinationEmail.toLowerCase()
        ? archiveBcc
        : null;

    if (!destinationEmail) {
      return jsonResponse(
        { success: false, error: "No destination email available for send" },
        400
      );
    }

    const subject = `Your ${order.tour || "tour"} Ticket is Ready`;
    const html = `
      <h2>Your ${order.tour || "tour"} tickets</h2>
      <p>Hi ${order.first_name || "there"},</p>
      <p>Your booking is confirmed. Your ticket PDF is attached to this email.</p>
      ${downloadSection}
      <p>Order ID: ${order.order_id}</p>
      <p>Thanks,<br/>Via Nova Tours</p>
    `;

    await sendEmail({
      to: destinationEmail,
      bcc: bccEmail,
      subject,
      html,
      attachments,
    });

    const communicationEntry = {
      type: testMode ? "ticket_email_test" : "ticket_email",
      sent_at: new Date().toISOString(),
      to: destinationEmail,
      subject,
      sent_by: auth.context.user.email || auth.context.user.id,
      bcc: bccEmail,
      attachment_count: attachments.length,
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

