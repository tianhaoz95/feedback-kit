import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
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
import { AgentGlyph } from "@/components/AgentDispatchButton";
import type { AgentIcon } from "@/lib/agents";

type SetupAgent = "claude" | "antigravity" | "copilot";

const SETUP_AGENTS: { id: SetupAgent; name: string; icon: AgentIcon; docs: string }[] = [
  { id: "claude", name: "Claude Code", icon: "claude", docs: "/docs/agents#github-hosted-actions" },
  { id: "antigravity", name: "Antigravity", icon: "antigravity", docs: "/docs/agents#self-hosted-mac-runner" },
  { id: "copilot", name: "GitHub Copilot", icon: "copilot", docs: "/docs/agents#github-copilot" },
];

const claudeWorkflow = `name: Claude
on:
  issues:
    types: [labeled]
jobs:
  agent:
    if: github.event.label.name == 'claude'
    runs-on: ubuntu-latest
    permissions: { contents: write, issues: write, pull-requests: write, id-token: write }
    steps:
      - uses: actions/checkout@v4
      - uses: anthropics/claude-code-action@v1
        with:
          claude_code_oauth_token: \${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          label_trigger: claude
          allowed_bots: feedbackkit-app   # FeedbackKit's GitHub App adds the label`;

/** The agents a label turns on (every SETUP_AGENTS entry but Copilot, which is an assignment). */
const LABEL_AGENTS = SETUP_AGENTS.filter((a) => a.id !== "copilot").map((a) => a.id);

const runnerSkillCommand = "npx skills add feedback-kit-skills --skill setup-agent-runner --yes";

/**
 * How the loop hands work to a coding agent and gets it back to the reporter
 * (0014_closed_loop.sql): `projects.dispatch_labels` / `dispatch_comment`
 * are applied to every GitHub issue FeedbackKit creates (and re-applied when
 * a reporter reopens one), and `feedbackkit release` is what ships fixes to
 * reporters' devices.
 */
