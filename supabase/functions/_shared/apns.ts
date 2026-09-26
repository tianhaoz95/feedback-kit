// Apple Push Notification service client for the send-push function.
//
// Token-based auth: a short-lived ES256 JWT signed with an APNs auth key
// (.p8) from the Apple Developer account. Returns null (never throws) from
// getApnsConfig() while the secrets aren't set, the same dormant-by-default
// pattern as getStripe() in stripe.ts.
//
// Secrets (supabase secrets set …):
//   APNS_KEY_ID       the key's 10-character id
//   APNS_TEAM_ID      the Apple Developer team id
//   APNS_PRIVATE_KEY  the .p8 file's contents (PEM, newlines kept or as \n)
//   APNS_BUNDLE_ID    optional, defaults to the iOS Portal's bundle id

export interface ApnsConfig {
  keyId: string;
  teamId: string;
  privateKeyPem: string;
  bundleId: string;
}

export const DEFAULT_APNS_BUNDLE_ID = "com.feedbackkit.developer";

export function getApnsConfig(): ApnsConfig | null {
  const keyId = Deno.env.get("APNS_KEY_ID");
  const teamId = Deno.env.get("APNS_TEAM_ID");
  const privateKeyPem = Deno.env.get("APNS_PRIVATE_KEY");
  if (!keyId || !teamId || !privateKeyPem) return null;
  return {
    keyId,
    teamId,
    privateKeyPem: privateKeyPem.replace(/\\n/g, "\n"),
    bundleId: Deno.env.get("APNS_BUNDLE_ID") || DEFAULT_APNS_BUNDLE_ID,
  };
}

function base64url(bytes: Uint8Array | string): string {
  const raw = typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes;
  let binary = "";
  for (const b of raw) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const body = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return await crypto.subtle.importKey("pkcs8", der, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

// APNs accepts a provider token for up to an hour and rejects refreshing it
// more than every 20 minutes, so one is reused across requests.
let cachedToken: { value: string; issuedAt: number } | null = null;

async function providerToken(config: ApnsConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && now - cachedToken.issuedAt < 45 * 60) return cachedToken.value;

  const header = base64url(JSON.stringify({ alg: "ES256", kid: config.keyId }));
  const claims = base64url(JSON.stringify({ iss: config.teamId, iat: now }));
  const key = await importPrivateKey(config.privateKeyPem);
  // WebCrypto's ECDSA signature is already the raw r||s form JWS expects.
  const signature = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(`${header}.${claims}`)),
  );
  const value = `${header}.${claims}.${base64url(signature)}`;
  cachedToken = { value, issuedAt: now };
  return value;
}

export interface ApnsResult {
  ok: boolean;
  status: number;
  reason?: string;
  /** The token is dead (app deleted, or wrong environment) and should be forgotten. */
  unregistered: boolean;
}

export async function sendApns(
  config: ApnsConfig,
  deviceToken: string,
  environment: "sandbox" | "production",
  payload: Record<string, unknown>,
  options: { collapseId?: string } = {},
): Promise<ApnsResult> {
  const host = environment === "sandbox" ? "api.sandbox.push.apple.com" : "api.push.apple.com";
  const headers: Record<string, string> = {
    authorization: `bearer ${await providerToken(config)}`,
    "apns-topic": config.bundleId,
    "apns-push-type": "alert",
    "apns-priority": "10",
    "content-type": "application/json",
  };
  if (options.collapseId) headers["apns-collapse-id"] = options.collapseId.slice(0, 64);

  const res = await fetch(`https://${host}/3/device/${deviceToken}`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  if (res.ok) return { ok: true, status: res.status, unregistered: false };

  const reason = ((await res.json().catch(() => ({}))) as { reason?: string }).reason;
  const unregistered = res.status === 410 || reason === "BadDeviceToken" || reason === "Unregistered";
  return { ok: false, status: res.status, reason, unregistered };
}
