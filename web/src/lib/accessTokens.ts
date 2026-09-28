// Project access tokens (0025_access_tokens_and_previews.sql). Scopes and
// presets are mirrored by hand in cli/src/commands/token.ts.

export type TokenScope = "releases:write" | "feedback:read" | "feedback:write" | "reporter:ask" | "previews:write" | "tokens:issue";

export const TOKEN_SCOPES: { scope: TokenScope; label: string; description: string }[] = [
  { scope: "releases:write", label: "Announce releases", description: "Record builds and the fixes they ship (feedbackkit release)." },
  { scope: "feedback:read", label: "Read reports", description: "Reports, their timelines, prompts and screenshots." },
  { scope: "feedback:write", label: "Work on reports", description: "Claim, post progress and link a fix. Never marks one verified." },
  { scope: "reporter:ask", label: "Ask reporters", description: "Send a question the reporter sees on their device." },
  { scope: "previews:write", label: "Attach previews", description: "Screenshots or short videos of the fixed app." },
  { scope: "tokens:issue", label: "Issue run tokens", description: "Hand each agent run a token limited to one report that expires within hours." },
];

export type TokenPreset = "ci" | "agent" | "custom";

export const TOKEN_PRESETS: Record<Exclude<TokenPreset, "custom">, { label: string; hint: string; scopes: TokenScope[]; secret: string; name: string }> = {
  ci: {
    label: "CI release",
    hint: "Your build pipeline announces each build.",
    scopes: ["releases:write"],
    secret: "FEEDBACKKIT_RELEASE_TOKEN",
    name: "github-actions",
  },
  agent: {
    label: "Agent runner",
    hint: "A workflow hands each coding-agent run a token for its one report.",
    scopes: ["feedback:read", "feedback:write", "reporter:ask", "previews:write", "tokens:issue"],
    secret: "FEEDBACKKIT_AGENT_TOKEN",
    name: "agent-runner",
  },
};

export const EXPIRY_OPTIONS: { value: string; label: string; days: number | null }[] = [
  { value: "never", label: "No expiry", days: null },
  { value: "30", label: "30 days", days: 30 },
  { value: "90", label: "90 days", days: 90 },
  { value: "365", label: "1 year", days: 365 },
];

export function expiryDate(value: string, now = new Date()): Date | null {
  const days = EXPIRY_OPTIONS.find((o) => o.value === value)?.days ?? null;
  return days === null ? null : new Date(now.getTime() + days * 86400e3);
}

export interface AccessToken {
  id: string;
  project_id: string;
  name: string;
  token_prefix: string;
  scopes: TokenScope[];
  expires_at: string | null;
  parent_id: string | null;
  feedback_id: string | null;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export type TokenState = "active" | "revoked" | "expired";

export function tokenState(t: Pick<AccessToken, "revoked_at" | "expires_at">, now = new Date()): TokenState {
  if (t.revoked_at) return "revoked";
  if (t.expires_at && new Date(t.expires_at).getTime() <= now.getTime()) return "expired";
  return "active";
}

/** Live run tokens (report-limited, issued by `parentId`) — shown as a count, not listed. */
export function liveRunTokens(tokens: AccessToken[], parentId: string, now = new Date()): number {
  return tokens.filter((t) => t.parent_id === parentId && tokenState(t, now) === "active").length;
}

/** The secret name the "store it" command suggests, from the token's scopes. */
export function suggestedSecret(scopes: TokenScope[]): string {
  if (scopes.length === 1 && scopes[0] === "releases:write") return TOKEN_PRESETS.ci.secret;
  if (scopes.includes("tokens:issue")) return TOKEN_PRESETS.agent.secret;
  return "FEEDBACKKIT_TOKEN";
}
