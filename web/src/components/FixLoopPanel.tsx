import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { TextWithCode } from "@/components/TextWithCode";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { getErrorMessage } from "@/lib/errors";
import { FIX_STAGE_META, FIX_STAGE_ORDER } from "@/lib/fixStageMeta";
import { reporterReachable, stuckHint } from "@/lib/loopHealth";
import { agentOptions, loadPreferredAgent, savePreferredAgent } from "@/lib/agents";
import type { FeedbackEvent, FeedbackEventKind, FeedbackItem, FixStage, Project } from "@/lib/types";
import { Button } from "@/components/Button";
import { AgentGlyph } from "@/components/AgentDispatchButton";
import { AlertIcon, CheckIcon, ExternalLinkIcon, GitHubIcon, MessageIcon, SparkleIcon } from "@/components/icons";
import { ImageOverlay } from "@/components/ImageOverlay";

/** Stages where an agent may be posting progress, so the timeline polls for it. */
const LIVE_STAGES: FixStage[] = ["agent_working", "pr_open", "reopened"];
const POLL_MS = 15_000;
/** The loop fields a poll re-reads, so the stepper and PR link follow along. */
const LOOP_FIELDS = "fix_stage, status, fix_pr_url, fix_pr_number, fix_commit_sha, fix_summary";

const KIND_LABEL: Record<FeedbackEventKind, string> = {
  comment: "Note",
  question: "Asked the reporter",
  reporter_reply: "Reporter replied",
  claimed: "Started working",
  dispatched: "Sent to coding agent",
  pr_opened: "Pull request opened",
  pr_merged: "Fix merged",
  pr_closed: "Pull request closed",
  fix_committed: "Fix pushed",
  shipped: "Shipped",
  verified: "Reporter verified the fix",
  reopened: "Reporter says it's still broken",
  status_changed: "Status changed",
  after_screenshot: "After-fix preview",
  promoted: "Released to production",
};

const ACTOR_TONE: Record<FeedbackEvent["actor_type"], string> = {
  reporter: "bg-amber-100 text-amber-800",
  agent: "bg-violet-100 text-violet-800",
  user: "bg-neutral-100 text-neutral-700",
  github: "bg-neutral-900 text-white",
  system: "bg-neutral-100 text-neutral-500",
};

/**
 * The closed loop for one report (0014_closed_loop.sql): where the fix is
 * (stepper), everything that happened (timeline — agent progress, PRs,
 * releases, the reporter's own verdict, before/after screenshots), and a
 * composer for notes or a question that appears on the reporter's device.
 *
 * Writes go straight to `feedback_events` as the signed-in user; RLS
 * enforces project membership and that the actor is really you.
 */
