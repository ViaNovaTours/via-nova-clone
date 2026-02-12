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
  InvokeLLM: "invoke-llm",
};

const toKebabCase = (value) =>
  String(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();

const isFunctionMissingError = (error) => {
  const message = `${error?.message || ""} ${error?.details || ""}`;
  return /not found|function .* does not exist|404|edge function/i.test(message);
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

const withResponseError = (legacyName, functionName, error) => {
  const normalizedError = new Error(
    `Function "${legacyName}" failed via "${functionName}": ${error.message}`
  );
  normalizedError.status = error.status;
  normalizedError.details = error.details;
  normalizedError.hint = error.hint;
  throw normalizedError;
};

export const invokeSupabaseFunction = async (legacyName, payload = {}) => {
  const client = getSupabaseClient();
  const candidates = getFunctionCandidates(legacyName);
  let lastError = null;

  for (const functionName of candidates) {
    const { data, error } = await client.functions.invoke(functionName, {
      body: payload ?? {},
    });

    if (error) {
      if (isFunctionMissingError(error)) {
        lastError = error;
        continue;
      }
      withResponseError(legacyName, functionName, error);
    }

    return {
      data,
      functionName,
    };
  }

  const tried = candidates.join(", ");
  throw new Error(
    `Function "${legacyName}" is not deployed in Supabase. Tried: ${tried}.`
  );
};

