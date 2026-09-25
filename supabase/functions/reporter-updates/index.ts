// The reporter-facing half of the closed loop (see 0014_closed_loop.sql):
// lets the device/browser that filed a report see what happened to it, and
// answer back — "yes, it's fixed", "no, still broken" (with a fresh
// screenshot), or a reply to a developer/agent question.
//
// Auth model: like ingest-feedback, no Supabase auth (`verify_jwt = false`).
// A request is scoped by `project_key` (public routing key) *plus*
// `reporter_id` — the random per-install id the SDK generated when it filed
// the report. Only reports carrying that exact reporter_id are ever returned
// or modified, so knowing a project key alone reveals nothing. Uses the
// service-role key, bypassing RLS by design.
//
//   GET  ?project_key=pk_…&reporter_id=…&build=…   → { updates: ReporterUpdate[] }
//   POST { project_key, reporter_id, feedback_id, action: "verify" | "reopen" | "reply", … }
//
// Wire format is mirrored in Sources/FeedbackKit/Networking/FixUpdatesClient.swift
// and web-sdk/src/fixes.ts — keep all three in sync.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { buildIncludesFix } from "../_shared/builds.ts";
import { decodeBase64 } from "../_shared/encoding.ts";
import { addIssueComment, dispatchIssueToAgent, getProjectInstallationToken, setIssueState } from "../_shared/github.ts";
import { isOriginAllowed } from "../_shared/origin.ts";
import { sanitizeReporterId } from "../_shared/reporter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-project-key, x-reporter-id",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const MAX_UPDATES = 5;
const MAX_TEXT_LENGTH = 5000;
const RATE_LIMIT_PER_MINUTE = Number(Deno.env.get("REPORTER_RATE_LIMIT_PER_MINUTE") ?? "30");
const DASHBOARD_URL = Deno.env.get("DASHBOARD_URL") ?? "https://feedback-kit.hejitech.workers.dev";

interface ActionBody {
  project_key?: string;
  reporter_id?: string;
  feedback_id?: string;
  action?: "verify" | "reopen" | "reply";
  text?: string;
  build?: string;
  screenshot_raw_png_base64?: string;
  screenshot_annotated_png_base64?: string;
  annotations?: unknown;
}

interface EventRow {
  id: string;
  feedback_id: string;
  kind: string;
  actor_type: string;
  actor_label: string | null;
  body: string | null;
  data: Record<string, unknown>;
  visible_to_reporter: boolean;
  created_at: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (req.method === "GET") {
      const url = new URL(req.url);
      const projectKey = url.searchParams.get("project_key") || req.headers.get("x-project-key");
      const reporterId = sanitizeReporterId(url.searchParams.get("reporter_id") || req.headers.get("x-reporter-id"));
      const build = url.searchParams.get("build");
      if (!projectKey || !reporterId) return json({ error: "missing project_key or reporter_id" }, 400);

      const project = await findProject(supabase, projectKey);
      if (!project) return json({ error: "unknown project_key" }, 401);
      if (!isOriginAllowed(req.headers.get("origin"), project.allowed_origins)) {
        return json({ error: "origin_not_allowed" }, 403);
      }

      return json({ updates: await listUpdates(supabase, project.id, reporterId, build) }, 200);
    }

    if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

    let body: ActionBody;
    try {
      body = await req.json();
    } catch {
      return json({ error: "invalid JSON body" }, 400);
    }

    const reporterId = sanitizeReporterId(body.reporter_id);
    if (!body.project_key || !reporterId || !body.feedback_id || !body.action) {
      return json({ error: "missing required fields" }, 400);
    }
    if (!["verify", "reopen", "reply"].includes(body.action)) {
      return json({ error: "unknown action" }, 400);
    }

    const project = await findProject(supabase, body.project_key);
    if (!project) return json({ error: "unknown project_key" }, 401);
    if (!isOriginAllowed(req.headers.get("origin"), project.allowed_origins)) {
      return json({ error: "origin_not_allowed" }, 403);
    }

    if (RATE_LIMIT_PER_MINUTE > 0) {
      const since = new Date(Date.now() - 60_000).toISOString();
      const { count } = await supabase
        .from("feedback_events")
        .select("id", { count: "exact", head: true })
        .eq("project_id", project.id)
        .eq("actor_type", "reporter")
        .gte("created_at", since);
      if ((count ?? 0) >= RATE_LIMIT_PER_MINUTE) return json({ error: "rate_limited" }, 429);
    }

    const { data: item } = await supabase
      .from("feedback_items")
      .select("*")
      .eq("id", body.feedback_id)
      .eq("project_id", project.id)
      .eq("reporter_id", reporterId)
      .maybeSingle();
    // Same response whether the item doesn't exist or belongs to someone else.
    if (!item) return json({ error: "not_found" }, 404);

