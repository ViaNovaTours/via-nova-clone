import { env } from "@/lib/deployment-config";

const normalizeHost = (host) => (host || "").toLowerCase().split(":")[0];

const matchesHostPattern = (host, pattern) => {
  if (!pattern) return false;
  const normalizedHost = normalizeHost(host);
  const normalizedPattern = normalizeHost(pattern);

  if (normalizedPattern.startsWith("*.")) {
    const suffix = normalizedPattern.slice(2);
    return (
      normalizedHost === suffix || normalizedHost.endsWith(`.${suffix}`)
    );
  }

  return normalizedHost === normalizedPattern;
};

const hostInList = (host, hostList = []) =>
  hostList.some((pattern) => matchesHostPattern(host, pattern));

export const isAdminHost = (host = window.location.hostname) =>
  hostInList(host, env.adminHosts);

export const isMainSiteHost = (host = window.location.hostname) =>
  hostInList(host, env.mainSiteHosts);

