import { useEffect, useRef, useState, useTransition } from "react";
import { supabase } from "@/lib/supabase";
import type { Project } from "@/lib/types";
import { Button } from "@/components/Button";
import {
  AlertIcon,
  BookIcon,
  CheckIcon,
  ExternalLinkIcon,
  GitHubIcon,
  LockIcon,
} from "@/components/icons";

const GITHUB_APP_INSTALL_URL = "https://github.com/apps/feedbackkit-app/installations/new";

interface AccessibleRepo {
  name: string;
  full_name: string;
  private: boolean;
  description: string | null;
  installation_id: number;
  owner: string;
}

export function GitHubSetupCard({
  project,
  onProjectUpdated,
}: {
  project: Project;
  onProjectUpdated: (updated: Partial<Project>) => void;
}) {
  const [repoInput, setRepoInput] = useState(project.github_repo ?? "");
  const [selectedInstallationId, setSelectedInstallationId] = useState<number | null>(
    project.github_installation_id ?? null
  );
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Autocomplete state
  const [availableRepos, setAvailableRepos] = useState<AccessibleRepo[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [hasLoadedRepos, setHasLoadedRepos] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isConnected = Boolean(project.github_repo);

  // Fetch installed repositories for autocomplete
  useEffect(() => {
    let cancelled = false;

    async function loadRepos() {
      if (hasLoadedRepos || isLoadingRepos) return;
      setIsLoadingRepos(true);
      try {
        const { data, error: fnError } = await supabase.functions.invoke("list-github-repos");
        if (!cancelled && !fnError && data?.repositories) {
          setAvailableRepos(data.repositories);
          setHasLoadedRepos(true);
        }
      } catch (err) {
        console.warn("Failed to fetch GitHub repos for autocomplete:", err);
      } finally {
        if (!cancelled) setIsLoadingRepos(false);
      }
    }

    loadRepos();

    return () => {
      cancelled = true;
    };
  }, [hasLoadedRepos, isLoadingRepos]);

  // Click outside to dismiss dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
        setHighlightedIndex(-1);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const trimmed = repoInput.trim();
  const filteredRepos = availableRepos.filter((r) => {
    if (!trimmed) return true;
    const q = trimmed.toLowerCase();
    return r.full_name.toLowerCase().includes(q) || r.name.toLowerCase().includes(q);
  });

  function selectRepo(repo: AccessibleRepo) {
    setRepoInput(repo.full_name);
    setSelectedInstallationId(repo.installation_id);
    setIsDropdownOpen(false);
    setHighlightedIndex(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isDropdownOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        setIsDropdownOpen(true);
        return;
      }
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < filteredRepos.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredRepos.length - 1));
    } else if (e.key === "Enter") {
      if (isDropdownOpen && highlightedIndex >= 0 && highlightedIndex < filteredRepos.length) {
        e.preventDefault();
        selectRepo(filteredRepos[highlightedIndex]);
      }
    } else if (e.key === "Escape") {
      setIsDropdownOpen(false);
      setHighlightedIndex(-1);
    }
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const target = repoInput.trim();
    if (!target) {
      setError("Please enter a repository in owner/repo format (e.g. octocat/Hello-World).");
      return;
    }

    const parts = target.split("/");
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      setError("Invalid format. Use owner/repo (e.g. octocat/Hello-World).");
      return;
    }

    const matchedRepo = availableRepos.find(
      (r) => r.full_name.toLowerCase() === target.toLowerCase()
    );
    const installationIdToSave = matchedRepo?.installation_id ?? selectedInstallationId ?? null;

    startTransition(async () => {
      const { error: dbError } = await supabase
        .from("projects")
        .update({
          github_repo: target,
          github_installation_id: installationIdToSave,
        })
        .eq("id", project.id);

      if (dbError) {
        setError(dbError.message);
        return;
      }

      onProjectUpdated({ github_repo: target, github_installation_id: installationIdToSave });
      setIsEditing(false);
      setIsDropdownOpen(false);
      setSuccess(`Connected to ${target}`);
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
      setRepoInput("");
      setSelectedInstallationId(null);
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
                  setRepoInput(project.github_repo ?? "");
                  setIsEditing(true);
                  setIsDropdownOpen(true);
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
            <div className="flex items-center justify-between">
              <label htmlFor="github-repo" className="block text-xs font-semibold text-neutral-700">
                Repository (owner/repo)
              </label>
              {availableRepos.length > 0 ? (
                <span className="text-[11px] text-neutral-500">
                  {availableRepos.length} installed {availableRepos.length === 1 ? "repository" : "repositories"} available
                </span>
              ) : null}
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <div ref={containerRef} className="relative flex-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <GitHubIcon className="h-4 w-4 text-neutral-400" />
                </div>
                <input
                  ref={inputRef}
                  id="github-repo"
                  type="text"
                  autoComplete="off"
                  placeholder="e.g. your-org/your-app"
                  value={repoInput}
                  onFocus={() => setIsDropdownOpen(true)}
                  onChange={(e) => {
                    setRepoInput(e.target.value);
                    setIsDropdownOpen(true);
                    setHighlightedIndex(-1);
                  }}
                  onKeyDown={handleKeyDown}
                  className="w-full rounded-lg border border-neutral-300 bg-white py-1.5 pl-9 pr-8 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                />

                {isLoadingRepos ? (
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-neutral-400 border-t-transparent" />
                  </div>
                ) : null}

                {/* Autocomplete Dropdown */}
                {isDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-xl border border-neutral-200 bg-white p-1.5 shadow-lg shadow-neutral-900/10 ring-1 ring-neutral-900/5">
                    {isLoadingRepos && availableRepos.length === 0 ? (
                      <div className="flex items-center gap-2 px-3 py-3 text-xs text-neutral-400">
                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-neutral-400 border-t-transparent" />
                        <span>Loading installed repositories…</span>
                      </div>
                    ) : filteredRepos.length > 0 ? (
                      <>
                        <div className="flex items-center justify-between px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                          <span>Installed Repositories ({filteredRepos.length})</span>
                          <span className="text-[10px] font-normal lowercase text-neutral-400">arrow keys to select</span>
                        </div>
                        <div className="space-y-0.5">
                          {filteredRepos.map((repo, idx) => {
                            const isHighlighted = highlightedIndex === idx;
                            const isCurrent = repo.full_name.toLowerCase() === trimmed.toLowerCase();
                            return (
                              <button
                                key={repo.full_name}
                                type="button"
                                onClick={() => selectRepo(repo)}
                                onMouseEnter={() => setHighlightedIndex(idx)}
                                className={`w-full text-left flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-xs transition-colors cursor-pointer ${
                                  isHighlighted
                                    ? "bg-neutral-100 text-neutral-900"
                                    : isCurrent
                                    ? "bg-neutral-50 font-medium text-neutral-900"
                                    : "text-neutral-700 hover:bg-neutral-50"
                                }`}
                              >
                                <div className="mt-0.5 shrink-0 text-neutral-400">
                                  {repo.private ? (
                                    <LockIcon className="h-3.5 w-3.5 text-neutral-500" />
                                  ) : (
                                    <BookIcon className="h-3.5 w-3.5 text-neutral-400" />
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-semibold text-neutral-900">{repo.full_name}</span>
                                    <span
                                      className={`rounded px-1.5 py-0.2 text-[10px] font-medium border ${
                                        repo.private
                                          ? "bg-amber-50 text-amber-700 border-amber-200"
                                          : "bg-neutral-50 text-neutral-600 border-neutral-200"
                                      }`}
                                    >
                                      {repo.private ? "Private" : "Public"}
                                    </span>
                                    <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.2 text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                      App Installed
                                    </span>
                                  </div>
                                  {repo.description ? (
                                    <p className="mt-0.5 truncate text-[11px] text-neutral-500">
                                      {repo.description}
                                    </p>
                                  ) : null}
                                </div>
                                {isCurrent ? (
                                  <CheckIcon className="h-4 w-4 shrink-0 text-neutral-900" />
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <div className="px-3 py-3 text-xs text-neutral-500">
                        <p className="font-medium text-neutral-700">
                          No installed repositories match &quot;{trimmed}&quot;
                        </p>
                        <p className="mt-1 text-[11px] text-neutral-400">
                          You can still type any public or accessible repository to connect it.
                        </p>
                      </div>
                    )}

                    {/* Footer link to install app on more repos */}
                    <div className="mt-1 border-t border-neutral-100 pt-1">
                      <a
                        href={GITHUB_APP_INSTALL_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 transition-colors"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <GitHubIcon className="h-3 w-3 text-neutral-500" />
                          <span>Don&apos;t see your repository? Install or grant access on GitHub</span>
                        </span>
                        <ExternalLinkIcon className="h-3 w-3 text-neutral-400" />
                      </a>
                    </div>
                  </div>
                )}
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
                      setIsDropdownOpen(false);
                      setRepoInput(project.github_repo ?? "");
                      setSelectedInstallationId(project.github_installation_id ?? null);
                    }}
                  >
                    Cancel
                  </Button>
                ) : null}
              </div>
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
                Select your repository from the autocomplete list above or type <code className="rounded bg-neutral-100 px-1 py-0.5 font-mono text-[11px]">owner/repo</code>, then click <b>Connect repository</b>.
              </li>
              <li>
                Navigate to any report in the <b>Feedback</b> tab and click <b>Convert to GitHub Issue</b>.
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
