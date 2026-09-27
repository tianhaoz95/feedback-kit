import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { getErrorMessage } from "@/lib/errors";
import { track } from "@/lib/analytics";
import type { DeliveryMode, Project } from "@/lib/types";
import { CheckIcon, LayersIcon } from "@/components/icons";
import { TextWithCode } from "@/components/TextWithCode";

const MODES: { mode: DeliveryMode; title: string; summary: string; points: string[] }[] = [
  {
    mode: "batch",
    title: "Batch",
    summary: "Fixes land on the main branch and ship together in the next beta. Good for small teams.",
    points: [
      "Agents may commit straight to the main branch (or open PRs you merge).",
      "Each beta build ships every merged fix in it; reporters confirm on the beta.",
      "You promote a beta to production once its fixes are verified (Releases tab).",
    ],
  },
  {
    mode: "branch",
    title: "Branch previews",
    summary: "Each fix is checked on a preview build of its pull request before it merges. Good for larger teams.",
    points: [
      "Agents always open a pull request and never push to the main branch.",
      "CI builds a preview of the PR and runs `feedbackkit release --channel preview --pr <n>`.",
      "A \"FeedbackKit\" check on the PR turns green once every linked report is verified; make it required to block merging until then.",
    ],
  },
];

/**
 * Project Settings → Delivery (0024_delivery_modes.sql). Changes what agents
 * are told to do, whether PRs get the FeedbackKit check, and how releases
 * read; the CI side is set up with the setup-release-loop skill.
 */
export function DeliveryModeCard({
  project,
  onProjectUpdated,
}: {
  project: Project;
  onProjectUpdated: (updated: Partial<Project>) => void;
}) {
  const current: DeliveryMode = project.delivery_mode ?? "batch";
  const [saving, setSaving] = useState<DeliveryMode | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(mode: DeliveryMode) {
    if (mode === current) return;
    setSaving(mode);
    setError(null);
    const { error: updateError } = await supabase.from("projects").update({ delivery_mode: mode }).eq("id", project.id);
    setSaving(null);
    if (updateError) {
      setError(getErrorMessage(updateError, "Couldn't change the delivery mode."));
      return;
    }
    track("delivery_mode_changed", { mode }, project.organization_id);
    onProjectUpdated({ delivery_mode: mode });
  }

  return (
    <section className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div>
        <div className="flex items-center gap-2">
          <LayersIcon className="h-5 w-5 text-neutral-900" />
          <h2 className="text-base font-semibold text-neutral-900">Delivery</h2>
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          How a fix gets from a coding agent to your users. Both end with the reporter (or your team) confirming it.{" "}
          <Link to="/docs/delivery" className="underline">
            Compare them
          </Link>
          .
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Delivery mode">
        {MODES.map((m) => {
          const selected = m.mode === current;
          return (
            <button
              key={m.mode}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={saving !== null}
              onClick={() => void choose(m.mode)}
              className={`flex flex-col items-stretch justify-start rounded-lg border p-4 text-left transition-colors ${
                selected ? "border-neutral-900 ring-1 ring-neutral-900" : "border-neutral-200 hover:border-neutral-400"
              }`}
            >
              <span className="flex items-center justify-between">
                <span className="text-sm font-semibold text-neutral-900">{m.title}</span>
                {selected ? <CheckIcon className="h-4 w-4 text-neutral-900" /> : null}
                {saving === m.mode ? <span className="text-xs text-neutral-400">Saving…</span> : null}
              </span>
              <span className="mt-1 block text-xs text-neutral-600">{m.summary}</span>
              <ul className="mt-3 space-y-1.5 text-xs text-neutral-500">
                {m.points.map((point) => (
                  <li key={point} className="flex gap-1.5">
                    <span aria-hidden="true">·</span>
                    <span>
                      <TextWithCode text={point} />
                    </span>
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>
      {current === "branch" ? (
        <p className="rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
          The PR check needs the FeedbackKit GitHub App to have <strong>Commit statuses: Read and write</strong>. Then, in
          your repository&apos;s branch protection, require the <strong>FeedbackKit</strong> status check.
        </p>
      ) : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </section>
  );
}
