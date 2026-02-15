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

const getRoleFromMetadata = (user: any) => {
  const raw =
    user?.app_metadata?.role ||
    user?.user_metadata?.role ||
    user?.role ||
    null;
  if (typeof raw !== "string") return null;
  const role = raw.trim().toLowerCase();
  if (!role) return null;
  if (["authenticated", "anon", "service_role"].includes(role)) {
    return null;
  }
  return role;
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
  const role = String(data?.role || "").trim().toLowerCase();
  return role || null;
};

export const getRequestUser = async (req: Request): Promise<AuthContext | null> => {
  const token = getRequestToken(req);
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

  if (String(auth.context.user.role || "").trim().toLowerCase() !== "admin") {
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