export function FixLoopPanel({
  feedback,
  project,
  onUpdated,
  onPreviewCount,
}: {
  feedback: FeedbackItem;
  /** For the "keep working on this PR" composer's agent choice. */
  project?: Pick<Project, "id" | "dispatch_labels" | "dispatch_comment" | "dispatch_copilot">;
  /** Called with the fields changed by an action here (e.g. Mark verified), or seen changed by a poll. */
  onUpdated?: (patch: Partial<FeedbackItem>) => void;
  /** How many after-fix previews the timeline has, so the screenshot viewer's After view can reload. */
  onPreviewCount?: (count: number) => void;
}) {
  const { user } = useAuth();
  const [events, setEvents] = useState<FeedbackEvent[] | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<"note" | "reporterNote" | "question">("note");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [overlayMedia, setOverlayMedia] = useState<{ url: string; caption?: string; isVideo?: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    const { data, error } = await supabase
      .from("feedback_events")
      .select("*")
      .eq("feedback_id", feedback.id)
      .order("created_at", { ascending: true });
    if (error) {
      setLoadError(getErrorMessage(error, "Couldn't load activity."));
      setEvents([]);
      return;
    }
    const rows = (data ?? []) as FeedbackEvent[];
    setEvents(rows);
    onPreviewCount?.(rows.filter((e) => e.kind === "after_screenshot").length);

    const paths = rows.flatMap((e) => {
      const p = e.data?.media_path ?? e.data?.screenshot_annotated_path ?? e.data?.screenshot_path;
      return typeof p === "string" ? [p] : [];
    });
    if (paths.length > 0) {
      const { data: signed } = await supabase.storage.from("feedback-screenshots").createSignedUrls(paths, 3600);
      const urls: Record<string, string> = {};
      for (const s of signed ?? []) if (s.path && s.signedUrl) urls[s.path] = s.signedUrl;
      setImageUrls(urls);
    } else {
      setImageUrls({});
    }
    // onPreviewCount is a notification, not an input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedback.id]);

  useEffect(() => {
    setEvents(null);
    setDraft("");
    setPostError(null);
    void load();
    // Reload when the item's loop fields change (e.g. after a status edit elsewhere on the page).
  }, [load, feedback.fix_stage, feedback.status]);

  // While an agent may be at work, poll: its progress notes and screenshots
  // show up as they're posted, and a PR it opens moves the stepper.
  const live = feedback.fix_stage != null && LIVE_STAGES.includes(feedback.fix_stage);
  const latest = useRef({ feedback, onUpdated });
  latest.current = { feedback, onUpdated };
  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void load();
      void supabase
        .from("feedback_items")
        .select(LOOP_FIELDS)
        .eq("id", latest.current.feedback.id)
        .single()
        .then(({ data }) => {
          if (!data) return;
          const row = data as Partial<FeedbackItem>;
          const current = latest.current.feedback;
          const changed = (Object.keys(row) as (keyof FeedbackItem)[]).some((k) => row[k] !== current[k]);
          if (changed) latest.current.onUpdated?.(row);
        });
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [live, load]);

  async function post() {
    const body = draft.trim();
    if (!body || !user) return;
    setPosting(true);
    setPostError(null);
    const { error } = await supabase.from("feedback_events").insert({
      feedback_id: feedback.id,
      project_id: feedback.project_id,
      kind: mode === "question" ? "question" : "comment",
      actor_type: "user",
      actor_user_id: user.id,
      actor_label: (user.user_metadata?.user_name as string | undefined) ?? user.email ?? "Developer",
      body,
      visible_to_reporter: mode !== "note",
    });
    setPosting(false);
    if (error) {
      setPostError(getErrorMessage(error, "Couldn't post."));
      return;
    }
    setDraft("");
    void load();
  }

  /**
   * The developer's override when the reporter can't or won't answer: same
   * end state as the reporter's "Yes, it's fixed" (fix_stage verified, status
   * resolved), recorded as the developer so the timeline says who decided.
   */
  async function markVerified() {
    if (!user) return;
    setVerifying(true);
    setPostError(null);
    const verifiedAt = new Date().toISOString();
    const { error } = await supabase
      .from("feedback_items")
      .update({ fix_stage: "verified", status: "resolved", verified_at: verifiedAt })
      .eq("id", feedback.id);
    if (!error) {
      await supabase.from("feedback_events").insert({
        feedback_id: feedback.id,
        project_id: feedback.project_id,
        kind: "verified",
        actor_type: "user",
        actor_user_id: user.id,
        actor_label: (user.user_metadata?.user_name as string | undefined) ?? user.email ?? "Developer",
        body: "Marked verified by the team (not confirmed by the reporter).",
        data: { by: "team" },
      });
    }
    setVerifying(false);
    if (error) {
      setPostError(getErrorMessage(error, "Couldn't mark it verified."));
      return;
    }
    onUpdated?.({ fix_stage: "verified", status: "resolved", verified_at: verifiedAt });
    // Branch delivery: this may be what the PR's "FeedbackKit" check waits for.
    if (feedback.fix_pr_number) {
      void supabase.functions
        .invoke("pr-status", { body: { project_id: feedback.project_id, pr_number: feedback.fix_pr_number } })
        .catch(() => {});
    }
  }

  // "Keep working on this PR": a follow-up for the agent on its own open PR
  // (create-github-issue `follow_up`), for another pass on top of it.
  const followUpAgents = useMemo(
    () => (project ? agentOptions(project).filter((o) => o.configured && o.target === "github" && o.id !== "all") : []),
    [project],
  );
  const [followUp, setFollowUp] = useState("");
  const [followUpAgent, setFollowUpAgent] = useState<string>("");
  const [followUpState, setFollowUpState] = useState<"idle" | "sending" | "sent">("idle");
  const [followUpError, setFollowUpError] = useState<string | null>(null);
  useEffect(() => {
    const saved = project ? loadPreferredAgent(project.id) : null;
    setFollowUpAgent(followUpAgents.find((o) => o.id === saved)?.id ?? followUpAgents[0]?.id ?? "");
  }, [project, followUpAgents]);
  useEffect(() => {
    setFollowUp("");
    setFollowUpState("idle");
    setFollowUpError(null);
  }, [feedback.id]);

  async function sendFollowUp() {
    const instructions = followUp.trim();
    if (!instructions || !followUpAgent || !project) return;
    setFollowUpState("sending");
    setFollowUpError(null);
    savePreferredAgent(project.id, followUpAgent);
    const { data, error } = await supabase.functions.invoke("create-github-issue", {
      body: { project_id: feedback.project_id, feedback_id: feedback.id, agent: followUpAgent, follow_up: { instructions } },
    });
    if (error) {
      const body =
        error instanceof FunctionsHttpError ? ((await error.context.json().catch(() => null)) as { message?: string } | null) : null;
      setFollowUpState("idle");
      setFollowUpError(body?.message ?? getErrorMessage(error, "Couldn't reach the agent."));
      return;
    }
    if (data?.copilot_error === "github_user_not_connected") {
      setFollowUpError("Copilot needs your GitHub account: connect it in Settings → Coding agent loop.");
    }
    setFollowUp("");
    setFollowUpState("sent");
    setTimeout(() => setFollowUpState("idle"), 4000);
    void load();
  }

  const stage = feedback.fix_stage ?? null;
  const hint = events ? stuckHint(feedback, events) : null;
  const reachedIndex = stage && stage !== "reopened" ? FIX_STAGE_ORDER.indexOf(stage) : -1;
  const canReachReporter = reporterReachable(feedback);

  return (
    <div className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Fix loop</h3>
        {feedback.reporter?.email || feedback.reporter?.name ? (
          <span className="truncate text-[11px] text-neutral-500">
            Reported by {feedback.reporter.name ?? feedback.reporter.email}
          </span>
        ) : null}
      </div>

      {/* Stepper: Reported → Agent working → PR → Merged → Shipped → Verified */}
      <ol className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <StepPill label="Reported" done />
        {FIX_STAGE_ORDER.map((s, i) => (
          <StepPill key={s} label={FIX_STAGE_META[s].label} done={i <= reachedIndex} current={s === stage} />
        ))}
      </ol>

      {stage === "reopened" ? (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <span>
            The reporter says the fix{feedback.fixed_in_build ? ` in build ${feedback.fixed_in_build}` : ""} didn&apos;t work
            {(feedback.reopen_count ?? 0) > 1 ? ` (reopened ${feedback.reopen_count}×)` : ""}. Their latest screenshot is
            in the timeline below, and agents see it via <code className="font-mono">get_feedback</code>.
          </span>
        </div>
      ) : null}

      {hint ? (
        <div
          className={`flex flex-wrap items-start justify-between gap-2 rounded-lg border px-3 py-2 text-xs ${
            hint.tone === "warning" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-neutral-200 bg-neutral-50 text-neutral-700"
          }`}
        >
          <span className="flex min-w-0 flex-1 items-start gap-2">
            <AlertIcon className={`mt-0.5 h-4 w-4 shrink-0 ${hint.tone === "warning" ? "text-amber-600" : "text-neutral-400"}`} />
            <span>
              <TextWithCode text={hint.message} />
            </span>
          </span>
          {hint.offerMarkVerified ? (
            <Button type="button" size="sm" variant="secondary" disabled={verifying} onClick={() => void markVerified()}>
              {verifying ? "Saving…" : "Mark verified"}
            </Button>
          ) : null}
        </div>
      ) : null}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        {feedback.fix_pr_url ? (
          <div className="col-span-2 flex items-center gap-1.5">
            <GitHubIcon className="h-3.5 w-3.5 text-neutral-600" />
            <a href={feedback.fix_pr_url} target="_blank" rel="noreferrer" className="truncate font-medium text-blue-700 hover:underline">
              {feedback.fix_pr_number ? `PR #${feedback.fix_pr_number}` : feedback.fix_pr_url}
            </a>
            <ExternalLinkIcon className="h-3 w-3 text-neutral-400" />
          </div>
        ) : null}
        {feedback.fix_summary ? (
          <div className="col-span-2 text-neutral-700">
            <span className="text-neutral-400">Fix: </span>
            {feedback.fix_summary}
          </div>
        ) : null}
        {feedback.fixed_in_build ? <Detail label="Shipped in build" value={feedback.fixed_in_build} mono /> : null}
        {feedback.verified_at ? <Detail label="Verified" value={new Date(feedback.verified_at).toLocaleString()} /> : null}
      </dl>

      {stage === "pr_open" && feedback.fix_pr_number && project ? (
        <div className="space-y-2 rounded-lg border border-violet-200 bg-violet-50/40 p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-900">
            <SparkleIcon className="h-3.5 w-3.5 text-violet-600" />
            Keep working on PR #{feedback.fix_pr_number}
          </div>
          {followUpAgents.length === 0 ? (
            <p className="text-[11px] text-neutral-500">
              Set up a coding agent in Settings → Coding agent loop to send it another pass on this PR.
            </p>
          ) : (
            <>
              <p className="text-[11px] leading-relaxed text-neutral-500">
                Starts a new agent session on top of this PR: it reads your note (posted on the PR), commits onto the
                same branch, and posts new screenshots here.
              </p>
              <textarea
                value={followUp}
                onChange={(e) => setFollowUp(e.target.value)}
                rows={2}
                placeholder="What should change, e.g. “Keep the old spacing on mobile” or “Also handle the empty state”"
                className="w-full resize-y rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs focus:border-neutral-400 focus:outline-none"
              />
              <div className="flex flex-wrap items-center justify-end gap-2">
                {followUpError ? <span className="mr-auto text-xs text-red-600">{followUpError}</span> : null}
                {followUpState === "sent" ? (
                  <span className="mr-auto inline-flex items-center gap-1 text-xs text-emerald-700">
                    <CheckIcon className="h-3.5 w-3.5" /> Sent — the agent picks it up from the PR
                  </span>
                ) : null}
                <label className="inline-flex items-center gap-1.5 text-xs text-neutral-600">
                  {followUpAgents.find((o) => o.id === followUpAgent) ? (
                    <AgentGlyph icon={followUpAgents.find((o) => o.id === followUpAgent)!.icon} />
                  ) : null}
                  <select
                    value={followUpAgent}
                    onChange={(e) => setFollowUpAgent(e.target.value)}
                    aria-label="Agent"
                    className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs focus:border-neutral-400 focus:outline-none"
                  >
                    {followUpAgents.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  type="button"
                  size="sm"
                  disabled={followUpState === "sending" || !followUp.trim()}
                  onClick={() => void sendFollowUp()}
                >
                  {followUpState === "sending" ? "Sending…" : "Send to agent"}
                </Button>
              </div>
            </>
          )}
        </div>
      ) : null}

      {!canReachReporter ? (
        <p className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-3 py-2 text-[11px] text-neutral-500">
          {feedback.reporter_id
            ? "The reporter chose not to hear back (\u201cNotify me when it\u2019s fixed\u201d was off), so they won\u2019t be asked to verify a fix or see questions."
            : "This report came from an older SDK without a reporter id, so its reporter can\u2019t be asked to verify a fix on their device. Reports from current SDKs can."}
        </p>
      ) : null}

      {/* Timeline */}
      {loadError ? <p className="text-xs text-red-600">{loadError}</p> : null}
      {events === null ? (
        <div className="h-16 animate-pulse rounded-lg bg-neutral-100" />
      ) : events.length === 0 ? (
        <p className="text-xs text-neutral-500">
          No activity yet. Send it to a coding agent (Create GitHub Issue, or <code className="font-mono">get_prompt</code>{" "}
          over MCP) — progress, PRs and the reporter&apos;s verdict will show up here.
        </p>
      ) : (
        <ol className="space-y-3 border-l border-neutral-200 pl-4">
          {events.map((e) => {
            const shotPath = (e.data?.media_path ?? e.data?.screenshot_annotated_path ?? e.data?.screenshot_path) as string | undefined;
            const isVideo = typeof e.data?.media_type === "string" && e.data.media_type.startsWith("video/");
            const prUrl =
              typeof e.data?.pr_url === "string" ? e.data.pr_url : typeof e.data?.commit_url === "string" ? e.data.commit_url : null;
            return (
              <li key={e.id} className="relative">
                <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-neutral-300" />
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="font-medium text-neutral-900">{e.kind === "verified" && e.actor_type !== "reporter" ? "Marked verified by the team" : (KIND_LABEL[e.kind] ?? e.kind)}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${ACTOR_TONE[e.actor_type]}`}>
                    {e.actor_label ?? e.actor_type}
                  </span>
                  {e.visible_to_reporter && e.actor_type !== "reporter" ? (
                    <span className="text-[10px] text-amber-700" title="Shown on the reporter's device">
                      · visible to reporter
                    </span>
                  ) : null}
                  <span className="text-[10px] text-neutral-400">{new Date(e.created_at).toLocaleString()}</span>
                </div>
                {e.body ? <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-neutral-700">{e.body}</p> : null}
                {prUrl ? (
                  <a href={prUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[11px] text-blue-700 hover:underline">
                    {prUrl.replace(/^https:\/\/github\.com\//, "")}
                    <ExternalLinkIcon className="h-3 w-3" />
                  </a>
                ) : null}
                {e.kind === "after_screenshot" && e.data?.expired_at ? (
                  <p className="mt-1 text-[11px] italic text-neutral-400">Preview expired (deleted 14 days after the report was resolved).</p>
                ) : null}
                {shotPath && imageUrls[shotPath] && isVideo ? (
                  <div className="mt-2 block w-56">
                    <video
                      src={imageUrls[shotPath]}
                      controls
                      playsInline
                      className="block max-h-56 w-56 rounded-md border border-neutral-200 bg-black cursor-pointer"
                    />
                  </div>
                ) : shotPath && imageUrls[shotPath] ? (
                  <button
                    type="button"
                    onClick={() =>
                      setOverlayMedia({
                        url: imageUrls[shotPath],
                        caption: e.body || (e.kind === "after_screenshot" ? "Screenshot after the fix" : "Reporter's new screenshot"),
                        isVideo: false,
                      })
                    }
                    title="Click to expand"
                    className="mt-2 block w-40 cursor-pointer text-left group"
                  >
                    <img
                      src={imageUrls[shotPath]}
                      alt={e.kind === "after_screenshot" ? "Screenshot after the fix" : "Reporter's new screenshot"}
                      className="max-h-56 w-full rounded-md border border-neutral-200 object-contain bg-neutral-50 group-hover:border-neutral-400 group-hover:shadow-xs transition-all"
                    />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}

      {/* Composer */}
      <div className="space-y-2 border-t border-neutral-100 pt-3">
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Post as">
          <ModeChip active={mode === "note"} onClick={() => setMode("note")} icon={<MessageIcon className="h-3 w-3" />}>
            Internal note
          </ModeChip>
          <ModeChip
            active={mode === "reporterNote"}
            disabled={!canReachReporter}
            onClick={() => setMode("reporterNote")}
            icon={<SparkleIcon className="h-3 w-3" />}
          >
            Note to reporter
          </ModeChip>
          <ModeChip
            active={mode === "question"}
            disabled={!canReachReporter}
            onClick={() => setMode("question")}
            icon={<AlertIcon className="h-3 w-3" />}
          >
            Ask reporter
          </ModeChip>
        </div>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          placeholder={
            mode === "question"
              ? "A question for the reporter — it appears in their app next time they open it"
              : mode === "reporterNote"
              ? "Shown to the reporter alongside the fix, e.g. what changed"
              : "Only your team (and agents via MCP) will see this"
          }
          className="w-full resize-y rounded-lg border border-neutral-200 px-3 py-2 text-xs focus:border-neutral-400 focus:outline-none"
        />
        {postError ? <p className="text-xs text-red-600">{postError}</p> : null}
        <div className="flex justify-end">
          <Button type="button" size="sm" disabled={posting || !draft.trim()} onClick={() => void post()}>
            {posting ? "Posting…" : mode === "question" ? "Ask" : "Post"}
          </Button>
        </div>
      </div>
      {overlayMedia && (
        <ImageOverlay
          src={overlayMedia.url}
          alt={overlayMedia.caption}
          caption={overlayMedia.caption}
          isVideo={overlayMedia.isVideo}
          onClose={() => setOverlayMedia(null)}
        />
      )}
    </div>
  );
}

function StepPill({ label, done = false, current = false }: { label: string; done?: boolean; current?: boolean }) {
  return (
    <li
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${
        current
          ? "border-neutral-900 bg-neutral-900 text-white"
          : done
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-neutral-200 bg-white text-neutral-400"
      }`}
    >
      {done && !current ? <CheckIcon className="h-3 w-3" /> : null}
      {label}
    </li>
  );
}

function ModeChip({
  active,
  disabled,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={onClick}
      title={disabled ? "This report has no reporter id (older SDK), so it can't reach their device." : undefined}
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-neutral-400">{label}</dt>
      <dd className={`mt-0.5 text-neutral-800 ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
