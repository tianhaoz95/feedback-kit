import { useEffect, useState } from "react";
import { TextWithCode } from "@/components/TextWithCode";
import { supabase } from "@/lib/supabase";
import { loopChecklist, type LoopStep } from "@/lib/loopHealth";
import type { FeedbackItem, Project } from "@/lib/types";
import { CheckIcon, ChevronDownIcon } from "@/components/icons";

type TabTarget = "sdk" | "settings" | "agent" | "releases";

/** Where each step's "how to" leads in the project page. */
const STEP_TAB: Partial<Record<LoopStep["id"], TabTarget>> = {
  report: "sdk",
  verification: "sdk",
  github: "settings",
  agent: "agent",
  announced: "releases",
};

/**
 * The closed loop's setup, checked against what has actually happened in this
 * project (lib/loopHealth.ts): a missing piece otherwise fails silently —
 * fixes just sit at "Merged". Hidden once every step is done.
 */
export function LoopChecklist({
  project,
  feedbackItems,
  onGoToTab,
}: {
  project: Project;
  feedbackItems: FeedbackItem[];
  onGoToTab: (tab: TabTarget) => void;
}) {
  const [signals, setSignals] = useState<{ agent: boolean; linked: boolean; release: boolean; verified: boolean } | null>(null);
  const storageKey = `feedbackkit.loopChecklist.${project.id}`;
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === "collapsed";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    let cancelled = false;
    const exists = async (kinds: string[]) => {
      const { count } = await supabase
        .from("feedback_events")
        .select("id", { count: "exact", head: true })
        .eq("project_id", project.id)
        .in("kind", kinds);
      return (count ?? 0) > 0;
    };
    void (async () => {
      const [agent, linked, verified, releases] = await Promise.all([
        exists(["claimed", "dispatched"]),
        exists(["pr_opened", "pr_merged", "fix_committed"]),
        exists(["verified"]),
        supabase.from("releases").select("id", { count: "exact", head: true }).eq("project_id", project.id),
      ]);
      if (!cancelled) setSignals({ agent, linked, verified, release: (releases.count ?? 0) > 0 });
    })();
    return () => {
      cancelled = true;
    };
  }, [project.id, feedbackItems.length]);

  if (!signals) return null;
  const steps = loopChecklist({
    hasReport: feedbackItems.length > 0,
    hasReporterId: feedbackItems.some((f) => !!f.reporter_id),
    project,
    hasAgentActivity: signals.agent,
    hasLinkedFix: signals.linked || feedbackItems.some((f) => !!f.fix_pr_url || !!f.fix_commit_sha),
    hasRelease: signals.release,
    hasVerified: signals.verified,
  });
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  const next = steps.find((s) => !s.done)!;

  function toggle() {
    const nextCollapsed = !collapsed;
    setCollapsed(nextCollapsed);
    try {
      localStorage.setItem(storageKey, nextCollapsed ? "collapsed" : "open");
    } catch {
      // Private mode: just not remembered.
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-neutral-200 bg-white shadow-xs">
      <button type="button" onClick={toggle} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
        <div className="min-w-0">
          <p className="text-sm font-medium text-neutral-900">
            Closed loop setup · {done} of {steps.length}
          </p>
          <p className="truncate text-xs text-neutral-500">Next: {next.title}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="hidden h-1.5 w-28 rounded-full bg-neutral-100 sm:block">
            <div className="h-1.5 rounded-full bg-neutral-900" style={{ width: `${(done / steps.length) * 100}%` }} />
          </div>
          <ChevronDownIcon className={`h-4 w-4 text-neutral-400 transition-transform ${collapsed ? "" : "rotate-180"}`} />
        </div>
      </button>
      {collapsed ? null : (
        <ol className="space-y-2 border-t border-neutral-100 px-4 py-3">
          {steps.map((step) => (
            <li key={step.id} className="flex items-start gap-2.5 text-xs">
              <span
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                  step.done ? "bg-emerald-500 text-white" : "border border-neutral-300"
                }`}
              >
                {step.done ? <CheckIcon className="h-3 w-3" /> : null}
              </span>
              <div className="min-w-0">
                <p className={step.done ? "text-neutral-400 line-through" : "font-medium text-neutral-900"}>{step.title}</p>
                {step.done ? null : (
                  <p className="mt-0.5 text-neutral-500">
                    <TextWithCode text={step.howTo} />
                    {STEP_TAB[step.id] ? (
                      <>
                        {" "}
                        <button type="button" onClick={() => onGoToTab(STEP_TAB[step.id]!)} className="font-medium text-neutral-900 underline">
                          Open
                        </button>
                      </>
                    ) : null}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
