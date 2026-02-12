import { createEntityApi } from "@/api/entityClient";
import { env } from "@/lib/deployment-config";
import { invokeSupabaseFunction } from "@/lib/function-invoker";
import { uploadFileToSupabaseStorage } from "@/lib/storage-uploader";
import { getSupabaseClient } from "@/lib/supabaseClient";

const entityProxy = new Proxy(
  {},
  {
    get(_target, property) {
      if (property === "Query") {
        return {
          from(entityName) {
            return createEntityApi(entityName);
          },
        };
      }
      return createEntityApi(String(property));
    },
  }
);

const withRole = async (user) => {
  if (!user) return null;

  const metadataRole = user?.app_metadata?.role || user?.user_metadata?.role;
  if (metadataRole) {
    return { ...user, role: metadataRole };
  }

  try {
    const client = getSupabaseClient();
    const roleColumn = env.supabaseProfileRoleColumn;
    const { data, error } = await client
      .from(env.supabaseProfileTable)
      .select(roleColumn)
      .eq("id", user.id)
      .maybeSingle();

    if (!error && data?.[roleColumn]) {
      return { ...user, role: data[roleColumn] };
    }
  } catch (error) {
    console.warn("Unable to enrich user role from profile table:", error);
  }

  return { ...user, role: "user" };
};

const toAuthRequiredError = () => {
  const error = new Error("Authentication required");
  error.status = 401;
  return error;
};

const addRedirectParam = (url, redirectTo) => {
  const target = new URL(url, window.location.origin);
  if (redirectTo) {
    target.searchParams.set("redirectTo", redirectTo);
  }
  return target.toString();
};

const auth = {
  async me() {
    const client = getSupabaseClient();
    const {
      data: { user },
      error,
    } = await client.auth.getUser();

    if (error || !user) {
      throw toAuthRequiredError();
    }

    return withRole(user);
  },

  async logout(redirectTo = null) {
    const client = getSupabaseClient();
    await client.auth.signOut();
    const target = redirectTo || env.postLogoutRedirectUrl;
    if (target) {
      window.location.assign(target);
    }
  },

  async redirectToLogin(redirectTo = window.location.href) {
    const client = getSupabaseClient();

    if (env.loginUrl) {
      window.location.assign(addRedirectParam(env.loginUrl, redirectTo));
      return;
    }

    if (env.supabaseAuthProvider) {
      await client.auth.signInWithOAuth({
        provider: env.supabaseAuthProvider,
        options: {
          redirectTo,
        },
      });
      return;
    }

    window.location.assign(addRedirectParam("/auth", redirectTo));
  },
};

const functions = {
  async invoke(functionName, payload = {}) {
    const { data } = await invokeSupabaseFunction(functionName, payload);
    return { data };
  },
};

const integrations = {
  Core: {
    async UploadFile({ file }) {
      return uploadFileToSupabaseStorage(file);
    },

    async SendEmail(payload) {
      const normalizedPayload = {
        ...payload,
        text: payload?.text || payload?.body,
      };
      const { data } = await invokeSupabaseFunction(
        "sendEmailViaSendGrid",
        normalizedPayload
      );
      return data;
    },

    async InvokeLLM(payload) {
      const { data } = await invokeSupabaseFunction("InvokeLLM", payload);
      return data;
    },

    async SendSMS() {
      throw new Error("SendSMS is not configured for Supabase.");
    },

    async GenerateImage() {
      throw new Error("GenerateImage is not configured for Supabase.");
    },

    async ExtractDataFromUploadedFile() {
      throw new Error(
        "ExtractDataFromUploadedFile is not configured for Supabase."
      );
    },
  },
};

export const base44 = {
  auth,
  entities: entityProxy,
  functions,
  integrations,
  appLogs: {
    async logUserInApp(pageName) {
      try {
        await invokeSupabaseFunction("logUserInApp", { pageName });
      } catch (error) {
        // Activity logging should never break UX.
      }
    },
  },
};
