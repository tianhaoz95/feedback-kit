// GitHub App webhook → feedback loop sync.
//
// Trust boundary: `verify_jwt = false` (GitHub can't present a Supabase
// session), so every delivery must carry a valid `X-Hub-Signature-256` —
// an HMAC of the raw body with GITHUB_WEBHOOK_SECRET (the same secret set on
// the GitHub App's webhook). No secret configured → every delivery is
// rejected, never silently trusted. Same idea as stripe-webhook.
//
// Every lookup is scoped to the project(s) whose `github_repo` is the
// delivery's `repository.full_name`, so issue #5 in one repo can never touch
// feedback linked to issue #5 in another.
//
// Handled:
//   issues.closed / issues.reopened → triage `status` (as before)
//   pull_request.opened/reopened/edited/ready_for_review → fix_stage 'pr_open'
//   pull_request.closed (merged)    → fix_stage 'merged' + merge commit sha
//   pull_request.closed (unmerged)  → back to no stage
//
// A PR is linked to feedback by (a) a FeedbackKit feedback id (uuid)
// anywhere in its title, body or branch name — the issue body and MCP prompt
// ask agents to include `FeedbackKit: <id>` — or (b) a closing keyword for a
// linked issue (`Fixes #12`).
import { createClient } from "jsr:@supabase/supabase-js@2";
import { json } from "../_shared/http.ts";
import { timingSafeEqual } from "../_shared/encoding.ts";

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const CLOSING_REF = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s*:?\s+#(\d+)\b/gi;

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const secret = Deno.env.get("GITHUB_WEBHOOK_SECRET");
  if (!secret) {
    console.error("github-webhook: GITHUB_WEBHOOK_SECRET is not set; rejecting delivery.");
    return json({ error: "webhook_not_configured" }, 503);
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256") ?? "";
  if (!(await verifySignature(secret, rawBody, signature))) {
    return json({ error: "invalid_signature" }, 401);
  }

  const event = req.headers.get("x-github-event");
  if (!event) {
    return json({ error: "missing_event_header" }, 400);
  }
  if (event === "ping") {
    return json({ status: "pong" }, 200);
  }

  // deno-lint-ignore no-explicit-any
  let payload: Record<string, any>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: "invalid_json_body" }, 400);
  }

  const repoFullName: string | undefined = payload.repository?.full_name;
  if (!repoFullName) {
    return json({ status: "ignored_no_repository" }, 200);
  }

  const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: projects } = await adminClient
    .from("projects")
    .select("id, github_repo")
    .ilike("github_repo", repoFullName.replace(/[%_\\]/g, "\\$&"));
  const projectIds = (projects ?? []).map((p: { id: string }) => p.id);
  if (projectIds.length === 0) {
    return json({ status: "ignored_unknown_repository" }, 200);
  }

  if (event === "issues") {
    return await handleIssue(adminClient, projectIds, payload);
  }
  if (event === "pull_request") {
    return await handlePullRequest(adminClient, projectIds, payload);
  }
  return json({ status: "ignored_event", event }, 200);
});