    const text = typeof body.text === "string" ? body.text.slice(0, MAX_TEXT_LENGTH) : "";
    const build = typeof body.build === "string" ? body.build.slice(0, 64) : null;

    if (body.action === "verify") {
      if (item.fix_stage !== "shipped" && item.fix_stage !== "verified") {
        return json({ error: "not_shipped", message: "This report has no shipped fix to verify yet." }, 409);
      }
      if (item.fix_stage === "verified") return json({ ok: true, fix_stage: "verified" }, 200);

      await supabase
        .from("feedback_items")
        .update({ fix_stage: "verified", status: "resolved", verified_at: new Date().toISOString() })
        .eq("id", item.id);
      await insertEvent(supabase, item, {
        kind: "verified",
        body: text || "Confirmed fixed on device.",
        data: { build },
      });

      await withGitHub(supabase, project, item, async (token, repo, issue) => {
        await addIssueComment(
          token,
          repo,
          issue,
          `✅ **Verified by the reporter** on build \`${build ?? item.fixed_in_build ?? "?"}\`.${text ? `\n\n> ${quote(text)}` : ""}`,
        );
        await setIssueState(token, repo, issue, "closed");
      });

      return json({ ok: true, fix_stage: "verified" }, 200);
    }

    if (body.action === "reply") {
      if (!text.trim()) return json({ error: "empty reply" }, 400);
      await insertEvent(supabase, item, { kind: "reporter_reply", body: text, data: { build } });
      await withGitHub(supabase, project, item, async (token, repo, issue) => {
        await addIssueComment(token, repo, issue, `💬 **Reporter replied** (build \`${build ?? "?"}\`):\n\n> ${quote(text)}`);
      });
      return json({ ok: true }, 200);
    }

    // action === "reopen": "still broken", optionally with a fresh (annotated) screenshot.
    const reopenCount = (item.reopen_count ?? 0) + 1;
    let annotatedPath: string | null = null;
    let rawPath: string | null = null;
    if (body.screenshot_annotated_png_base64) {
      annotatedPath = `${project.id}/${item.id}/reopen/${reopenCount}-annotated.png`;
      const { error } = await supabase.storage
        .from("feedback-screenshots")
        .upload(annotatedPath, decodeBase64(body.screenshot_annotated_png_base64), {
          contentType: "image/png",
          upsert: true,
        });
      if (error) return json({ error: "failed to store screenshot", detail: error.message }, 500);
      if (body.screenshot_raw_png_base64) {
        rawPath = `${project.id}/${item.id}/reopen/${reopenCount}-raw.png`;
        await supabase.storage
          .from("feedback-screenshots")
          .upload(rawPath, decodeBase64(body.screenshot_raw_png_base64), { contentType: "image/png", upsert: true });
      }
    }

    await supabase
      .from("feedback_items")
      .update({
        fix_stage: "reopened",
        status: "in_progress",
        verified_at: null,
        reopen_count: reopenCount,
      })
      .eq("id", item.id);
    await insertEvent(supabase, item, {
      kind: "reopened",
      body: text || "Still broken.",
      data: {
        build,
        previous_fixed_in_build: item.fixed_in_build,
        screenshot_annotated_path: annotatedPath,
        screenshot_raw_path: rawPath,
        annotations: Array.isArray(body.annotations) ? body.annotations : [],
      },
    });

    await withGitHub(supabase, project, item, async (token, repo, issue) => {
      await setIssueState(token, repo, issue, "open");
      const shot = annotatedPath ? await signedUrl(supabase, annotatedPath, 60 * 60 * 24 * 7) : null;
      const note =
        `🔁 **Reporter says it's still broken** on build \`${build ?? "?"}\`` +
        (item.fixed_in_build ? ` (fix shipped in \`${item.fixed_in_build}\`)` : "") +
        `.\n\n> ${quote(text || "(no details)")}` +
        (shot ? `\n\n![Still broken](${shot})\n*(Signed URL valid for 7 days)*` : "") +
        `\n\nFeedbackKit report \`${item.id}\` — ${DASHBOARD_URL}/projects/${project.id}/feedback/${item.id}`;
      await addIssueComment(token, repo, issue, note);
      // Hand it straight back to the agent that fixed it.
      const dispatched = await dispatchIssueToAgent(token, repo, issue, project, "The previous fix didn't resolve this — see the comment above.");
      if (dispatched) {
        await insertEvent(supabase, item, {
          kind: "dispatched",
          actorType: "system",
          actorLabel: "FeedbackKit",
          body: "Re-dispatched to the coding agent after the reporter reopened it.",
          data: dispatched,
          visibleToReporter: false,
        });
      }
    });

    return json({ ok: true, fix_stage: "reopened" }, 200);
  } catch (err) {
    console.error("reporter-updates error:", err);
    return json({ error: "internal_error", message: err instanceof Error ? err.message : String(err) }, 500);
  }
});

// deno-lint-ignore no-explicit-any
type Client = any;

