const LOCAL_HOSTS = ["localhost", "127.0.0.1"] as const;
const DEFAULT_PRODUCTION_HOSTS = ["duskly.site", "www.duskly.site"] as const;

function hostnameFromOrigin(origin: string | undefined): string | undefined {
  if (!origin?.trim()) return undefined;
  try {
    return new URL(origin).hostname || undefined;
  } catch {
    return undefined;
  }
}

function isLoopback(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname.includes(":");
}

/** Hostnames Angular SSR should accept for the Host header, derived from WEB_ORIGIN. */
export function allowedHostsFromWebOrigin(origin: string | undefined): string[] {
  const hosts = new Set<string>(LOCAL_HOSTS);
  const hostname = hostnameFromOrigin(origin);
  if (!hostname) {
    for (const host of DEFAULT_PRODUCTION_HOSTS) hosts.add(host);
    return [...hosts];
  }
  hosts.add(hostname);
  if (!isLoopback(hostname)) {
    if (hostname.startsWith("www.")) {
      const apex = hostname.slice(4);
      if (apex) hosts.add(apex);
    } else {
      hosts.add(`www.${hostname}`);
    }
  }
  return [...hosts];
}
