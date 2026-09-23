import { useEffect, useState, useTransition } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { getCurrentOrganizationId } from "@/lib/organization";
import { getErrorMessage } from "@/lib/errors";
import type { Project } from "@/lib/types";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { ArrowRightIcon, FolderIcon, GitHubIcon, PlusIcon } from "@/components/icons";

const CARD_TINTS = [
  "bg-violet-100 text-violet-600",
  "bg-blue-100 text-blue-600",
  "bg-emerald-100 text-emerald-600",
  "bg-amber-100 text-amber-600",
  "bg-rose-100 text-rose-600",
  "bg-cyan-100 text-cyan-600",
];

function tintFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return CARD_TINTS[hash % CARD_TINTS.length];
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
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [orgLoadError, setOrgLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const orgId = await getCurrentOrganizationId();
        if (cancelled) return;

        if (!orgId) {
          setOrgLoadError("No organization is associated with your account.");
          setProjects([]);
          return;
        }
        setOrganizationId(orgId);

        const { data, error } = await supabase
          .from("projects")
          .select("*")
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false })
          .returns<Project[]>();

        if (cancelled) return;
        if (error) throw error;
        setProjects(data ?? []);
      } catch (err) {
        if (!cancelled) {
          setOrgLoadError(getErrorMessage(err, "Couldn't load your organization."));
          setProjects([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

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
          Each project gets its own key to embed in an iOS app so feedback routes here.
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
                  className="flex min-w-0 animate-pulse items-center justify-between rounded-xl border border-neutral-200 bg-white p-4 sm:p-5"
                >
                  <div className="flex flex-1 items-center gap-3.5 sm:gap-4">
                    <div className="h-11 w-11 shrink-0 rounded-xl bg-neutral-100" />
                    <div className="flex-1 max-w-sm space-y-2">
                      <div className="h-4 w-1/2 rounded bg-neutral-100" />
                      <div className="h-3 w-2/3 rounded bg-neutral-100" />
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
              description="Create your first project to get a key you can drop into an iOS app — feedback from it will show up here."
            />
          ) : (
            <div className="space-y-3">
              {projects.map((project) => (
                <Link
                  key={project.id}
                  to={`/projects/${project.id}`}
                  className="group flex flex-col justify-between gap-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-xs transition-all duration-150 hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md sm:flex-row sm:items-center sm:p-5"
                >
                  <div className="flex min-w-0 items-center gap-3.5 sm:gap-4">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-base font-semibold shadow-2xs ${tintFor(project.id)}`}
                    >
                      {project.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate font-semibold text-neutral-900 transition-colors group-hover:text-blue-600 sm:text-base">
                          {project.name}
                        </h2>
                        {project.github_repo ? (
                          <span className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-medium text-neutral-600">
                            <GitHubIcon className="h-3 w-3 text-neutral-700" />
                            <span className="max-w-[200px] truncate">{project.github_repo}</span>
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                        <code className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[11px] text-neutral-500">
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
                    <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 transition-colors group-hover:text-neutral-900">
                      <span>View project</span>
                      <ArrowRightIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </Link>
              ))}
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
