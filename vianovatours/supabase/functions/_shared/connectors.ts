const toSnakeUpper = (value: string) =>
  value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .toUpperCase();

const decodeJsonJwt = (token: string) => {
  const [, payload] = token.split(".");
  if (!payload) return null;
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  try {
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
};

const isTokenLikelyExpired = (token: string) => {
  const payload = decodeJsonJwt(token);
  const exp = payload?.exp;
  if (!exp || typeof exp !== "number") return false;
  return Date.now() / 1000 >= exp - 120;
};

const refreshGoogleAccessToken = async () => {
  const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GOOGLE_OAUTH_REFRESH_TOKEN");

  if (!clientId || !clientSecret || !refreshToken) {
    return null;
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Google token refresh failed: ${details}`);
  }

  const tokenData = await response.json();
  return tokenData?.access_token || null;
};

export const getConnectorAccessToken = async (provider: string) => {
  const normalizedProvider = provider.toLowerCase();
  const providerKey = toSnakeUpper(normalizedProvider);
  const candidates = [
    `${providerKey}_ACCESS_TOKEN`,
    `${providerKey}_TOKEN`,
  ];

  if (normalizedProvider === "googledrive") {
    candidates.push("GOOGLEDRIVE_ACCESS_TOKEN", "GOOGLE_DRIVE_ACCESS_TOKEN");
  }
  if (normalizedProvider === "gmail") {
    candidates.push("GMAIL_ACCESS_TOKEN");
  }
  if (normalizedProvider === "slack") {
    candidates.push("SLACK_BOT_TOKEN", "SLACK_ACCESS_TOKEN");
  }

  for (const key of candidates) {
    const value = Deno.env.get(key);
    if (value) {
      if (
        (normalizedProvider === "gmail" || normalizedProvider === "googledrive") &&
        isTokenLikelyExpired(value)
      ) {
        break;
      }
      return value;
    }
  }

  if (normalizedProvider === "gmail" || normalizedProvider === "googledrive") {
    const refreshed = await refreshGoogleAccessToken();
    if (refreshed) {
      return refreshed;
    }
  }

  throw new Error(`No access token configured for connector: ${provider}`);
};

