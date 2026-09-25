/**
 * `allowed_origins` entries are exact origins (`https://app.example.com`) or
 * a leading-wildcard subdomain pattern (`https://*.example.com`). An empty
 * list allows everything, and a request with no `Origin` header (native
 * apps, server-to-server) is never blocked. See 0013_web_sdk.sql.
 */
export function isOriginAllowed(origin: string | null, allowed: unknown): boolean {
  if (!origin || !Array.isArray(allowed) || allowed.length === 0) return true;
  const normalized = origin.toLowerCase().replace(/\/+$/, "");
  return allowed.some((entry) => {
    if (typeof entry !== "string") return false;
    const rule = entry.trim().toLowerCase().replace(/\/+$/, "");
    if (rule === "*" || rule === normalized) return true;
    const wildcard = rule.match(/^(https?:\/\/)\*\.(.+)$/);
    if (!wildcard) return false;
    const [, scheme, domain] = wildcard;
    return normalized.startsWith(scheme) && normalized.slice(scheme.length).endsWith(`.${domain}`);
  });
}
