import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { clearCredentials, loadCredentials, saveCredentials } from "./config.js";
import { decodeJwtSessionId } from "./jwt.js";

export class NotLoggedInError extends Error {
  constructor(detail?: string) {
    super(`Not logged in. Run \`feedbackkit login\` first.${detail ? ` (${detail})` : ""}`);
  }
}

export class SessionRevokedError extends Error {
  constructor() {
    super("This CLI's access was revoked from the dashboard. Run `feedbackkit login` again.");
  }
}

/**
 * Returns a Supabase client authenticated as whoever ran `feedbackkit
 * login` — the real dashboard session (see cli/README.md and
 * web/src/pages/CliAuthPage.tsx for how it gets here), so RLS enforces
 * exactly the same access a signed-in browser would have. No custom
 * authorization logic lives here on purpose.
 */
export async function getAuthenticatedClient(): Promise<SupabaseClient> {
  const credentials = loadCredentials();
  if (!credentials) throw new NotLoggedInError();

  const client = createClient(credentials.supabaseUrl, credentials.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const expiresSoon =
    credentials.expiresAt === null || credentials.expiresAt * 1000 < Date.now() + 60_000;

  let accessToken = credentials.accessToken;

  if (expiresSoon) {
    const { data, error } = await client.auth.refreshSession({
      refresh_token: credentials.refreshToken,
    });
    if (error || !data.session) {
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