async function verifySignature(secret: string, body: string, header: string): Promise<boolean> {
  if (!header.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  const expected = "sha256=" + Array.from(mac, (b) => b.toString(16).padStart(2, "0")).join("");
  return timingSafeEqual(expected, header);
}

// deno-lint-ignore no-explicit-any
type Client = any;
// deno-lint-ignore no-explicit-any
type Payload = Record<string, any>;

async function handleIssue(adminClient: Client, projectIds: string[], payload: Payload): Promise<Response> {
  const { action, issue } = payload;
  if (!issue?.number) return json({ error: "invalid_payload" }, 400);
  if (action !== "closed" && action !== "reopened") {
    return json({ status: "unhandled_action", action }, 200);
  }

  const { data: items } = await adminClient
    .from("feedback_items")
    .select("id, project_id, status")
    .in("project_id", projectIds)
    .eq("github_issue_number", issue.number);

  for (const item of items ?? []) {
    if (item.status === "wont_fix") continue;
    const status = action === "closed" ? "resolved" : "in_progress";
    if (item.status === status) continue;
    await adminClient.from("feedback_items").update({ status }).eq("id", item.id);
    await insertEvent(adminClient, item, {
      kind: "status_changed",
      body: `GitHub issue #${issue.number} ${action}.`,
      data: { status, issue_number: issue.number, issue_url: issue.html_url },
    });
  }

  return json({ status: action === "closed" ? "resolved_sync" : "reopened_sync", matched: items?.length ?? 0 }, 200);
}

async function handlePullRequest(adminClient: Client, projectIds: string[], payload: Payload): Promise<Response> {
  const { action, pull_request: pr } = payload;
  if (!pr?.number) return json({ error: "invalid_payload" }, 400);

  const tracked = ["opened", "reopened", "edited", "ready_for_review", "closed"];
  if (!tracked.includes(action)) return json({ status: "unhandled_action", action }, 200);

  const items = await findLinkedFeedback(adminClient, projectIds, pr);
  if (items.length === 0) return json({ status: "no_linked_feedback" }, 200);

  const prData = { pr_number: pr.number, pr_url: pr.html_url, pr_title: pr.title };

  for (const item of items) {
    if (action === "closed" && pr.merged) {
      if (item.fix_stage === "shipped" || item.fix_stage === "verified") continue;
      await adminClient
        .from("feedback_items")
        .update({
          fix_stage: "merged",
          fix_pr_url: pr.html_url,
          fix_pr_number: pr.number,
          fix_commit_sha: pr.merge_commit_sha ?? null,
          status: item.status === "wont_fix" ? item.status : "in_progress",
        })
        .eq("id", item.id);
      await insertEvent(adminClient, item, {
        kind: "pr_merged",
        body: `PR #${pr.number} merged: ${pr.title}`,
        data: { ...prData, merge_commit_sha: pr.merge_commit_sha ?? null },
      });
    } else if (action === "closed") {
      // Closed without merging: only unwind if this PR is the one on record.
      if (item.fix_pr_number !== pr.number || item.fix_stage !== "pr_open") continue;
      await adminClient.from("feedback_items").update({ fix_stage: null }).eq("id", item.id);
      await insertEvent(adminClient, item, { kind: "pr_closed", body: `PR #${pr.number} closed without merging.`, data: prData });
    } else {
      // opened / reopened / edited / ready_for_review
      if (item.fix_stage === "merged" || item.fix_stage === "shipped" || item.fix_stage === "verified") continue;
      const alreadyLinked = item.fix_stage === "pr_open" && item.fix_pr_number === pr.number;
      if (alreadyLinked) continue;
      await adminClient
        .from("feedback_items")
        .update({
          fix_stage: "pr_open",
          fix_pr_url: pr.html_url,
          fix_pr_number: pr.number,
          status: item.status === "new" ? "in_progress" : item.status,
        })
        .eq("id", item.id);
      await insertEvent(adminClient, item, { kind: "pr_opened", body: `PR #${pr.number} opened: ${pr.title}`, data: prData });
    }
  }

  return json({ status: "pr_sync", action, matched: items.length }, 200);
}

interface LinkedItem {
  id: string;
  project_id: string;
  status: string;
  fix_stage: string | null;
  fix_pr_number: number | null;
}

async function findLinkedFeedback(adminClient: Client, projectIds: string[], pr: Payload): Promise<LinkedItem[]> {
  const haystack = [pr.title ?? "", pr.body ?? "", pr.head?.ref ?? ""].join("\n");
  const ids = Array.from(new Set((haystack.match(UUID) ?? []).map((s) => s.toLowerCase())));
  const issueNumbers = Array.from(new Set(Array.from(haystack.matchAll(CLOSING_REF), (m) => Number(m[1]))));

  const columns = "id, project_id, status, fix_stage, fix_pr_number";
  const found = new Map<string, LinkedItem>();
  if (ids.length > 0) {
    const { data } = await adminClient.from("feedback_items").select(columns).in("project_id", projectIds).in("id", ids);
    for (const row of data ?? []) found.set(row.id, row);
  }
  if (issueNumbers.length > 0) {
    const { data } = await adminClient
      .from("feedback_items")
      .select(columns)
      .in("project_id", projectIds)
      .in("github_issue_number", issueNumbers);
    for (const row of data ?? []) found.set(row.id, row);
  }
  return Array.from(found.values());
}

async function insertEvent(
  adminClient: Client,
  item: { id: string; project_id: string },
  e: { kind: string; body: string; data: Record<string, unknown> },
) {
  const { error } = await adminClient.from("feedback_events").insert({
    feedback_id: item.id,
    project_id: item.project_id,
    kind: e.kind,
    actor_type: "github",
    actor_label: "GitHub",
    body: e.body,
    data: e.data,
    visible_to_reporter: false,
  });
  if (error) console.warn("Failed to record event:", error.message);
}