async function findProject(supabase: Client, projectKey: string) {
  // `*` so this keeps working if a column it doesn't need is missing.
  const { data } = await supabase.from("projects").select("*").eq("project_key", projectKey).maybeSingle();
  return data;
}

/**
 * What the reporter's device should surface: shipped fixes their build
 * already contains (→ "is it fixed?"), and developer/agent questions they
 * haven't answered yet.
 */
// deno-lint-ignore no-explicit-any
async function listUpdates(supabase: Client, projectId: string, reporterId: string, build: string | null): Promise<any[]> {
  const { data: items } = await supabase
    .from("feedback_items")
    .select("id, text, created_at, environment, fix_stage, fixed_in_build, fix_summary, shipped_at, screenshot_annotated_path, is_archived")
    .eq("project_id", projectId)
    .eq("reporter_id", reporterId)
    .eq("is_archived", false)
    .order("created_at", { ascending: false })
    .limit(50);
  if (!items || items.length === 0) return [];

  const ids = items.map((i: { id: string }) => i.id);
  const { data: events } = await supabase
    .from("feedback_events")
    .select("id, feedback_id, kind, actor_type, actor_label, body, data, visible_to_reporter, created_at")
    .in("feedback_id", ids)
    .order("created_at", { ascending: true });
  const byItem = new Map<string, EventRow[]>();
  for (const e of (events ?? []) as EventRow[]) {
    const list = byItem.get(e.feedback_id) ?? [];
    list.push(e);
    byItem.set(e.feedback_id, list);
  }

  const updates = [];
  for (const item of items) {
    const itemEvents = byItem.get(item.id) ?? [];
    const visible = itemEvents.filter((e) => e.visible_to_reporter);
    const needsVerification = item.fix_stage === "shipped" && buildIncludesFix(build, item.fixed_in_build);
    const openQuestion = findOpenQuestion(itemEvents);
    if (!needsVerification && !openQuestion) continue;

    updates.push({
      feedback_id: item.id,
      text: item.text,
      created_at: item.created_at,
      screen_name: item.environment?.screenName ?? null,
      fix_stage: item.fix_stage,
      fixed_in_build: item.fixed_in_build,
      fix_summary: item.fix_summary,
      shipped_at: item.shipped_at,
      needs_verification: needsVerification,
      open_question: openQuestion ? { id: openQuestion.id, body: openQuestion.body ?? "", created_at: openQuestion.created_at } : null,
      screenshot_url: item.screenshot_annotated_path ? await signedUrl(supabase, item.screenshot_annotated_path, 3600) : null,
      messages: visible.map((e) => ({
        id: e.id,
        kind: e.kind,
        body: e.body ?? "",
        author: e.actor_type === "reporter" ? "you" : (e.actor_label ?? "Developer"),
        created_at: e.created_at,
      })),
    });
    if (updates.length >= MAX_UPDATES) break;
  }
  return updates;
}

/** The latest question not followed by a reporter reply. */
function findOpenQuestion(events: EventRow[]): EventRow | null {
  let open: EventRow | null = null;
  for (const e of events) {
    if (e.kind === "question") open = e;
    else if (e.kind === "reporter_reply" || e.kind === "reopened" || e.kind === "verified") open = null;
  }
  return open;
}

async function insertEvent(
  supabase: Client,
  item: { id: string; project_id: string },
  e: {
    kind: string;
    body: string;
    data?: Record<string, unknown>;
    actorType?: "reporter" | "system";
    actorLabel?: string;
    visibleToReporter?: boolean;
  },
) {
  const { error } = await supabase.from("feedback_events").insert({
    feedback_id: item.id,
    project_id: item.project_id,
    kind: e.kind,
    actor_type: e.actorType ?? "reporter",
    actor_label: e.actorLabel ?? "Reporter",
    body: e.body,
    data: e.data ?? {},
    visible_to_reporter: e.visibleToReporter ?? true,
  });
  if (error) console.warn("Failed to record event:", error.message);
}

/** Runs `fn` against the item's linked GitHub issue, if there is one. Never throws. */
async function withGitHub(
  supabase: Client,
  project: { id: string; github_repo?: string | null; github_installation_id?: number | null },
  item: { github_issue_number?: number | null },
  fn: (token: string, repo: string, issue: number) => Promise<void>,
) {
  if (!item.github_issue_number || !project.github_repo) return;
  try {
    const token = await getProjectInstallationToken(supabase, project);
    if (token) await fn(token, project.github_repo, item.github_issue_number);
  } catch (err) {
    console.warn("GitHub sync failed:", err);
  }
}

async function signedUrl(supabase: Client, path: string, seconds: number): Promise<string | null> {
  const { data } = await supabase.storage.from("feedback-screenshots").createSignedUrl(path, seconds);
  return data?.signedUrl ?? null;
}

function quote(text: string): string {
  return text.replace(/\n/g, "\n> ");
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
