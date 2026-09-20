// Support for the browser-based `feedbackkit login` flow: the CLI opens
// /cli-auth?port=...&state=...&label=... in the user's browser, and this
// page hands over the user's *existing* Supabase session rather than
// minting a separate credential type — see cli/README.md and
// supabase/migrations/0007_cli_sessions.sql for the full flow and why.

const PENDING_KEY = "feedbackkit:cli-auth-pending";

export interface PendingCliAuth {
  port: string;
  state: string;
  label: string;
}

/**
 * The OAuth `redirectTo` must stay a fixed, allow-listed URL (`/login`), so
 * it can't carry the CLI's port/state through the full-page redirect to
 * GitHub and back. Stashing them in sessionStorage survives that round trip
 * without needing a hosted Supabase auth config change for every new query
 * param this flow might ever need.
 */
export function stashPendingCliAuth(pending: PendingCliAuth) {
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
}

/**
 * Reads the pending CLI auth request, if any, without clearing it — safe to
 * call from render (including React StrictMode's intentional double-render):
 * a destructive read here would make the second invocation see it already
 * gone and silently produce a different result. Pair with
 * `clearPendingCliAuth` from an effect once you've actually acted on it.
 */
export function peekPendingCliAuth(): PendingCliAuth | null {
  const raw = sessionStorage.getItem(PENDING_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.port === "string" && typeof parsed?.state === "string") {
      return { port: parsed.port, state: parsed.state, label: parsed.label ?? "CLI" };
    }
  } catch {
    // fall through
  }
  return null;
}

/** Idempotent — safe to call more than once (e.g. from a double-invoked effect). */
export function clearPendingCliAuth(): void {
  sessionStorage.removeItem(PENDING_KEY);
}

export function isValidCliAuthParams(port: string | null, state: string | null): port is string {
  if (!port || !state) return false;
  const portNum = Number(port);
  return Number.isInteger(portNum) && portNum > 0 && portNum < 65536 && state.length >= 8;
}

/**
 * Pulls the `session_id` claim out of a Supabase access token, purely for
 * display in the "connected CLIs" list — decoded client-side, signature not
 * verified, since nothing security-sensitive depends on this value (see the
 * migration's comment on why revocation here is cooperative, not
 * cryptographic).
 */
export function decodeJwtSessionId(accessToken: string): string | null {
  try {
    const payload = accessToken.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const claims = JSON.parse(json);
    return typeof claims.session_id === "string" ? claims.session_id : null;
  } catch {
    return null;
  }
}
