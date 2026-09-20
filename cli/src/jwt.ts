/**
 * Pulls the `session_id` claim out of a Supabase access token. Mirrors
 * web/src/lib/cliAuth.ts's decodeJwtSessionId — signature isn't verified
 * since nothing security-sensitive depends on this value (it's only used to
 * look up this CLI's own cli_sessions row for the cooperative revocation
 * check; see supabase/migrations/0007_cli_sessions.sql).
 */
export function decodeJwtSessionId(accessToken: string): string | null {
  try {
    const payload = accessToken.split(".")[1];
    const json = Buffer.from(
      payload.replace(/-/g, "+").replace(/_/g, "/"),
      "base64",
    ).toString("utf8");
    const claims = JSON.parse(json);
    return typeof claims.session_id === "string" ? claims.session_id : null;
  } catch {
    return null;
  }
}
