// The agent/release half of the closed loop (supabase/migrations/0014_closed_loop.sql),
// shared by the MCP tools (mcp/server.ts) and the `release`/`link` commands.
//
// Everything here runs as the logged-in dashboard user through RLS, like the
// rest of the CLI — there's no authorization logic of our own. What an agent
// can do is deliberately narrow: claim a report, post progress, ask the
// reporter a question, link its fix, attach an "after" screenshot. It can't
// mark a fix *verified* — only the reporter can, from their device, via the
// reporter-updates Edge Function.
import { execFileSync } from "node:child_process";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FeedbackEvent, FeedbackEventKind, FeedbackItem, FixStage } from "./types.js";

export const SCREENSHOT_BUCKET = "feedback-screenshots";

/**
 * Mirrors supabase/functions/_shared/builds.ts `compareBuilds` (and the SQL /
 * Swift / web SDK copies) — dotted numeric builds compare numerically;
 * anything else is only equal (0) or incomparable (null).
 */
export function compareBuilds(a: string | null | undefined, b: string | null | undefined): -1 | 0 | 1 | null {
  if (a == null || b == null || a === "" || b === "") return null;
  if (a === b) return 0;
  const numeric = /^[0-9]+(\.[0-9]+)*$/;
  if (!numeric.test(a) || !numeric.test(b)) return null;
  const pa = a.split(".");
  const pb = b.split(".");
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = BigInt(pa[i] ?? "0");
    const nb = BigInt(pb[i] ?? "0");
    if (na < nb) return -1;
    if (na > nb) return 1;
  }
  return 0;
}

export async function currentUserId(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error(error?.message ?? "Not logged in.");
  return data.user.id;
}

export async function fetchFeedback(client: SupabaseClient, feedbackId: string, projectId?: string): Promise<FeedbackItem> {
  let query = client.from("feedback_items").select("*").eq("id", feedbackId);
  if (projectId) query = query.eq("project_id", projectId);
  const { data, error } = await query.maybeSingle<FeedbackItem>();
  if (error || !data) {
    throw new Error(
      projectId
        ? `Feedback ${feedbackId} not found in project ${projectId}, or you don't have access to it.`
        : `Feedback ${feedbackId} not found, or you don't have access to it.`,
    );
  }
  return data;
}

