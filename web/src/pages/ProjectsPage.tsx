import { useEffect, useState, useTransition } from "react";
import { track } from "@/lib/analytics";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useOrganization } from "@/lib/organization";
import { getErrorMessage } from "@/lib/errors";
import type { Project } from "@/lib/types";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { ArrowRightIcon, ExternalLinkIcon, FolderIcon, GitHubIcon, PinIcon, PlusIcon } from "@/components/icons";

const CARD_TINTS = [
  "bg-violet-100 text-violet-600",
  "bg-blue-100 text-blue-600",
  "bg-emerald-100 text-emerald-600",
  "bg-amber-100 text-amber-600",
  "bg-rose-100 text-rose-600",
  "bg-cyan-100 text-cyan-600",
];

const PINNED_STORAGE_KEY = "feedbackkit:pinned_projects";

function getInitialPinned(): Set<string> {
  try {
    const raw = localStorage.getItem(PINNED_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return new Set(parsed);
      }
    }
  } catch {
    // Ignore storage errors
  }
  return new Set();
}

function tintFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return CARD_TINTS[hash % CARD_TINTS.length];
}

function ProjectAvatar({ project }: { project: Project }) {
  const [imgFailed, setImgFailed] = useState(false);
  const socialPreviewUrl = project.github_repo
    ? `https://opengraph.githubassets.com/1/${project.github_repo}`
    : null;

  if (socialPreviewUrl && !imgFailed) {
    return (
      <img
        src={socialPreviewUrl}
        alt={project.name}
        onError={() => setImgFailed(true)}
        className="h-14 w-14 sm:h-16 sm:w-16 shrink-0 rounded-xl object-cover border border-neutral-200 shadow-2xs"
      />
    );
  }

  return (
    <div
      className={`flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-xl text-xl sm:text-2xl font-bold shadow-2xs ${tintFor(project.id)}`}
    >
      {project.name.slice(0, 1).toUpperCase()}
    </div>
  );
}

function formatCreatedDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export function ProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(getInitialPinned);
  const { current, error: orgError } = useOrganization();
  const organizationId = current?.id ?? null;
  const [loadError, setLoadError] = useState<string | null>(null);
  const orgLoadError = orgError ?? loadError;
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function togglePin(projectId: string) {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      try {
        localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(Array.from(next)));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }

  const sortedProjects = projects
    ? [...projects].sort((a, b) => {
        const aPinned = pinnedIds.has(a.id);
        const bPinned = pinnedIds.has(b.id);
        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      })
    : null;

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    setProjects(null);

    (async () => {
      try {
        const { data, error } = await supabase
          .from("projects")
          .select("*")
          .eq("organization_id", organizationId)
          .order("created_at", { ascending: false })
          .returns<Project[]>();

        if (cancelled) return;
        if (error) throw error;
        setLoadError(null);
        setProjects(data ?? []);
      } catch (err) {
        if (!cancelled) {
          setLoadError(getErrorMessage(err, "Couldn't load your organization."));
          setProjects([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  function createProject(formData: FormData) {
    const name = String(formData.get("name") || "").trim();
    if (!name) return;

    if (!organizationId) {
      setError("Still figuring out your organization — wait a moment and try again.");
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const { data, error } = await supabase
          .from("projects")
          .insert({ organization_id: organizationId, name })
          .select("id")
          .single();

        if (error) throw error;
        track("project_created", {}, organizationId);
        navigate(`/projects/${data.id}`);
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't create the project. Try again."));
      }
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Projects</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Each project gets its own key to put in your app or website so feedback routes here.
        </p>
      </div>

      {orgLoadError ? (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Couldn't load your organization: {orgLoadError}
        </div>
      ) : (
        <>
          {projects === null ? (
            <div className="space-y-3">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="flex min-w-0 animate-pulse items-center justify-between rounded-xl border border-neutral-200 bg-white p-5 sm:p-6"
                >
                  <div className="flex flex-1 items-center gap-4 sm:gap-5">
                    <div className="h-14 w-14 sm:h-16 sm:w-16 shrink-0 rounded-xl bg-neutral-100" />
                    <div className="flex-1 max-w-sm space-y-2.5">
                      <div className="h-5 w-1/2 rounded bg-neutral-100" />
                      <div className="h-3.5 w-2/3 rounded bg-neutral-100" />
                    </div>
                  </div>
                  <div className="hidden h-4 w-20 rounded bg-neutral-100 sm:block" />
                </div>
              ))}
            </div>
          ) : projects.length === 0 ? (
            <EmptyState
              icon={<FolderIcon className="h-6 w-6" />}
              title="No projects yet"
              description="Create your first project to get a key you can put in your app or website — feedback from it will show up here."
            />
          ) : (
            <div className="space-y-3">
              {sortedProjects?.map((project) => {
                const isPinned = pinnedIds.has(project.id);
                return (
                  <div
                    key={project.id}
                    className={`group relative flex flex-col justify-between gap-4 rounded-xl border bg-white p-5 shadow-xs transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md sm:flex-row sm:items-center sm:p-6 ${
                      isPinned
                        ? "border-amber-200/80 bg-gradient-to-r from-amber-50/20 via-white to-white hover:border-amber-300"
                        : "border-neutral-200 hover:border-neutral-300"
                    }`}
                  >
                    <Link
                      to={`/projects/${project.id}`}
                      className="absolute inset-0 z-0 rounded-xl"
                      aria-label={`View project ${project.name}`}
                    />
                    <div className="flex min-w-0 items-center gap-4 sm:gap-5 pointer-events-none">
                      <ProjectAvatar project={project} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="truncate text-base sm:text-lg font-semibold text-neutral-900 transition-colors group-hover:text-blue-600">
                            {project.name}
                          </h2>
                          {isPinned && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200/60 shadow-2xs">
                              <PinIcon className="h-2.5 w-2.5" />
                              <span>Pinned</span>
                            </span>
                          )}
                          {project.github_repo ? (
                            <a
                              href={`https://github.com/${project.github_repo}`}
                              target="_blank"
                              rel="noreferrer"
                              className="pointer-events-auto relative z-10 inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-medium text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-100 hover:text-neutral-900"
                              title={`Open ${project.github_repo} on GitHub in a new tab`}
                            >
                              <GitHubIcon className="h-3.5 w-3.5 text-neutral-700" />
                              <span className="max-w-[220px] truncate">{project.github_repo}</span>
                              <ExternalLinkIcon className="h-2.5 w-2.5 text-neutral-400" />
                            </a>
                          ) : null}
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs sm:text-sm text-neutral-500">
                          <code className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-xs text-neutral-600">
                            {project.project_key}
                          </code>
                          <span className="hidden text-neutral-300 sm:inline">·</span>
                          <span className="hidden text-neutral-400 sm:inline">
                            Created {formatCreatedDate(project.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center justify-between gap-3 border-t border-neutral-100 pt-2 sm:border-0 sm:pt-0 sm:justify-end">
                      <span className="text-xs text-neutral-400 sm:hidden">
                        Created {formatCreatedDate(project.created_at)}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            togglePin(project.id);
                          }}
                          title={isPinned ? "Unpin project" : "Pin project to top"}
                          aria-label={isPinned ? `Unpin project ${project.name}` : `Pin project ${project.name} to top`}
                          className={`pointer-events-auto relative z-10 flex h-7 w-7 items-center justify-center rounded-lg border transition-all cursor-pointer ${
                            isPinned
                              ? "border-amber-300 bg-amber-50 text-amber-600 shadow-2xs hover:bg-amber-100"
                              : "border-neutral-200 bg-white text-neutral-400 hover:border-neutral-300 hover:text-neutral-700 hover:bg-neutral-50"
                          }`}
                        >
                          <PinIcon className="h-3.5 w-3.5" />
                        </button>
                        <div className="pointer-events-none flex items-center gap-1.5 text-xs font-medium text-neutral-500 transition-colors group-hover:text-neutral-900">
                          <span>View project</span>
                          <ArrowRightIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="max-w-md rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
            <h2 className="text-sm font-semibold text-neutral-900">Create a new project</h2>
            <p className="mt-0.5 text-xs text-neutral-500">
              Give your project a name to generate an API key.
            </p>
            {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
            <form
              onSubmit={(event) => {
                event.preventDefault();
                createProject(new FormData(event.currentTarget));
              }}
              className="mt-3.5 flex gap-2"
            >
              <input
                name="name"
                required
                placeholder="e.g. Consumer App"
                className="flex-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 transition-colors placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none"
              />
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  "Creating…"
                ) : (
                  <>
                    <PlusIcon className="h-4 w-4" />
                    Create
                  </>
                )}
              </Button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
