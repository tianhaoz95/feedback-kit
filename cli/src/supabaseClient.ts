import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { clearCredentials, loadCredentials, saveCredentials } from "./config.js";
import { decodeJwtSessionId } from "./jwt.js";

/** The hosted FeedbackKit backend; override with FEEDBACKKIT_API_URL. */
export const DEFAULT_API_URL = "https://gpucoladcyvijefdjudf.supabase.co";
/** The hosted backend's publishable key (public by design, like the dashboard's). */
export const DEFAULT_ANON_KEY = "sb_publishable_crkqEdaacVS02etk6k16ag_ATIk-8Kn";

/** What an access token is, from `access_token_info()` (0025_access_tokens_and_previews.sql). */
export interface AccessTokenInfo {
  id: string;
  name: string;
  project_id: string;
  project_name: string | null;
  /** Set when the token is limited to one report. */
  feedback_id: string | null;
  /** Every report it's limited to: several for a merged batch (0026; absent before it). */
  feedback_ids?: string[] | null;
  scopes: string[];
  expires_at: string | null;
}

/** How a client reaches the backend, for the few calls that aren't supabase-js (attach-preview). */
interface ClientContext {
  apiUrl: string;
  anonKey: string;
  token?: string;
  tokenInfo?: AccessTokenInfo;
}

const contexts = new WeakMap<SupabaseClient, ClientContext>();

export function clientContext(client: SupabaseClient): ClientContext | undefined {
  return contexts.get(client);
}

/** The access token this client acts as, or undefined for a logged-in user. */
export function tokenInfo(client: SupabaseClient): AccessTokenInfo | undefined {
  return contexts.get(client)?.tokenInfo;
}

export class InvalidTokenError extends Error {
  constructor(detail: string) {
    super(`FEEDBACKKIT_TOKEN ${detail}`);
  }
}

/**
 * A client acting as an access token (`FEEDBACKKIT_TOKEN`) instead of a
 * logged-in user: the token rides along as the `x-feedbackkit-token` header,
 * and RLS decides what it can do from its scopes, exactly as it does for a
 * member's session. No login, so it works in CI and on shared runners.
 */
async function getTokenClient(token: string): Promise<SupabaseClient> {
  if (!/^fk[rt]_[0-9a-f]{48}$/.test(token)) {
    throw new InvalidTokenError("doesn't look like a FeedbackKit access token (fkt_…).");
  }
  const apiUrl = (process.env.FEEDBACKKIT_API_URL ?? DEFAULT_API_URL).replace(/\/+$/, "");
  const anonKey = process.env.FEEDBACKKIT_ANON_KEY ?? (apiUrl === DEFAULT_API_URL ? DEFAULT_ANON_KEY : undefined);
  if (!anonKey) throw new InvalidTokenError("needs FEEDBACKKIT_ANON_KEY (the backend's publishable key) with a custom FEEDBACKKIT_API_URL.");

  const client = createClient(apiUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "x-feedbackkit-token": token } },
  });
  const { data, error } = await client.rpc("access_token_info");
  if (error) throw new InvalidTokenError(`couldn't be checked: ${error.message}`);
  if (!data) throw new InvalidTokenError("is invalid, revoked or expired.");
  contexts.set(client, { apiUrl, anonKey, token, tokenInfo: data as AccessTokenInfo });
  return client;
}

export class NotLoggedInError extends Error {
  constructor(detail?: string) {
    super(`Not logged in. Run \`feedbackkit login\` first, or set FEEDBACKKIT_TOKEN to an access token.${detail ? ` (${detail})` : ""}`);
  }
}

export class SessionRevokedError extends Error {
  constructor() {
    super("This CLI's access was revoked from the dashboard. Run `feedbackkit login` again.");
  }
}

/**
 * Returns a Supabase client authenticated as the access token in
 * FEEDBACKKIT_TOKEN if one is set, else as whoever ran `feedbackkit
 * login` — the real dashboard session (see cli/README.md and
 * web/src/pages/CliAuthPage.tsx for how it gets here), so RLS enforces
 * exactly the same access a signed-in browser would have. No custom
 * authorization logic lives here on purpose.
 */
export async function getAuthenticatedClient(): Promise<SupabaseClient> {
  const token = process.env.FEEDBACKKIT_TOKEN?.trim();
  if (token) return getTokenClient(token);

  const credentials = loadCredentials();
  if (!credentials) throw new NotLoggedInError();

  const client = createClient(credentials.supabaseUrl, credentials.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  contexts.set(client, { apiUrl: credentials.supabaseUrl, anonKey: credentials.supabaseAnonKey });

  const expiresSoon =
    credentials.expiresAt === null || credentials.expiresAt * 1000 < Date.now() + 60_000;

  let accessToken = credentials.accessToken;

  if (expiresSoon) {
    const { data, error } = await client.auth.refreshSession({
      refresh_token: credentials.refreshToken,
    });
    if (error || !data.session) {
      // Another CLI process (e.g. the MCP server `feedbackkit watch` starts for
      // its agent) may have refreshed first: refresh tokens are single-use, so
      // ours is now spent but the file holds a fresh session. Use that rather
      // than logging the user out.
      // The winner may still be writing it, so give it a moment.
      let latest = loadCredentials();
      for (let i = 0; i < 10 && latest?.refreshToken === credentials.refreshToken; i++) {
        await new Promise((r) => setTimeout(r, 200));
        latest = loadCredentials();
      }
      if (latest && latest.refreshToken !== credentials.refreshToken) {
        const { error: retryError } = await client.auth.setSession({
          access_token: latest.accessToken,
          refresh_token: latest.refreshToken,
        });
        if (!retryError) {
          await assertNotRevoked(client, latest.accessToken);
          return client;
        }
      }
      clearCredentials();
      throw new NotLoggedInError(error?.message ?? "session expired");
    }
    accessToken = data.session.access_token;
    saveCredentials({
      ...credentials,
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at ?? null,
    });
  } else {
    const { error } = await client.auth.setSession({
      access_token: credentials.accessToken,
      refresh_token: credentials.refreshToken,
    });
    if (error) throw new NotLoggedInError(error.message);
  }

  await assertNotRevoked(client, accessToken);

  return client;
}

/**
 * Cooperative-only check — see supabase/migrations/0007_cli_sessions.sql for
 * why this can't be a hard, cryptographic revoke without persisting the raw
 * access token server-side. Fails open on a read error or a missing/
 * undecodable session_id claim rather than blocking usage on a hiccup.
 */
async function assertNotRevoked(client: SupabaseClient, accessToken: string): Promise<void> {
  const sessionId = decodeJwtSessionId(accessToken);
  if (!sessionId) return;

  const { data, error } = await client
    .from("cli_sessions")
    .select("revoked_at")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) return;
  if (data?.revoked_at) {
    clearCredentials();
    throw new SessionRevokedError();
  }
}
