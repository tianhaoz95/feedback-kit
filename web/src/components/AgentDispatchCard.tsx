import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { getErrorMessage } from "@/lib/errors";
import type { Project } from "@/lib/types";
import { Button } from "@/components/Button";
import { CopyButton } from "@/components/CopyButton";
import { CheckIcon, SparkleIcon } from "@/components/icons";

/**
 * How the loop hands work to a coding agent and gets it back to the reporter
 * (0014_closed_loop.sql): `projects.dispatch_labels` / `dispatch_comment`
 * are applied to every GitHub issue FeedbackKit creates (and re-applied when
 * a reporter reopens one), and `feedbackkit release` is what ships fixes to
 * reporters' devices.
 */
export function AgentDispatchCard({
  project,
  onProjectUpdated,
}: {
  project: Project;
  onProjectUpdated: (updated: Partial<Project>) => void;
}) {
  const [labels, setLabels] = useState((project.dispatch_labels ?? []).join(", "));
  const [comment, setComment] = useState(project.dispatch_comment ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const releaseCommand = `npx feedbackkit-cli release --project ${project.id} --build "$BUILD_NUMBER"`;

  async function save() {
    const nextLabels = labels
      .split(",")
      .map((l) => l.trim())
      .filter(Boolean);
    const nextComment = comment.trim() || null;
    setSaving(true);
    setError(null);
    setSaved(false);
    const { error: updateError } = await supabase
      .from("projects")
      .update({ dispatch_labels: nextLabels, dispatch_comment: nextComment })
      .eq("id", project.id);
    setSaving(false);
    if (updateError) {
      setError(getErrorMessage(updateError, "Failed to save."));
      return;
    }
    onProjectUpdated({ dispatch_labels: nextLabels, dispatch_comment: nextComment });
    setSaved(true);
  }

  return (
    <section className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div>
        <div className="flex items-center gap-2">
          <SparkleIcon className="h-5 w-5 text-neutral-900" />
          <h2 className="text-base font-semibold text-neutral-900">Coding agent loop</h2>
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          Hand new GitHub issues to a coding agent automatically, and send fixes back to the person who reported
          them. When a reporter says a fix didn&apos;t work, the issue is reopened and handed to the agent again.
        </p>
      </div>

      <div className="space-y-3">
        <label className="block text-xs font-medium text-neutral-700">
          Labels to add
          <input
            value={labels}
            onChange={(e) => {
              setLabels(e.target.value);
              setSaved(false);
            }}
            placeholder="claude"
            className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 font-mono text-xs focus:border-neutral-400 focus:outline-none"
          />
          <span className="mt-1 block font-normal text-neutral-500">
            Comma-separated. A label is the most reliable trigger — e.g. <code className="font-mono">claude</code> for
            claude-code-action&apos;s <code className="font-mono">label_trigger</code>, or whatever your agent workflow
            listens for.
          </span>
        </label>
        <label className="block text-xs font-medium text-neutral-700">
          Trigger comment
          <input
            value={comment}
            onChange={(e) => {
              setComment(e.target.value);
              setSaved(false);
            }}
            placeholder="@claude please fix this"
            className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 font-mono text-xs focus:border-neutral-400 focus:outline-none"
          />
          <span className="mt-1 block font-normal text-neutral-500">
            Optional. Posted by the FeedbackKit GitHub App, so only agents that accept mentions from apps will act on it.
            To use GitHub&apos;s own Copilot, Claude or Codex agents, assign the issue to them on GitHub.
          </span>
        </label>
        <div className="flex items-center gap-3">
          <Button type="button" size="sm" variant="secondary" disabled={saving} onClick={() => void save()}>
            {saving ? "Saving…" : "Save"}
          </Button>
          {saved ? (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
              <CheckIcon className="h-3.5 w-3.5" /> Saved
            </span>
          ) : null}
          {error ? <span className="text-xs text-red-600">{error}</span> : null}
        </div>
      </div>

      <div className="space-y-2 border-t border-neutral-100 pt-4">
        <h3 className="text-xs font-semibold text-neutral-900">Ship fixes back to reporters</h3>
        <p className="text-xs text-neutral-500">
          Run this from your repo after each build is uploaded (e.g. at the end of your TestFlight or deploy script).
          Every merged fix contained in that commit is marked shipped, and its reporter is asked &ldquo;is it
          fixed?&rdquo; the next time they open that build.
        </p>
        <div className="flex items-start gap-2 rounded-lg bg-neutral-900 px-3 py-2.5">
          <pre className="flex-1 overflow-x-auto font-mono text-[11px] leading-relaxed text-neutral-100">
            {releaseCommand}
          </pre>
          <CopyButton text={releaseCommand} />
        </div>
        <p className="text-[11px] text-neutral-400">
          PRs are linked automatically when their description contains <code className="font-mono">FeedbackKit: &lt;report id&gt;</code>{" "}
          (issue bodies and MCP prompts ask agents to include it) or closes a linked issue. Requires the GitHub App&apos;s
          webhook with <code className="font-mono">GITHUB_WEBHOOK_SECRET</code> set.
        </p>
      </div>
    </section>
  );
}