export async function fetchTimeline(client: SupabaseClient, feedbackId: string): Promise<FeedbackEvent[]> {
  const { data, error } = await client
    .from("feedback_events")
    .select("*")
    .eq("feedback_id", feedbackId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as FeedbackEvent[];
}

export interface EventInput {
  kind: FeedbackEventKind;
  body?: string | null;
  data?: Record<string, unknown>;
  visibleToReporter?: boolean;
  /** "agent" when an MCP client acts, "user" for a human at the CLI. */
  actorType: "user" | "agent";
  actorLabel: string;
}

export async function recordEvent(client: SupabaseClient, item: Pick<FeedbackItem, "id" | "project_id">, e: EventInput): Promise<FeedbackEvent> {
  const { data, error } = await client
    .from("feedback_events")
    .insert({
      feedback_id: item.id,
      project_id: item.project_id,
      kind: e.kind,
      actor_type: e.actorType,
      actor_user_id: await currentUserId(client),
      actor_label: e.actorLabel,
      body: e.body ?? null,
      data: e.data ?? {},
      visible_to_reporter: e.visibleToReporter ?? false,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as FeedbackEvent;
}

async function updateItem(client: SupabaseClient, id: string, patch: Partial<FeedbackItem>): Promise<void> {
  const { error } = await client.from("feedback_items").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

/** `status` that goes with a new `fix_stage`, never overriding a deliberate wont_fix. */
function statusFor(item: FeedbackItem, stage: FixStage): FeedbackItem["status"] {
  if (item.status === "wont_fix") return item.status;
  return stage === "verified" ? "resolved" : "in_progress";
}

export async function claimFeedback(client: SupabaseClient, item: FeedbackItem, actor: Omit<EventInput, "kind">): Promise<void> {
  // Claiming never moves a report *backwards* past a PR/merge/ship.
  if (!item.fix_stage || item.fix_stage === "reopened") {
    await updateItem(client, item.id, { fix_stage: "agent_working", status: statusFor(item, "agent_working") });
  }
  await recordEvent(client, item, { ...actor, kind: "claimed", body: actor.body ?? "Started working on this." });
}

export interface LinkFixInput {
  prUrl?: string;
  commitSha?: string;
  /** True once the PR is merged / the commit is on the release branch. */
  merged?: boolean;
  summary?: string;
}

/**
 * Records the fix. The GitHub webhook does this automatically for PRs that
 * mention the report (or its issue); this is for agents that commit
 * directly, repos without the GitHub App, or to add a summary.
 */
export async function linkFix(client: SupabaseClient, item: FeedbackItem, input: LinkFixInput, actor: Omit<EventInput, "kind">): Promise<FixStage> {
  const prNumber = input.prUrl ? Number(input.prUrl.match(/\/pull\/(\d+)/)?.[1]) || null : null;
  // A bare commit (no PR) is by definition already on a branch — treat it as merged.
  const stage: FixStage = input.merged || (input.commitSha && !input.prUrl) ? "merged" : "pr_open";
  if (item.fix_stage === "shipped" || item.fix_stage === "verified") {
    throw new Error(`Feedback ${item.id} is already ${item.fix_stage}; link a new fix only after the reporter reopens it.`);
  }
  await updateItem(client, item.id, {
    fix_stage: stage,
    status: statusFor(item, stage),
    ...(input.prUrl ? { fix_pr_url: input.prUrl, fix_pr_number: prNumber } : {}),
    ...(input.commitSha ? { fix_commit_sha: input.commitSha } : {}),
    ...(input.summary ? { fix_summary: input.summary } : {}),
  });
  await recordEvent(client, item, {
    ...actor,
    kind: stage === "merged" ? "pr_merged" : "pr_opened",
    body: input.summary ?? (input.prUrl ? `Fix: ${input.prUrl}` : `Fix committed: ${input.commitSha}`),
    data: { pr_url: input.prUrl ?? null, pr_number: prNumber, commit_sha: input.commitSha ?? null },
  });
  return stage;
}

/**
 * Uploads a post-fix screenshot (e.g. the simulator after the change) next
 * to the report's own, so the dashboard can show before/after.
 */
export async function attachAfterScreenshot(
  client: SupabaseClient,
  item: FeedbackItem,
  png: Uint8Array,
  caption: string | undefined,
  actor: Omit<EventInput, "kind">,
): Promise<string> {
  const path = `${item.project_id}/${item.id}/after/${Date.now()}.png`;
  const { error } = await client.storage.from(SCREENSHOT_BUCKET).upload(path, png, { contentType: "image/png", upsert: false });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  await recordEvent(client, item, {
    ...actor,
    kind: "after_screenshot",
    body: caption ?? "Screenshot after the fix.",
    data: { screenshot_path: path },
  });
  return path;
}

/** Downloads a stored screenshot as base64 (for MCP image content), or null. */
export async function downloadBase64(client: SupabaseClient, path: string, maxBytes: number): Promise<string | null> {
  const { data, error } = await client.storage.from(SCREENSHOT_BUCKET).download(path);
  if (error || !data) return null;
  const bytes = Buffer.from(await data.arrayBuffer());
  if (bytes.length > maxBytes) return null;
  return bytes.toString("base64");
}

// ---- Releases -------------------------------------------------------------

export interface ReleaseCandidate {
  item: CandidateItem;
  included: boolean;
  reason: string;
}

function git(args: string[], cwd: string): string | null {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

/** `HEAD` (or any rev) → full sha, or null outside a git repo. */
export function resolveCommit(rev: string, cwd: string): string | null {
  return git(["rev-parse", "--verify", `${rev}^{commit}`], cwd);
}

/**
 * Which merged fixes are in the build being released. With a release commit
 * and a local git checkout, a fix is included only if its commit is an
 * ancestor of the release commit — so releasing an older branch never
 * claims fixes it doesn't contain. Fixes with no recorded commit are
 * included (the best available signal is "merged before this release").
 */
export async function selectReleaseCandidates(
  client: SupabaseClient,
  projectId: string,
  options: { releaseCommit: string | null; productKey?: string; cwd: string },
): Promise<ReleaseCandidate[]> {
  const { data, error } = await client
    .from("feedback_items")
    .select("*")
    .eq("project_id", projectId)
    .eq("fix_stage", "merged")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return classifyReleaseCandidates((data ?? []) as FeedbackItem[], options);
}

/** The minimum a candidate needs — what the ci-release function returns too. */
export type CandidateItem = Pick<FeedbackItem, "id" | "text" | "fix_commit_sha" | "product_keys">;

/**
 * Which merged fixes are in the build being released (pure apart from git).
 * With a release commit and a local git checkout, a fix is included only if
 * its commit is an ancestor of the release commit — so releasing an older
 * branch never claims fixes it doesn't contain. Fixes with no recorded
 * commit are included (the best available signal is "merged before this
 * release"). Shared by session mode and CI token mode.
 */
export function classifyReleaseCandidates<T extends CandidateItem>(
  items: T[],
  options: { releaseCommit: string | null; productKey?: string; cwd: string },
): Array<ReleaseCandidate & { item: T }> {
  return items.map((item) => {
    const keys = item.product_keys ?? [];
    if (options.productKey && keys.length > 0 && !keys.includes(options.productKey)) {
      return { item, included: false, reason: `for ${keys.join(", ")}, not ${options.productKey}` };
    }
    if (!item.fix_commit_sha) {
      return { item, included: true, reason: "merged (no commit recorded)" };
    }
    if (!options.releaseCommit) {
      return { item, included: true, reason: `merged in ${item.fix_commit_sha.slice(0, 7)} (no release commit to check against)` };
    }
    if (git(["cat-file", "-e", `${item.fix_commit_sha}^{commit}`], options.cwd) === null) {
      return { item, included: false, reason: `fix commit ${item.fix_commit_sha.slice(0, 7)} not found locally — git fetch (CI: fetch-depth: 0), or pass --include` };
    }
    const isAncestor = git(["merge-base", "--is-ancestor", item.fix_commit_sha, options.releaseCommit], options.cwd) !== null;
    return isAncestor
      ? { item, included: true, reason: `fix ${item.fix_commit_sha.slice(0, 7)} is in this build` }
      : { item, included: false, reason: `fix ${item.fix_commit_sha.slice(0, 7)} is not an ancestor of the release commit` };
  });
}

export async function recordRelease(
  client: SupabaseClient,
  input: { projectId: string; build: string; version?: string; commitSha?: string | null; productKey?: string; channel?: ReleaseChannel; feedbackIds: string[] },
): Promise<string[]> {
  const { data, error } = await client.rpc("record_release", {
    p_project_id: input.projectId,
    p_build: input.build,
    p_version: input.version ?? null,
    p_commit_sha: input.commitSha ?? null,
    p_product_key: input.productKey ?? null,
    p_feedback_ids: input.feedbackIds,
    p_actor_label: "feedbackkit release",
  });
  if (error) throw new Error(error.message);
  const shipped = (data ?? []) as string[];
  // record_release predates channels (it always records a beta); set it after.
  if (input.channel === "production") {
    const query = client
      .from("releases")
      .update({ channel: "production", promoted_at: new Date().toISOString() })
      .eq("project_id", input.projectId)
      .eq("build", input.build);
    await (input.productKey ? query.eq("product_key", input.productKey) : query.is("product_key", null));
  }
  return shipped;
}

export type ReleaseChannel = "beta" | "production";

// ---- CI token mode (ci-release Edge Function) ---------------------------------

/** The hosted FeedbackKit backend; override with --api-url / FEEDBACKKIT_API_URL. */
export const DEFAULT_API_URL = "https://gpucoladcyvijefdjudf.supabase.co";

export class CiReleaseClient {
  constructor(
    private readonly token: string,
    private readonly apiUrl: string = DEFAULT_API_URL,
  ) {
    if (!/^fkr_[0-9a-f]{48}$/.test(token)) {
      throw new Error("That doesn't look like a FeedbackKit release token (fkr_…). Create one in project Settings → Release tokens.");
    }
  }

  private get endpoint(): string {
    return `${this.apiUrl.replace(/\/+$/, "")}/functions/v1/ci-release`;
  }

  private async request<T>(method: "GET" | "POST", body?: unknown): Promise<T> {
    const res = await fetch(this.endpoint, {
      method,
      headers: { "x-release-token": this.token, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = (await res.json().catch(() => ({}))) as T & { error?: string; message?: string };
    if (!res.ok) throw new Error(`ci-release: ${json.error ?? res.status}${json.message ? ` — ${json.message}` : ""}`);
    return json;
  }

  candidates(): Promise<{ project: { id: string; name: string }; candidates: CandidateItem[] }> {
    return this.request("GET");
  }

  record(input: { build: string; version?: string; commitSha?: string | null; productKey?: string; channel?: ReleaseChannel; feedbackIds: string[] }): Promise<{ shipped: string[] }> {
    return this.request("POST", {
      build: input.build,
      version: input.version,
      commit_sha: input.commitSha ?? undefined,
      product_key: input.productKey,
      channel: input.channel,
      feedback_ids: input.feedbackIds,
    });
  }

  promote(build: string, productKey?: string): Promise<{ promoted: string[] }> {
    return this.request("POST", { action: "promote", build, product_key: productKey });
  }
}

/**
 * The project to act on: the explicit one, else the only one you're a member
 * of. Ambiguity is an error rather than a guess — `release` writes.
 */
export async function resolveProjectId(client: SupabaseClient, explicit?: string): Promise<string> {
  if (explicit) return explicit;
  const { data, error } = await client.from("projects").select("id, name");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("You have no FeedbackKit projects.");
  if (data.length > 1) {
    const list = data.map((p: { id: string; name: string }) => `  ${p.id}  ${p.name}`).join("\n");
    throw new Error(`You're in several projects — pass --project <id> (or set FEEDBACKKIT_PROJECT_ID):\n${list}`);
  }
  return data[0].id;
}

/** Plain-text timeline, for the CLI and for agents. */
export function formatTimeline(events: FeedbackEvent[]): string {
  if (events.length === 0) return "(no activity yet)";
  return events
    .map((e) => {
      const who = e.actor_label ?? e.actor_type;
      const vis = e.visible_to_reporter ? " [reporter can see]" : "";
      return `${e.created_at.slice(0, 16).replace("T", " ")}  ${e.kind.padEnd(16)} ${who}${vis}${e.body ? `: ${e.body}` : ""}`;
    })
    .join("\n");
}

/**
 * Appended to `get_prompt` over MCP: tells the agent how to report back
 * through the tools it already has, so the loop closes without a human.
 */
export function loopInstructions(item: FeedbackItem): string {
  const reopened = item.fix_stage === "reopened"
    ? `\n**This report was reopened** — the reporter says the previous fix${item.fixed_in_build ? ` (build ${item.fixed_in_build})` : ""} didn't work. Call \`get_feedback\` to see their latest comment and screenshot before changing anything.\n`
    : "";
  return `

---
## Closing the loop (FeedbackKit report \`${item.id}\`)
${reopened}
1. Call \`claim_feedback\` before you start, so the team sees it's being worked on.
2. If something is ambiguous only the reporter can answer, call \`ask_reporter\` — the question appears on their device.
3. If you can run the app (e.g. an iOS simulator via XcodeBuildMCP, or a browser), reproduce the bug first, and after fixing it call \`attach_after_screenshot\` with a screenshot of the fixed screen.
4. Add this trailer to your fix commit's message (last paragraph, like \`Co-Authored-By\`) — when the commit reaches the default branch, FeedbackKit links it and ships it with the next beta build:
   \`FeedbackKit: ${item.id}\`
   Optionally add \`FeedbackKit-Summary: <one plain-language sentence for the reporter>\`. If you open a pull request instead, put the same \`FeedbackKit:\` line in its description. Without the GitHub App, call \`link_fix\` with the commit sha.
5. Don't mark it resolved yourself: once the fix ships in a build, the reporter confirms it on their device.`;
}
