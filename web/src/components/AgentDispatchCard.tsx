import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import {
  disconnectGitHubUser,
  fetchGitHubUserConnection,
  startGitHubUserConnect,
  type GitHubUserConnection,
} from "@/lib/githubUser";
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
  const [copilot, setCopilot] = useState(project.dispatch_copilot ?? false);
  const [connection, setConnection] = useState<GitHubUserConnection | null | undefined>(undefined);
  const [connecting, setConnecting] = useState(false);
  const location = useLocation();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    fetchGitHubUserConnection()
      .then(setConnection)
      .catch(() => setConnection(null));
  }, []);

  async function connectGitHub() {
    setConnecting(true);
    setError(null);
    try {
      await startGitHubUserConnect(`${location.pathname}${location.search}`);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't start the GitHub connection."));
      setConnecting(false);
    }
  }

  async function disconnectGitHub() {
    setError(null);
    try {
      await disconnectGitHubUser();
      setConnection(null);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't disconnect."));
    }
  }

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
      .update({ dispatch_labels: nextLabels, dispatch_comment: nextComment, dispatch_copilot: copilot })
      .eq("id", project.id);
    setSaving(false);
    if (updateError) {
      setError(getErrorMessage(updateError, "Failed to save."));
      return;
    }
    onProjectUpdated({ dispatch_labels: nextLabels, dispatch_comment: nextComment, dispatch_copilot: copilot });
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
            claude-code-action&apos;s <code className="font-mono">label_trigger</code> (with{" "}
            <code className="font-mono">allowed_bots: feedbackkit-app</code>, since FeedbackKit&apos;s app adds it), or
            whatever your agent workflow listens for. The <code className="font-mono">setup-agent-runner</code> skill sets
            this up on a self-hosted Mac, where the agent can build and run your app.
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
          </span>
        </label>
        <div className="rounded-lg border border-neutral-200 p-3">
          <label className="flex items-start gap-2 text-xs font-medium text-neutral-700">
            <input
              type="checkbox"
              checked={copilot}
              onChange={(e) => {
                setCopilot(e.target.checked);
                setSaved(false);
              }}
              className="mt-0.5"
            />
            <span>
              Assign to GitHub Copilot
              <span className="mt-0.5 block font-normal text-neutral-500">
                Copilot&apos;s coding agent picks up the issue and opens a PR. GitHub only accepts this as a person with a
                Copilot seat, so it runs as whoever presses <em>Send to agent</em> — each member connects their own GitHub
                account once. Copilot runs on Linux, so it can&apos;t build iOS or macOS apps.
              </span>
            </span>
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-2 pl-5 text-xs text-neutral-600">
            {connection === undefined ? (
              <span className="text-neutral-400">Checking your GitHub connection…</span>
            ) : connection && !connection.expired ? (
              <>
                <span className="inline-flex items-center gap-1 text-emerald-700">
                  <CheckIcon className="h-3.5 w-3.5" /> Connected as {connection.github_login ?? "your GitHub account"}
                </span>
                <button type="button" onClick={() => void disconnectGitHub()} className="text-neutral-400 hover:text-neutral-700">
                  Disconnect
                </button>
              </>
            ) : (
              <Button type="button" size="sm" variant="secondary" disabled={connecting} onClick={() => void connectGitHub()}>
                {connecting ? "Opening GitHub…" : connection?.expired ? "Reconnect GitHub" : "Connect your GitHub account"}
              </Button>
            )}
          </div>
        </div>
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
