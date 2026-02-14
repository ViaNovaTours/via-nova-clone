import { requireAuthenticated } from "../_shared/auth.ts";
import { getConnectorAccessToken } from "../_shared/connectors.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const decodeBase64Url = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return atob(padded);
};

const extractHeader = (headers: any[], name: string) => {
  const match = (headers || []).find(
    (header) => String(header?.name || "").toLowerCase() === name.toLowerCase()
  );
  return match?.value || "";
};

const extractMessageBody = (payload: any): string => {
  if (payload?.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  if (Array.isArray(payload?.parts)) {
    const part =
      payload.parts.find((entry: any) => entry?.mimeType === "text/plain") ||
      payload.parts.find((entry: any) => entry?.mimeType === "text/html");
    if (part?.body?.data) {
      return decodeBase64Url(part.body.data);
    }
  }

  return "";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const auth = await requireAuthenticated(req);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { customerEmail } = await req.json().catch(() => ({}));
    if (!customerEmail) {
      return jsonResponse(
        { success: false, error: "Customer email required" },
        400
      );
    }

    const accessToken = await getConnectorAccessToken("gmail");
    const query = encodeURIComponent(`from:${customerEmail} OR to:${customerEmail}`);
    const searchUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=50`;

    const searchResponse = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!searchResponse.ok) {
      const details = await searchResponse.text();
      return jsonResponse(
        {
          success: false,
          error: "Failed to search Gmail",
          details,
        },
        searchResponse.status
      );
    }

    const searchData = await searchResponse.json();
    const messageIds = Array.isArray(searchData?.messages)
      ? searchData.messages.slice(0, 20)
      : [];

    if (messageIds.length === 0) {
      return jsonResponse({ success: true, threads: [] });
    }

    const messages = await Promise.all(
      messageIds.map(async (message: any) => {
        const response = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=full`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        if (!response.ok) return null;

        const payload = await response.json();
        const headers = payload?.payload?.headers || [];
        let body = extractMessageBody(payload?.payload || {});

        if (body.includes("<html") || body.includes("<div")) {
          body = body.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
        }
        if (body.length > 500) {
          body = `${body.slice(0, 500)}...`;
        }

        return {
          id: payload.id,
          threadId: payload.threadId,
          subject: extractHeader(headers, "subject"),
          from: extractHeader(headers, "from"),
          to: extractHeader(headers, "to"),
          date: payload.internalDate
            ? new Date(Number(payload.internalDate)).toISOString()
            : new Date().toISOString(),
          snippet: payload.snippet || "",
          body,
        };
      })
    );

    const threads = messages
      .filter(Boolean)
      .sort(
        (a: any, b: any) =>
          new Date(b.date).getTime() - new Date(a.date).getTime()
      );

    return jsonResponse({ success: true, threads });
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown Gmail threads fetch error",
      },
      500
    );
  }
});

