import { jsonResponse } from "./cors.ts";
import { supabaseAdmin } from "./supabase.ts";

export type AuthContext = {
  user: {
    id: string;
    email?: string;
    role: string;
    raw: Record<string, unknown>;
  };
};

const normalizeToken = (raw: string | null) => {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^bearer\s+/i.test(trimmed)) {
    return trimmed.replace(/^bearer\s+/i, "").trim() || null;
  }
  return trimmed;
};

const getBearerToken = (req: Request) => {
  const forwardedUserToken = normalizeToken(req.headers.get("x-user-jwt"));
  if (forwardedUserToken) {
    return forwardedUserToken;
  }

  const authorization = req.headers.get("authorization") || "";
  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }
  return token;
};

const getRoleFromMetadata = (user: any) => {
  return (
    user?.app_metadata?.role ||
    user?.user_metadata?.role ||
    user?.role ||
    null
  );
};

const getProfileRole = async (userId: string) => {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return null;
  }
  return data?.role || null;
};

export const getRequestUser = async (req: Request): Promise<AuthContext | null> => {
  const token = getBearerToken(req);
  if (!token) {
    return null;
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    return null;
  }

  const rawUser = data.user as any;
  const metadataRole = getRoleFromMetadata(rawUser);
  const profileRole = metadataRole || (await getProfileRole(rawUser.id));

  return {
    user: {
      id: rawUser.id,
      email: rawUser.email,
      role: profileRole || "user",
      raw: rawUser,
    },
  };
};

export const requireAuthenticated = async (
  req: Request
): Promise<{ ok: true; context: AuthContext } | { ok: false; response: Response }> => {
  const context = await getRequestUser(req);
  if (!context) {
    return {
      ok: false,
      response: jsonResponse(
        { success: false, error: "Unauthorized" },
        401
      ),
    };
  }
  return { ok: true, context };
};

export const requireAdmin = async (
  req: Request
): Promise<{ ok: true; context: AuthContext } | { ok: false; response: Response }> => {
  const auth = await requireAuthenticated(req);
  if (!auth.ok) {
    return auth;
  }

  if (auth.context.user.role !== "admin") {
    return {
      ok: false,
      response: jsonResponse(
        {
          success: false,
          error: "Forbidden: admin access required",
        },
        403
      ),
    };
  }

  return auth;
};

