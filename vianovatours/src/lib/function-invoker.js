import { env } from "@/lib/deployment-config";
import { getSupabaseClient } from "@/lib/supabaseClient";

const LEGACY_FUNCTION_NAME_MAP = {
  getStripePublishableKey: "get-stripe-publishable-key",
  processLandingPageBooking: "process-landing-page-booking",
  generateTourContent: "generate-tour-content",
  sendEmailViaSendGrid: "send-email-via-sendgrid",
  sendTicketEmail: "send-ticket-email",
  sendReservedEmail: "send-reserved-email",
  uploadToGoogleDrive: "upload-to-google-drive",
  updateSpecificOrderStatus: "update-specific-order-status",
  fetchWooCommerceOrders: "fetch-woocommerce-orders",
  fetchGmailThreads: "fetch-gmail-threads",
  migrateWooCommerceCredentials: "migrate-woocommerce-credentials",
  calculateProfitsForAllOrders: "calculate-profits-for-all-orders",
  fixCompleteStatus: "fix-complete-status",
  wooCommerceWebhook: "woo-commerce-webhook",
  generateSitemap: "generate-sitemap",
  generateRobotsTxt: "generate-robots-txt",
  sendgridWebhook: "sendgrid-webhook",
  logEmailCommunication: "log-email-communication",
  legacyMaintenance: "legacy-maintenance",
  InvokeLLM: "invoke-llm",
};

const toKebabCase = (value) =>
  String(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();

const isFunctionMissingError = (error) => {
  const status = error?.context?.status || error?.status;
  if (status === 404) {
    return true;
  }

  const message = `${error?.message || ""} ${error?.details || ""}`;
  return /not found|function .* does not exist|404/i.test(message);
};

const getFunctionCandidates = (legacyName) => {
  const envMapped = env.functionMap?.[legacyName];
  const mapped = LEGACY_FUNCTION_NAME_MAP[legacyName];
  const kebab = toKebabCase(legacyName);

  return [envMapped, mapped, legacyName, kebab].filter(
    (candidate, index, array) =>
      Boolean(candidate) && array.indexOf(candidate) === index
  );
};

const resolveFunctionErrorMessage = async (error) => {
  const fallback = error?.message || "Unknown function invocation error";
  const response = error?.context;

  if (!response || typeof response.clone !== "function") {
    return fallback;
  }

  try {
    const json = await response.clone().json();
    const combinedMessage = `${json?.error || ""} ${json?.message || ""}`.trim();
    if (/base44-app-id header is required/i.test(combinedMessage)) {
      return (
        "This Supabase function is still running legacy Base44 code. " +
        "Redeploy the function with the migrated Supabase implementation."
      );
    }
    if (json?.error) {
      return String(json.error);
    }
    if (json?.message) {
      return String(json.message);
    }
  } catch (jsonError) {
    // Continue to text fallback.
  }

  try {
    const text = await response.clone().text();
    if (text) {
      return text.slice(0, 400);
    }
  } catch (textError) {
    // Keep fallback.
  }

  return fallback;
};

const withResponseError = async (legacyName, functionName, error) => {
  const resolvedMessage = await resolveFunctionErrorMessage(error);
  const normalizedError = new Error(
    `Function "${legacyName}" failed via "${functionName}": ${resolvedMessage}`
  );
  normalizedError.status = error.status;
  normalizedError.details = error.details;
  normalizedError.hint = error.hint;
  normalizedError.context = error.context;
  throw normalizedError;
};

export const invokeSupabaseFunction = async (legacyName, payload = {}) => {
  const client = getSupabaseClient();
  const candidates = getFunctionCandidates(legacyName);
  let lastError = null;

  const getAccessToken = async () => {
    try {
      const {
        data: { session },
      } = await client.auth.getSession();
      return session?.access_token || null;
    } catch (error) {
      return null;
    }
  };

  let accessToken = await getAccessToken();
  const gatewayToken = env.supabaseAnonKey || accessToken || null;
  if (gatewayToken) {
    client.functions.setAuth(gatewayToken);
  }

  const invokeWithHeaders = async (functionName, body, includeUserJwt = true) =>
    client.functions.invoke(functionName, {
      body,
      headers: includeUserJwt && accessToken
        ? {
            "x-user-jwt": accessToken,
          }
        : undefined,
    });

  for (const functionName of candidates) {
    let { data, error } = await invokeWithHeaders(
      functionName,
      payload ?? {},
      true
    );

    if (
      error &&
      /Failed to send a request to the Edge Function/i.test(error?.message || "")
    ) {
      // Some functions may not yet allow x-user-jwt in CORS.
      // Retry without custom headers to avoid transport-level failure.
      ({ data, error } = await invokeWithHeaders(functionName, payload ?? {}, false));
    }

    if (error) {
      const message = `${error?.message || ""} ${error?.details || ""}`;
      if (/invalid jwt/i.test(message)) {
        try {
          const {
            data: { session: refreshedSession },
          } = await client.auth.refreshSession();
          if (refreshedSession?.access_token) {
            accessToken = refreshedSession.access_token;
            ({ data, error } = await invokeWithHeaders(
              functionName,
              payload ?? {}
            ));
          }
        } catch (refreshError) {
          // Keep original error path below.
        }
      }
    }

    if (error) {
      if (isFunctionMissingError(error)) {
        lastError = error;
        continue;
      }
      await withResponseError(legacyName, functionName, error);
    }

    return {
      data,
      functionName,
    };
  }

  const tried = candidates.join(", ");
  if (legacyName !== "legacyMaintenance") {
    const { data, error } = await invokeWithHeaders("legacy-maintenance", {
      functionName: legacyName,
      payload: payload ?? {},
    });

    if (!error) {
      if (data?.success === false && data?.error) {
        throw new Error(
          `Function "${legacyName}" failed via "legacy-maintenance": ${data.error}`
        );
      }
      return {
        data,
        functionName: "legacy-maintenance",
      };
    }
  }

  if (lastError) {
    const message = `${lastError?.message || ""} ${lastError?.details || ""}`;
    if (/invalid jwt/i.test(message)) {
      throw new Error(
        'Supabase rejected the JWT for function calls. Check VITE_SUPABASE_ANON_KEY and ensure you are logged in with a valid Supabase session.'
      );
    }
  }

  throw new Error(
    `Function "${legacyName}" is not deployed in Supabase. Tried: ${tried}.`
  );
};

