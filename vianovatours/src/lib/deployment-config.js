const readEnv = (key, fallback = "") => {
  const value = import.meta.env[key];
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  return value;
};

const parseList = (value, fallback = []) => {
  if (!value) {
    return fallback;
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const parseJson = (value, fallback) => {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value);
  } catch (error) {
    console.warn(`Invalid JSON value in environment variable: ${value}`);
    return fallback;
  }
};

export const env = {
  supabaseUrl: readEnv("VITE_SUPABASE_URL"),
  supabaseAnonKey: readEnv("VITE_SUPABASE_ANON_KEY"),
  supabaseStorageBucket: readEnv("VITE_SUPABASE_STORAGE_BUCKET", "uploads"),
  supabaseProfileTable: readEnv("VITE_SUPABASE_PROFILE_TABLE", "profiles"),
  supabaseProfileRoleColumn: readEnv("VITE_SUPABASE_PROFILE_ROLE_COLUMN", "role"),
  supabaseAuthProvider: readEnv("VITE_SUPABASE_AUTH_PROVIDER"),
  loginUrl: readEnv("VITE_LOGIN_URL"),
  postLogoutRedirectUrl: readEnv("VITE_POST_LOGOUT_REDIRECT_URL", "/"),
  adminHosts: parseList(
    readEnv("VITE_ADMIN_HOSTS"),
    ["backend.vianovatours.com", "localhost", "127.0.0.1"]
  ),
  mainSiteHosts: parseList(
    readEnv("VITE_MAIN_SITE_HOSTS"),
    ["vianovatours.com", "www.vianovatours.com", "localhost", "127.0.0.1"]
  ),
  functionMap: parseJson(readEnv("VITE_SUPABASE_FUNCTION_MAP"), {}),
  tableMap: parseJson(readEnv("VITE_SUPABASE_TABLE_MAP"), {}),
};

