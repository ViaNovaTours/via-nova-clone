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
const defaultFromName = Deno.env.get("SENDGRID_FROM_NAME") || "Via Nova Tours";
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
  fromName,
  subject,
  html,
  attachments,
}: {
  to: string;
  bcc?: string | null;
  fromName: string;
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
      from: { email: fromEmail, name: fromName || defaultFromName },
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

const normalizeTourName = (value: string | null | undefined) =>
  String(value || "")
    .replace(/\s+tour$/i, "")
    .trim();

const formatTourDate = (value: string | null | undefined) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const escapeHtml = (input: unknown) =>
  String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const buildTicketEmailHtml = ({
  customerName,
  tourName,
  tourDate,
  tourTime,
  location,
  recommendedTours,
  downloadLink,
}: {
  customerName: string;
  tourName: string;
  tourDate: string;
  tourTime: string;
  location: string;
  recommendedTours: Array<{
    tour_name: string;
    domain: string;
    hero_image_url?: string | null;
    hero_subtitle?: string | null;
    description?: string | null;
  }>;
  downloadLink?: string;
}) => {
  const recommendedSection =
    recommendedTours.length > 0
      ? `
    <table role="presentation" style="width: 100%; margin-top: 40px;">
      <tr>
        <td style="padding: 20px; background-color: #f7fafc;">
          <h2 style="color: #2d3748; font-size: 22px; font-weight: bold; text-align: center; margin-bottom: 30px;">
            You might also like these tours
          </h2>
          <table role="presentation" style="width: 100%;">
            <tr>
              ${recommendedTours
                .map((tour) => {
                  const width = Math.floor(100 / recommendedTours.length);
                  const subtitle = tour.hero_subtitle || tour.description || "";
                  const image = tour.hero_image_url
                    ? `<img src="${escapeHtml(
                        tour.hero_image_url
                      )}" alt="${escapeHtml(
                        tour.tour_name
                      )}" style="width: 100%; height: 180px; object-fit: cover; display: block;" />`
                    : "";
                  return `
                <td style="padding: 10px; vertical-align: top; width: ${width}%;">
                  <table role="presentation" style="width: 100%; background-color: white; border-radius: 8px; overflow: hidden;">
                    <tr><td style="padding: 0;">${image}</td></tr>
                    <tr>
                      <td style="padding: 20px;">
                        <h3 style="color: #2d3748; font-size: 18px; font-weight: bold; margin: 0 0 10px 0;">${escapeHtml(
                          tour.tour_name
                        )}</h3>
                        <p style="color: #4a5568; font-size: 14px; line-height: 1.6; margin: 0 0 15px 0;">
                          ${escapeHtml(String(subtitle).slice(0, 140))}
                        </p>
                        <a href="https://${escapeHtml(
                          tour.domain
                        )}" target="_blank" style="display: inline-block; background-color: #4c51bf; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 14px;">
                          Book Now
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>`;
                })
                .join("")}
            </tr>
          </table>
        </td>
      </tr>
    </table>`
      : "";

  const locationBlock = location
    ? `<p style="color: #2d3748; font-size: 14px; margin: 0 0 10px 0;">
        <strong>Location:</strong>
        <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          location
        )}" target="_blank" style="color: #4c51bf; text-decoration: none; margin-left: 5px;">
          📍 ${escapeHtml(location)}
        </a>
      </p>`
    : "";

  const dateBlock = tourDate
    ? `<p style="color: #2d3748; font-size: 14px; margin: 0;">
        <strong>Date:</strong> ${escapeHtml(tourDate)} ${escapeHtml(tourTime || "")}
      </p>`
    : "";

  const downloadBlock = downloadLink
    ? `
      <div style="text-align: center; margin-bottom: 30px;">
        <a href="${escapeHtml(
          downloadLink
        )}" target="_blank" style="display: inline-block; background-color: #10b981; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
          📥 Download Ticket
        </a>
      </div>`
    : "";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Ticket</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f7fafc;">
  <table role="presentation" style="width: 100%; max-width: 600px; margin: 0 auto; background-color: white;">
    <tr>
      <td style="background-color: #4c51bf; padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Your Ticket is Below</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px;">
        <p style="color: #2d3748; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
          Hello ${escapeHtml(customerName)},
        </p>
        <p style="color: #2d3748; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
          Here is your ticket — we've attached it as a PDF for your convenience.<br>
          You can also view the PDF on your mobile phone at ${escapeHtml(
            tourName
          )}, where it will be accepted at the gate.
        </p>
        <p style="color: #2d3748; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
          Remember: your tickets are valid during your selected date and time slot on the ticket.
        </p>
        ${downloadBlock}
        <table role="presentation" style="width: 100%; background-color: #edf2f7; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
          <tr><td>${locationBlock}${dateBlock}</td></tr>
        </table>
        <p style="color: #2d3748; font-size: 16px; line-height: 1.6; margin: 0;">
          Thank you for your booking, and enjoy your visit!
        </p>
      </td>
    </tr>
    ${recommendedSection}
    <tr>
      <td style="background-color: #2d3748; padding: 30px; text-align: center;">
        <p style="color: #a0aec0; font-size: 12px; margin: 0;">
          © ${new Date().getFullYear()} Via Nova Tours. All rights reserved.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
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

    const destinationEmail = testMode
      ? requestedTestEmail || archiveBcc
      : order.email;

    if (!destinationEmail) {
      return jsonResponse(
        { success: false, error: "No destination email available for send" },
        400
      );
    }
    const destinationEmailNormalized = String(destinationEmail).toLowerCase();
    const bccEmail =
      !testMode && archiveBcc && archiveBcc.toLowerCase() !== destinationEmailNormalized
        ? archiveBcc
        : null;

    const normalizedOrderTour = normalizeTourName(order.tour || "");
    const { data: toursData, error: toursError } = await supabase
      .from("tours")
      .select("name, physical_address, recommended_tours");
    if (toursError) {
      return jsonResponse({ success: false, error: toursError.message }, 500);
    }

    const tourRows = Array.isArray(toursData) ? toursData : [];
    const matchedTour = normalizedOrderTour
      ? tourRows.find(
          (tour) =>
            normalizeTourName(tour?.name || "").toLowerCase() ===
            normalizedOrderTour.toLowerCase()
        ) ||
        tourRows.find(
          (tour) =>
            normalizeTourName(tour?.name || "")
              .toLowerCase()
              .includes(normalizedOrderTour.toLowerCase()) ||
            normalizedOrderTour
              .toLowerCase()
              .includes(normalizeTourName(tour?.name || "").toLowerCase())
        )
      : null;

    const recommendedTourNames = Array.isArray(matchedTour?.recommended_tours)
      ? matchedTour.recommended_tours
          .map((name: unknown) => String(name || "").trim())
          .filter(Boolean)
      : [];

    let recommendedTours: Array<{
      tour_name: string;
      domain: string;
      hero_image_url?: string | null;
      hero_subtitle?: string | null;
      description?: string | null;
    }> = [];

    if (recommendedTourNames.length) {
      const { data: landingData, error: landingError } = await supabase
        .from("tour_landing_pages")
        .select("tour_name, domain, hero_image_url, hero_subtitle, description, is_active")
        .eq("is_active", true)
        .in("tour_name", recommendedTourNames);
      if (landingError) {
        return jsonResponse({ success: false, error: landingError.message }, 500);
      }

      const landingRows = Array.isArray(landingData) ? landingData : [];
      recommendedTours = recommendedTourNames
        .map((name) => {
          const page = landingRows.find(
            (row) =>
              normalizeTourName(row?.tour_name || "").toLowerCase() ===
              normalizeTourName(name).toLowerCase()
          );
          if (!page?.domain) return null;
          return {
            tour_name: normalizeTourName(page.tour_name || name) || name,
            domain: String(page.domain || "").trim(),
            hero_image_url: page.hero_image_url || null,
            hero_subtitle: page.hero_subtitle || null,
            description: page.description || null,
          };
        })
        .filter(Boolean) as Array<{
          tour_name: string;
          domain: string;
          hero_image_url?: string | null;
          hero_subtitle?: string | null;
          description?: string | null;
        }>;
    }

    const tourName = normalizedOrderTour || "your tour";
    const tourDate = formatTourDate(order.tour_date);
    const tourTime = String(order.tour_time || "").trim();
    const location = String(matchedTour?.physical_address || "").trim();
    const customerName = `${String(order.first_name || "").trim()} ${String(
      order.last_name || ""
    ).trim()}`.trim() || "there";
    const senderName = tourName || defaultFromName;

    const subject = `Your ${tourName} Ticket is Attached`;
    const html = buildTicketEmailHtml({
      customerName,
      tourName,
      tourDate,
      tourTime,
      location,
      recommendedTours,
      downloadLink: payload.downloadLink,
    });

    await sendEmail({
      to: destinationEmail,
      bcc: bccEmail,
      fromName: senderName,
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
      from_name: senderName,
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

