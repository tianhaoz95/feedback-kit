import { useEffect, useState, useTransition } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { getCurrentOrganizationId } from "@/lib/organization";
import { getErrorMessage } from "@/lib/errors";
import type { Project } from "@/lib/types";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { ArrowRightIcon, FolderIcon, PlusIcon } from "@/components/icons";

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
        <h1 className="text-xl font-semibold">Projects</h1>
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
            <div className="grid gap-3 sm:grid-cols-2">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="h-[76px] min-w-0 animate-pulse rounded-xl border border-neutral-200 bg-white p-4"
                >
                  <div className="h-4 w-2/3 rounded bg-neutral-100" />
                  <div className="mt-2 h-3 w-1/2 rounded bg-neutral-100" />
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
            <div className="grid gap-3 sm:grid-cols-2">
              {projects.map((project) => (
                <Link
                  key={project.id}
                  to={`/projects/${project.id}`}
                  className="group flex min-w-0 items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md"
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold ${tintFor(project.id)}`}
                  >
                    {project.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-medium text-neutral-900">{project.name}</h2>
                    <p className="mt-0.5 truncate font-mono text-xs text-neutral-400">{project.project_key}</p>
                  </div>
                  <ArrowRightIcon className="h-4 w-4 shrink-0 text-neutral-300 transition-all group-hover:translate-x-0.5 group-hover:text-neutral-500" />
                </Link>
              ))}
            </div>
          )}

          <div className="max-w-sm rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-medium text-neutral-900">New project</h2>
            {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
            <form
              onSubmit={(event) => {
                event.preventDefault();
                createProject(new FormData(event.currentTarget));
              }}
              className="mt-3 flex gap-2"
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
