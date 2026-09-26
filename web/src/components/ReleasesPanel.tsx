import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { getErrorMessage } from "@/lib/errors";
import type { FeedbackItem, ReleaseReadiness } from "@/lib/types";
import { verdictFor, type Verdict } from "@/lib/releaseVerdict";
import { Button } from "@/components/Button";
import { FixStageBadge } from "@/components/FixStageBadge";
import { AlertIcon, CheckIcon, ChevronDownIcon, GitHubIcon, LayersIcon } from "@/components/icons";

/**
 * Release readiness (DESIGN.md §8): every push to main ships a beta build;
 * this is where the owner decides which beta to promote to production. For
 * each release: which fixes it shipped, how many reporters confirmed them on
 * device, and whether any came back "still broken". Reads the
 * `release_readiness` view (0015) — RLS applies through it.
 */
export function ReleasesPanel({
  projectId,
  githubRepo,
  onOpenFeedback,
}: {
  projectId: string;
  githubRepo?: string | null;
  onOpenFeedback: (id: string) => void;
}) {
  const { user } = useAuth();
  const [releases, setReleases] = useState<ReleaseReadiness[] | null>(null);
  const [unreleased, setUnreleased] = useState<FeedbackItem[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [fixesByBuild, setFixesByBuild] = useState<Record<string, FeedbackItem[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [promoting, setPromoting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const [readiness, merged] = await Promise.all([
      supabase
        .from("release_readiness")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("feedback_items")
        .select("*")
        .eq("project_id", projectId)
        .eq("fix_stage", "merged")
        .order("created_at", { ascending: false }),
    ]);
    if (readiness.error) {
      setError(getErrorMessage(readiness.error, "Couldn't load releases."));
      setReleases([]);
      return;
    }
    setReleases((readiness.data ?? []) as ReleaseReadiness[]);
    setUnreleased((merged.data ?? []) as FeedbackItem[]);
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(release: ReleaseReadiness) {
    if (expanded === release.release_id) {
      setExpanded(null);
      return;
    }
    setExpanded(release.release_id);
    if (!fixesByBuild[release.build]) {
      const { data } = await supabase
        .from("feedback_items")
        .select("*")
        .eq("project_id", projectId)
        .eq("fixed_in_build", release.build)
        .order("created_at", { ascending: false });
      setFixesByBuild((current) => ({ ...current, [release.build]: (data ?? []) as FeedbackItem[] }));
    }
  }

  async function markPromoted(release: ReleaseReadiness) {
    if (!user) return;
    setPromoting(release.release_id);
    setError(null);
    const { error: updateError } = await supabase
      .from("releases")
      .update({ channel: "production", promoted_at: new Date().toISOString(), promoted_by: user.id })
      .eq("id", release.release_id);
    if (updateError) {
      setPromoting(null);
      setError(getErrorMessage(updateError, "Couldn't mark the release as promoted."));
      return;
    }
    // A timeline entry on every report this build fixed.
    const { data: items } = await supabase
      .from("feedback_items")
      .select("id")
      .eq("project_id", projectId)
      .eq("fixed_in_build", release.build);
    if (items && items.length > 0) {
      await supabase.from("feedback_events").insert(
        items.map((item: { id: string }) => ({
          feedback_id: item.id,
          project_id: projectId,
          kind: "promoted",
          actor_type: "user",
          actor_user_id: user.id,
          actor_label: (user.user_metadata?.user_name as string | undefined) ?? user.email ?? "Owner",
          body: `Build ${release.build} released to production.`,
          data: { build: release.build },
        })),
      );
    }
    setPromoting(null);
    void load();
  }

  if (releases === null) {
    return <div className="h-40 animate-pulse rounded-xl border border-neutral-200 bg-neutral-100" />;
  }

  const latestBeta = releases.find((r) => r.channel === "beta");

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
        <div className="flex items-center gap-2">
          <LayersIcon className="h-5 w-5 text-neutral-900" />
          <h2 className="text-base font-semibold text-neutral-900">Release readiness</h2>
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          Every push to main ships a beta build. Fixes in it go to the people who reported them, who confirm on their
          device. Promote a beta to production in App Store Connect (or wherever you ship) once its fixes are verified,
          then mark it here — or run <code className="font-mono">feedbackkit promote --build &lt;n&gt;</code>.
        </p>
        {latestBeta ? (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-neutral-50 px-4 py-3 text-sm">
            <span className="text-neutral-500">Latest beta</span>
            <span className="font-mono font-medium text-neutral-900">{latestBeta.build}</span>
            <VerdictBadge verdict={verdictFor(latestBeta)} />
          </div>
        ) : null}
        {error ? <p className="mt-3 text-xs text-red-600">{error}</p> : null}
      </div>

      {unreleased.length > 0 ? (
        <section className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-700">
            Waiting for the next build ({unreleased.length})
          </h3>
          <ul className="mt-2 space-y-1.5">
            {unreleased.map((item) => (
              <FixRow key={item.id} item={item} onOpen={onOpenFeedback} />
            ))}
          </ul>
        </section>
      ) : null}

      {releases.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-200 bg-white px-4 py-8 text-center text-sm text-neutral-500">
          No releases yet. They appear here when CI (or <code className="font-mono">feedbackkit release</code>) announces a
          build.
        </p>
      ) : (
        <ul className="space-y-3">
          {releases.map((release) => {
            const verdict = verdictFor(release);
            const isOpen = expanded === release.release_id;
            const commitUrl =
              githubRepo && release.commit_sha ? `https://github.com/${githubRepo}/commit/${release.commit_sha}` : null;
            return (
              <li key={release.release_id} className="rounded-xl border border-neutral-200 bg-white shadow-xs">
                <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => void toggle(release)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    aria-expanded={isOpen}
                  >
                    <ChevronDownIcon className={`h-4 w-4 shrink-0 text-neutral-400 transition-transform ${isOpen ? "" : "-rotate-90"}`} />
                    <span className="font-mono text-sm font-semibold text-neutral-900">{release.build}</span>
                    {release.version ? <span className="text-xs text-neutral-500">{release.version}</span> : null}
                    <ChannelBadge release={release} />
                    {release.product_key ? (
                      <span className="rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-mono text-[10px] text-neutral-600">
                        {release.product_key}
                      </span>
                    ) : null}
                    <span className="text-[11px] text-neutral-400">
                      {new Date(release.created_at).toLocaleString()} · {release.source === "ci" ? "CI" : "CLI"}
                    </span>
                  </button>
                  <VerdictBadge verdict={verdict} />
                  {release.channel === "beta" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant={verdict.tone === "green" ? "primary" : "secondary"}
                      disabled={promoting === release.release_id}
                      onClick={() => void markPromoted(release)}
                      title="Record that this build was released to production"
                    >
                      {promoting === release.release_id ? "Saving…" : "Mark as released"}
                    </Button>
                  ) : null}
                </div>
                {isOpen ? (
                  <div className="space-y-3 border-t border-neutral-100 px-4 py-3">
                    <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
                      <Stat label="Fixes" value={release.fixes} />
                      <Stat label="Verified" value={release.verified} tone="text-emerald-700" />
                      <Stat label="Awaiting reporter" value={release.awaiting} tone="text-amber-700" />
                      <Stat label="Reopened" value={release.reopened} tone="text-red-700" />
                      {release.unreachable > 0 ? (
                        <Stat label="No reporter to ask" value={release.unreachable} tone="text-neutral-500" />
                      ) : null}
                      {commitUrl ? (
                        <a href={commitUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-700 hover:underline">
                          <GitHubIcon className="h-3 w-3" />
                          {release.commit_sha?.slice(0, 7)}
                        </a>
                      ) : null}
                    </dl>
                    {(fixesByBuild[release.build] ?? []).length === 0 ? (
                      <p className="text-xs text-neutral-500">No reports list this build as their fix.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {fixesByBuild[release.build].map((item) => (
                          <FixRow key={item.id} item={item} onOpen={onOpenFeedback} />
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const tones = {
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
    neutral: "bg-neutral-50 text-neutral-600 border-neutral-200",
  } as const;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${tones[verdict.tone]}`}>
      {verdict.tone === "green" ? <CheckIcon className="h-3 w-3" /> : verdict.tone === "red" ? <AlertIcon className="h-3 w-3" /> : null}
      {verdict.label}
    </span>
  );
}

function ChannelBadge({ release }: { release: ReleaseReadiness }) {
  return release.channel === "production" ? (
    <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-semibold text-white">Production</span>
  ) : (
    <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700">Beta</span>
  );
}

function Stat({ label, value, tone = "text-neutral-900" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="flex items-baseline gap-1">
      <dt className="text-neutral-400">{label}</dt>
      <dd className={`font-semibold ${tone}`}>{value}</dd>
    </div>
  );
}

function FixRow({ item, onOpen }: { item: FeedbackItem; onOpen: (id: string) => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(item.id)}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-neutral-50"
      >
        {item.fix_stage ? <FixStageBadge stage={item.fix_stage} className="shrink-0" /> : null}
        <span className="min-w-0 flex-1 truncate text-neutral-800">{item.text || "(no description)"}</span>
        {item.fix_summary ? <span className="hidden max-w-[40%] truncate text-neutral-400 sm:inline">{item.fix_summary}</span> : null}
      </button>
    </li>
  );
}
