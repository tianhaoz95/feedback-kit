import { useEffect, useState, useTransition } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { Project } from "@/lib/types";
import { Button } from "@/components/Button";
import { extractRepo } from "@/lib/github-url";
import {
  AlertIcon,
  CheckIcon,
  ExternalLinkIcon,
  GitHubIcon,
} from "@/components/icons";

const GITHUB_APP_INSTALL_URL = "https://github.com/apps/feedbackkit-app/installations/new";

type InputMode = "repo_id" | "url";

export function GitHubSetupCard({
  project,
  onProjectUpdated,
}: {
  project: Project;
  onProjectUpdated: (updated: Partial<Project>) => void;
}) {
  const { user } = useAuth();
  const githubUsername = (user?.user_metadata?.user_name ||
    user?.user_metadata?.preferred_username) as string | undefined;

  const [inputMode, setInputMode] = useState<InputMode>("repo_id");
  const [repoInput, setRepoInput] = useState(() => {
    if (project.github_repo) {
      return project.github_repo;
    }
    return githubUsername ? `${githubUsername}/` : "";
  });

  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isConnected = Boolean(project.github_repo);

  // When githubUsername loads asynchronously and input is still empty, prefill it
  useEffect(() => {
    if (!project.github_repo && githubUsername && (!repoInput || repoInput === "/")) {
      if (inputMode === "repo_id") {
        setRepoInput(`${githubUsername}/`);
      } else {
        setRepoInput(`https://github.com/${githubUsername}/`);
      }
    }
  }, [githubUsername, project.github_repo, inputMode, repoInput]);

  function handleSwitchMode(newMode: InputMode) {
    if (newMode === inputMode) return;
    setInputMode(newMode);
    setError(null);

    const current = repoInput.trim();
    const extracted = extractRepo(current);

    if (newMode === "url") {
      if (extracted) {
        setRepoInput(`https://github.com/${extracted.owner}/${extracted.repo}`);
      } else if (current && current.endsWith("/") && !current.startsWith("http")) {
        setRepoInput(`https://github.com/${current}`);
      } else if (!current || current === (githubUsername ? `${githubUsername}/` : "")) {
        setRepoInput(`https://github.com/${githubUsername ? `${githubUsername}/` : ""}`);
      }
    } else {
      if (extracted) {
        setRepoInput(`${extracted.owner}/${extracted.repo}`);
      } else if (current.startsWith("https://github.com/")) {
        const path = current.replace(/^https:\/\/github\.com\//, "");
        setRepoInput(path);
      } else if (!current) {
        setRepoInput(githubUsername ? `${githubUsername}/` : "");
      }
    }
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const extracted = extractRepo(repoInput);
    if (!extracted) {
      if (inputMode === "url") {
        setError("Please enter a valid GitHub repository URL (e.g. https://github.com/owner/repo).");
      } else {
        setError("Please enter a valid repository in owner/repo format (e.g. octocat/Hello-World).");
      }
      return;
    }

    const canonicalRepo = `${extracted.owner}/${extracted.repo}`;

    startTransition(async () => {
      const { error: dbError } = await supabase
        .from("projects")
        .update({
          github_repo: canonicalRepo,
        })
        .eq("id", project.id);

      if (dbError) {
        setError(dbError.message);
        return;
      }

      onProjectUpdated({ github_repo: canonicalRepo });
      setIsEditing(false);
      setSuccess(`Connected to ${canonicalRepo}`);
    });
  }

  function handleDisconnect() {
    if (!window.confirm(`Disconnect ${project.github_repo} from this project?`)) {
      return;
    }

    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const { error: dbError } = await supabase
        .from("projects")
        .update({
          github_repo: null,
          github_installation_id: null,
        })
        .eq("id", project.id);

      if (dbError) {
        setError(dbError.message);
        return;
      }

      onProjectUpdated({ github_repo: null, github_installation_id: null });
      setRepoInput(githubUsername ? `${githubUsername}/` : "");
      setIsEditing(false);
      setSuccess("GitHub repository disconnected.");
    });
  }

  return (
    <section className="space-y-5 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <GitHubIcon className="h-5 w-5 text-neutral-900" />
            <h2 className="text-base font-semibold text-neutral-900">GitHub Integration</h2>
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            Convert user feedback into tracked GitHub issues with a single click. Screenshots and coding agent
            prompts are automatically formatted.
          </p>
        </div>

        <a
          href={GITHUB_APP_INSTALL_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 transition-colors"
        >
          <GitHubIcon className="h-3.5 w-3.5" />
          <span>Install FeedbackKit GitHub App</span>
          <ExternalLinkIcon className="h-3.5 w-3.5 text-neutral-400" />
        </a>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
          <AlertIcon className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {success ? (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-700">
          <CheckIcon className="h-4 w-4 shrink-0" />
          <span>{success}</span>
        </div>
      ) : null}

      {isConnected && !isEditing ? (
        <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/50 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-900 text-white">
                <GitHubIcon className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <a
                    href={`https://github.com/${project.github_repo}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-neutral-900 hover:underline inline-flex items-center gap-1 text-sm"
                  >
                    <span>{project.github_repo}</span>
                    <ExternalLinkIcon className="h-3.5 w-3.5 text-neutral-400" />
                  </a>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-200">
                    Connected
                  </span>
                </div>
                <p className="text-xs text-neutral-500">
                  Feedback items can be converted to issues on this repository.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (inputMode === "repo_id") {
                    setRepoInput(project.github_repo ?? (githubUsername ? `${githubUsername}/` : ""));
                  } else {
                    setRepoInput(
                      project.github_repo
                        ? `https://github.com/${project.github_repo}`
                        : githubUsername
                        ? `https://github.com/${githubUsername}/`
                        : ""
                    );
                  }
                  setIsEditing(true);
                }}
              >
                Change
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={isPending}
                onClick={handleDisconnect}
              >
                Disconnect
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/50 p-4 space-y-3">
            {/* Toggle header */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="github-repo" className="block text-xs font-semibold text-neutral-700">
                {inputMode === "repo_id" ? "Repository ID (owner/repo)" : "Repository URL"}
              </label>

              {/* Segmented Mode Toggle */}
              <div className="inline-flex rounded-lg bg-neutral-200/80 p-0.5 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => handleSwitchMode("repo_id")}
                  className={`cursor-pointer rounded-md px-2.5 py-1 transition-all ${
                    inputMode === "repo_id"
                      ? "bg-white font-semibold text-neutral-900 shadow-xs"
                      : "text-neutral-600 hover:text-neutral-900"
                  }`}
                >
                  Repository ID
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchMode("url")}
                  className={`cursor-pointer rounded-md px-2.5 py-1 transition-all ${
                    inputMode === "url"
                      ? "bg-white font-semibold text-neutral-900 shadow-xs"
                      : "text-neutral-600 hover:text-neutral-900"
                  }`}
                >
                  Repository URL
                </button>
              </div>
            </div>

            {/* Input field and connect button */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <GitHubIcon className="h-4 w-4 text-neutral-400" />
                </div>
                <input
                  id="github-repo"
                  type="text"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  placeholder={
                    inputMode === "repo_id"
                      ? githubUsername
                        ? `${githubUsername}/your-app`
                        : "owner/repo"
                      : `https://github.com/${githubUsername || "owner"}/your-app`
                  }
                  value={repoInput}
                  onChange={(e) => setRepoInput(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 bg-white py-1.5 pl-9 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                />
              </div>

              <div className="flex items-center gap-2">
                <Button type="submit" disabled={isPending} size="sm">
                  {isPending ? "Connecting…" : "Connect repository"}
                </Button>
                {isEditing ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsEditing(false);
                      setRepoInput(project.github_repo ?? "");
                    }}
                  >
                    Cancel
                  </Button>
                ) : null}
              </div>
            </div>

            {/* Convenience Prefill Chip & Format Helper */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500 pt-0.5">
              <span>
                {inputMode === "repo_id" ? (
                  <>
                    Format:{" "}
                    <code className="rounded bg-neutral-200/60 px-1 py-0.5 font-mono text-[11px] text-neutral-800">
                      owner/repository
                    </code>
                  </>
                ) : (
                  <>
                    Format:{" "}
                    <code className="rounded bg-neutral-200/60 px-1 py-0.5 font-mono text-[11px] text-neutral-800">
                      https://github.com/owner/repository
                    </code>
                  </>
                )}
              </span>

              {githubUsername && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-neutral-400">Prefill account:</span>
                  <button
                    type="button"
                    title={`Prefill @${githubUsername}/`}
                    onClick={() => {
                      if (inputMode === "repo_id") {
                        setRepoInput(`${githubUsername}/`);
                      } else {
                        setRepoInput(`https://github.com/${githubUsername}/`);
                      }
                    }}
                    className="cursor-pointer inline-flex items-center gap-1 rounded bg-neutral-100 hover:bg-neutral-200 px-1.5 py-0.5 text-[11px] font-medium text-neutral-700 transition-colors"
                  >
                    <span>@{githubUsername}</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              How it works
            </h3>
            <ol className="mt-2.5 list-inside list-decimal space-y-1.5 text-xs text-neutral-600 leading-relaxed">
              <li>
                <a
                  href={GITHUB_APP_INSTALL_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-neutral-900 underline hover:text-blue-600"
                >
                  Install the FeedbackKit GitHub App
                </a>{" "}
                on your repository or organization.
              </li>
              <li>
                Enter your repository using either the <b>Repository ID</b> (
                <code className="rounded bg-neutral-100 px-1 py-0.5 font-mono text-[11px]">owner/repo</code>
                ) or full <b>GitHub URL</b>, then click <b>Connect repository</b>.
              </li>
              <li>
                Navigate to any report in the <b>Feedback</b> tab and click <b>Create GitHub Issue</b>.
              </li>
              <li>
                When an issue is closed on GitHub, the feedback item in FeedbackKit automatically updates to resolved.
              </li>
            </ol>
          </div>
        </form>
      )}

      {/* Feature highlight cards */}
      <div className="grid gap-3 sm:grid-cols-3 pt-2">
        <div className="rounded-lg border border-neutral-200/70 bg-white p-3.5">
          <div className="font-medium text-xs text-neutral-900">1-Click Issue Creation</div>
          <p className="mt-1 text-[11px] text-neutral-500 leading-normal">
            Creates structured GitHub issues with full device metadata, environment specs, and user descriptions.
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200/70 bg-white p-3.5">
          <div className="font-medium text-xs text-neutral-900">Embedded Agent Prompts</div>
          <p className="mt-1 text-[11px] text-neutral-500 leading-normal">
            Every issue includes a collapsible prompt ready for coding agents like Claude Code, Cursor, or Codex.
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200/70 bg-white p-3.5">
          <div className="font-medium text-xs text-neutral-900">Two-Way Status Sync</div>
          <p className="mt-1 text-[11px] text-neutral-500 leading-normal">
            Closing an issue in GitHub marks the feedback report as resolved in FeedbackKit in real time.
          </p>
        </div>
      </div>
    </section>
  );
}
