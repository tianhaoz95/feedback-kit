import { getAuthenticatedClient, tokenInfo } from "../supabaseClient.js";
import { resolveProjectId } from "../loop.js";

/**
 * Project access tokens (0025_access_tokens_and_previews.sql): scoped,
 * optionally expiring, stored only as a hash. What CI uses instead of a
 * login — `release` (releases:write), and agent workflows, which issue a
 * short-lived token limited to one report for each run (tokens:issue).
 */

export const TOKEN_SCOPES = ["releases:write", "feedback:read", "feedback:write", "reporter:ask", "previews:write", "tokens:issue"] as const;
export type TokenScope = (typeof TOKEN_SCOPES)[number];

/** Same presets as the dashboard's (web/src/lib/accessTokens.ts). */
export const TOKEN_PRESETS: Record<string, TokenScope[]> = {
  ci: ["releases:write"],
  agent: ["feedback:read", "feedback:write", "reporter:ask", "previews:write", "tokens:issue"],
  read: ["feedback:read"],
};

export function parseScopes(preset: string | undefined, scopes: string[] | undefined): TokenScope[] {
  const picked = new Set<TokenScope>();
  if (preset) {
    const p = TOKEN_PRESETS[preset];
    if (!p) throw new Error(`--preset must be one of ${Object.keys(TOKEN_PRESETS).join(", ")}, not "${preset}".`);
    p.forEach((s) => picked.add(s));
  }
  for (const s of scopes ?? []) {
    if (!(TOKEN_SCOPES as readonly string[]).includes(s)) {
      throw new Error(`Unknown scope "${s}". Scopes: ${TOKEN_SCOPES.join(", ")}.`);
    }
    picked.add(s as TokenScope);
  }
  // No preset or scope: a CI release token, what `token create` always made.
  if (picked.size === 0) TOKEN_PRESETS.ci.forEach((s) => picked.add(s));
  return [...picked].sort();
}

/** "90d", "12h", "1y", "2027-01-31", or "never"/undefined (no expiry). */
export function parseExpiry(value: string | undefined, now = new Date()): Date | null {
  if (value === undefined || value === "never") return null;
  const rel = value.match(/^(\d+)([hdy])$/);
  if (rel) {
    const n = Number(rel[1]);
    const ms = { h: 3600e3, d: 86400e3, y: 365 * 86400e3 }[rel[2] as "h" | "d" | "y"];
    return new Date(now.getTime() + n * ms);
  }
  const date = new Date(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(value) && !Number.isNaN(date.getTime())) {
    if (date <= now) throw new Error("--expires must be in the future.");
    return date;
  }
  throw new Error(`--expires must be like 90d, 12h, 1y, a date (2027-01-31), or never — not "${value}".`);
}

export async function createToken(
  name: string,
  options: { project?: string; preset?: string; scope?: string[]; expires?: string },
): Promise<void> {
  const scopes = parseScopes(options.preset, options.scope);
  const expiresAt = parseExpiry(options.expires);
  const client = await getAuthenticatedClient();
  if (tokenInfo(client)) throw new Error("Create tokens as a logged-in member (unset FEEDBACKKIT_TOKEN).");
  const projectId = await resolveProjectId(client, options.project ?? process.env.FEEDBACKKIT_PROJECT_ID);
  const { data, error } = await client.rpc("create_access_token", {
    p_project_id: projectId,
    p_name: name,
    p_scopes: scopes,
    p_expires_at: expiresAt?.toISOString() ?? null,
  });
  if (error) throw new Error(error.message);
  // Token alone on stdout so it can be piped; the notes go to stderr.
  console.log(data as string);
  console.error(`Scopes: ${scopes.join(", ")}. ${expiresAt ? `Expires ${expiresAt.toISOString().slice(0, 10)}.` : "Never expires — revoke it when it's no longer needed."}`);
  console.error("Store this now — it won't be shown again. Revoke it any time from project Settings → Access tokens.");
}

interface TokenRow {
  id: string;
  name: string;
  token_prefix: string;
  scopes: string[];
  expires_at: string | null;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  parent_id: string | null;
}

export async function listTokens(options: { project?: string }): Promise<void> {
  const client = await getAuthenticatedClient();
  const projectId = await resolveProjectId(client, options.project ?? process.env.FEEDBACKKIT_PROJECT_ID);
  const { data, error } = await client
    .from("access_tokens")
    .select("id, name, token_prefix, scopes, expires_at, created_at, last_used_at, revoked_at, parent_id")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as TokenRow[];
  const tokens = rows.filter((t) => !t.parent_id);
  if (tokens.length === 0) {
    console.log("No access tokens.");
    return;
  }
  const now = Date.now();
  for (const t of tokens) {
    const state = t.revoked_at
      ? "revoked"
      : t.expires_at && new Date(t.expires_at).getTime() <= now
        ? "expired"
        : t.last_used_at
          ? `last used ${t.last_used_at.slice(0, 16).replace("T", " ")}`
          : "never used";
    const expiry = t.expires_at ? `expires ${t.expires_at.slice(0, 10)}` : "no expiry";
    const issued = rows.filter((c) => c.parent_id === t.id && !c.revoked_at && c.expires_at && new Date(c.expires_at).getTime() > now).length;
    console.log(`${t.id}  ${t.token_prefix}…  ${t.name}  [${t.scopes.join(" ")}]  ${expiry}  (${state})${issued ? `  ${issued} live run token(s)` : ""}`);
  }
}

export async function revokeToken(id: string): Promise<void> {
  const client = await getAuthenticatedClient();
  const { data, error } = await client
    .from("access_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .is("revoked_at", null)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error(`No active access token ${id} in your projects.`);
  console.log(`Revoked ${id}. Tokens it issued stop working too.`);
}

/**
 * `feedbackkit token issue --feedback <id>...` — a token limited to one report
 * (or the reports of one merged batch) that expires soon (default 60 min). CI
 * runs this with its agent-runner token (tokens:issue) and hands the result
 * to the coding agent, so the agent never holds a project-wide credential.
 */
export async function issueToken(options: { feedback: string[]; ttl?: string; name?: string }): Promise<void> {
  const ttl = options.ttl === undefined ? 60 : Number(options.ttl);
  if (!Number.isInteger(ttl) || ttl < 5 || ttl > 720) throw new Error("--ttl is in minutes, 5 to 720.");
  const ids = [...new Set(options.feedback.flatMap((id) => id.split(/[\s,]+/)).filter(Boolean))];
  if (ids.length === 0) throw new Error("--feedback needs a report id.");
  const client = await getAuthenticatedClient();
  const { data, error } = await client.rpc("issue_access_token", {
    p_feedback_id: ids[0],
    p_ttl_minutes: ttl,
    p_name: options.name ?? null,
    // Only sent for a batch, so a single report still works against a
    // backend from before 0026_batch_run_tokens.sql.
    ...(ids.length > 1 ? { p_feedback_ids: ids.slice(1) } : {}),
  });
  if (error) throw new Error(error.message);
  console.log(data as string);
  console.error(`Limited to ${ids.length === 1 ? `report ${ids[0]}` : `reports ${ids.join(", ")}`}; expires in ${ttl} minutes.`);
}