export function AgentDispatchCard({
  project,
  setupAgent,
  onProjectUpdated,
}: {
  project: Project;
  /** Set when a "Not set up" agent in the report's agent picker sent the user here ("" = any agent). */
  setupAgent?: string | null;
  onProjectUpdated: (updated: Partial<Project>) => void;
}) {
  // Known agents' labels are checkboxes; `labels` holds only the project's other (custom) labels.
  const [agentLabels, setAgentLabels] = useState(() =>
    (project.dispatch_labels ?? []).filter((l) => LABEL_AGENTS.includes(l as SetupAgent)),
  );
  const [labels, setLabels] = useState(() =>
    (project.dispatch_labels ?? []).filter((l) => !LABEL_AGENTS.includes(l as SetupAgent)).join(", "),
  );
  const [comment, setComment] = useState(project.dispatch_comment ?? "");
  const [copilot, setCopilot] = useState(project.dispatch_copilot ?? false);
  const [connection, setConnection] = useState<GitHubUserConnection | null | undefined>(undefined);
  const [connecting, setConnecting] = useState(false);
  const location = useLocation();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [guide, setGuide] = useState<SetupAgent>(() =>
    SETUP_AGENTS.some((a) => a.id === setupAgent) ? (setupAgent as SetupAgent) : "claude",
  );
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (setupAgent === null || setupAgent === undefined) return;
    if (SETUP_AGENTS.some((a) => a.id === setupAgent)) setGuide(setupAgent as SetupAgent);
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [setupAgent]);

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

  const customLabels = labels
    .split(",")
    .map((l) => l.trim())
    .filter(Boolean);
  const parsedLabels = [...new Set([...agentLabels, ...customLabels])];

  async function save(nextLabels = parsedLabels, nextCopilot = copilot) {
    const nextComment = comment.trim() || null;
    setSaving(true);
    setError(null);
    setSaved(false);
    const { error: updateError } = await supabase
      .from("projects")
      .update({ dispatch_labels: nextLabels, dispatch_comment: nextComment, dispatch_copilot: nextCopilot })
      .eq("id", project.id);
    setSaving(false);
    if (updateError) {
      setError(getErrorMessage(updateError, "Failed to save."));
      return;
    }
    setAgentLabels(nextLabels.filter((l) => LABEL_AGENTS.includes(l as SetupAgent)));
    setLabels(nextLabels.filter((l) => !LABEL_AGENTS.includes(l as SetupAgent)).join(", "));
    setCopilot(nextCopilot);
    onProjectUpdated({ dispatch_labels: nextLabels, dispatch_comment: nextComment, dispatch_copilot: nextCopilot });
    setSaved(true);
  }

  /** The guide's last step: turn the agent's trigger on and save right away. */
  function enable(agent: SetupAgent) {
    if (agent === "copilot") void save(parsedLabels, true);
    else void save(parsedLabels.includes(agent) ? parsedLabels : [...parsedLabels, agent], copilot);
  }

  const savedLabels = project.dispatch_labels ?? [];
  const enabled = (agent: SetupAgent) => (agent === "copilot" ? !!project.dispatch_copilot : savedLabels.includes(agent));
  const guideAgent = SETUP_AGENTS.find((a) => a.id === guide)!;

  return (
    <section ref={sectionRef} className="scroll-mt-24 space-y-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
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

      <div className="rounded-lg border border-neutral-200 bg-neutral-50/60 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-semibold text-neutral-900">Set up an agent</h3>
          <div className="inline-flex rounded-lg border border-neutral-200 bg-white p-0.5">
            {SETUP_AGENTS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setGuide(a.id)}
                className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                  guide === a.id ? "bg-neutral-900 text-white" : "text-neutral-600 hover:text-neutral-900"
                }`}
              >
                <AgentGlyph icon={a.icon} className={`h-3.5 w-3.5 ${guide === a.id ? "brightness-0 invert" : ""}`} />
                {a.name}
                {enabled(a.id) ? <CheckIcon className="h-3 w-3" /> : null}
              </button>
            ))}
          </div>
        </div>

        {!project.github_repo ? (
          <p className="mt-2 text-xs text-amber-700">
            First connect a repository in the GitHub card above: every agent here works from the GitHub issue FeedbackKit
            creates for a report.
          </p>
        ) : null}

        <ol className="mt-3 list-decimal space-y-3 pl-5 text-xs text-neutral-700">
          {guide === "claude" ? (
            <>
              <Step title={<>Add this workflow to your repo as <code className="font-mono">.github/workflows/claude.yml</code></>}>
                It runs Claude Code on GitHub&apos;s runners whenever FeedbackKit labels an issue <code className="font-mono">claude</code>.
                <CodeSnippet code={claudeWorkflow} />
              </Step>
              <Step title={<>Add a <code className="font-mono">CLAUDE_CODE_OAUTH_TOKEN</code> repository secret</>}>
                Run <code className="font-mono">claude setup-token</code> and paste the token into the repo&apos;s Settings → Secrets
                and variables → Actions. To build and run iOS or macOS apps, use a self-hosted Mac instead:{" "}
                <code className="font-mono">{runnerSkillCommand}</code>, then ask your coding agent to set up the Claude Code runner.
              </Step>
            </>
          ) : guide === "antigravity" ? (
            <>
              <Step title="Install the setup-agent-runner skill in your repo">
                <CodeSnippet code={runnerSkillCommand} />
              </Step>
              <Step title="Ask your coding agent to set up the Antigravity runner">
                It adds a workflow that runs on the <code className="font-mono">antigravity</code> label, either on a self-hosted
                Mac (signs in with your Antigravity account) or on GitHub&apos;s runners with a{" "}
                <code className="font-mono">GEMINI_API_KEY</code> secret.
              </Step>
            </>
          ) : (
            <>
              <Step title="Enable Copilot's coding agent for the repository">
                Needs a Copilot plan that includes the coding agent. Copilot runs on Linux, so it can&apos;t build iOS or macOS
                apps.
              </Step>
              <Step title="Connect your GitHub account">
                GitHub only lets a person with a Copilot seat assign Copilot, so it runs as whoever sends the report. Each
                teammate does this once, with the button under <b>Assign to GitHub Copilot</b> below.
              </Step>
            </>
          )}
          <Step title={guide === "copilot" ? "Turn on Copilot for this project" : <>Add the <code className="font-mono">{guide}</code> label to this project</>}>
            {enabled(guide) ? (
              <span className="inline-flex items-center gap-1 text-emerald-700">
                <CheckIcon className="h-3.5 w-3.5" /> Done. {guideAgent.name} now shows up in each report&apos;s send menu.
              </span>
            ) : (
              <Button type="button" size="sm" variant="secondary" disabled={saving} onClick={() => enable(guide)}>
                {guide === "copilot" ? "Turn on Copilot" : `Add the ${guide} label`}
              </Button>
            )}
          </Step>
        </ol>
        <p className="mt-3 text-[11px] text-neutral-500">
          More detail:{" "}
          <Link to={guideAgent.docs} className="font-medium text-neutral-700 underline hover:text-neutral-900">
            {guideAgent.name} in Hand reports to an agent
          </Link>
          .
        </p>
      </div>

      <div className="space-y-3">
        <div className="text-xs">
          <div className="font-medium text-neutral-700">Agents that get new issues</div>
          <p className="mt-0.5 text-neutral-500">
            Only the agents checked here show up in a report&apos;s send menu. Each one needs its workflow in your repo
            first — pick it above for the steps.
          </p>
          <div className="mt-2 divide-y divide-neutral-100 rounded-lg border border-neutral-200">
            {SETUP_AGENTS.filter((a) => a.id !== "copilot").map((a) => (
              <label key={a.id} className="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-3 py-2 text-neutral-700">
                <input
                  type="checkbox"
                  checked={agentLabels.includes(a.id)}
                  onChange={(e) => {
                    setAgentLabels((prev) => (e.target.checked ? [...prev, a.id] : prev.filter((l) => l !== a.id)));
                    setSaved(false);
                  }}
                />
                <AgentGlyph icon={a.icon} className="h-4 w-4" />
                <span className="font-medium text-neutral-900">{a.name}</span>
                <span className="text-neutral-500">
                  adds the <code className="font-mono">{a.id}</code> label
                </span>
                <button
                  type="button"
                  onClick={() => setGuide(a.id)}
                  className="ml-auto text-[11px] font-medium text-neutral-500 hover:text-neutral-900"
                >
                  Setup steps
                </button>
              </label>
            ))}
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-3 py-2 text-neutral-700">
              <CheckIcon className="h-3.5 w-3.5 text-neutral-400" />
              <AgentGlyph icon="local" className="h-4 w-4" />
              <span className="font-medium text-neutral-900">Your machine</span>
              <span className="text-neutral-500">
                always available — Claude Code or Codex, run by <code className="font-mono">npx feedbackkit-cli watch</code>{" "}
                in your repo
              </span>
            </div>
          </div>
          <span className="mt-1 block text-neutral-500">GitHub Copilot is an assignment rather than a label; it&apos;s below.</span>
        </div>
        <label className="block text-xs font-medium text-neutral-700">
          Other labels
          <input
            value={labels}
            onChange={(e) => {
              setLabels(e.target.value);
              setSaved(false);
            }}
            placeholder="my-agent"
            className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 font-mono text-xs focus:border-neutral-400 focus:outline-none"
          />
          <span className="mt-1 block font-normal text-neutral-500">
            Optional, comma-separated: labels for any other agent workflow you run. Each one shows up in the send menu
            under its label. Workflows must accept labels added by a bot (e.g.{" "}
            <code className="font-mono">allowed_bots: feedbackkit-app</code> for claude-code-action), since
            FeedbackKit&apos;s app adds them.
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

function Step({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <li className="space-y-1">
      <div className="font-medium text-neutral-900">{title}</div>
      <div className="text-neutral-500">{children}</div>
    </li>
  );
}

function CodeSnippet({ code }: { code: string }) {
  return (
    <div className="mt-1.5 flex items-start gap-2 rounded-lg bg-neutral-900 px-3 py-2.5">
      <pre className="flex-1 overflow-x-auto font-mono text-[11px] leading-relaxed text-neutral-100">{code}</pre>
      <CopyButton text={code} />
    </div>
  );
}
