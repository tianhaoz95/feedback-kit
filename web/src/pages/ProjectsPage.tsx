import { useEffect, useState, useTransition } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { getCurrentOrganizationId } from "@/lib/organization";
import type { Project } from "@/lib/types";

export function ProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const orgId = await getCurrentOrganizationId();
      if (cancelled) return;
      setOrganizationId(orgId);

      const { data } = await supabase
        .from("projects")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .returns<Project[]>();

      if (!cancelled) setProjects(data ?? []);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  function createProject(formData: FormData) {
    const name = String(formData.get("name") || "").trim();
    if (!name || !organizationId) return;

    setError(null);
    startTransition(async () => {
      const { data, error } = await supabase
        .from("projects")
        .insert({ organization_id: organizationId, name })
        .select("id")
        .single();

      if (error) {
        setError(error.message);
        return;
      }
      navigate(`/projects/${data.id}`);
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

      <div className="grid gap-3 sm:grid-cols-2">
        {(projects ?? []).map((project) => (
          <Link
            key={project.id}
            to={`/projects/${project.id}`}
            className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-neutral-300"
          >
            <h2 className="font-medium">{project.name}</h2>
            <p className="mt-1 truncate font-mono text-xs text-neutral-400">{project.project_key}</p>
          </Link>
        ))}
        {projects !== null && projects.length === 0 ? (
          <p className="text-sm text-neutral-500">No projects yet — create your first one.</p>
        ) : null}
      </div>

      <div className="max-w-sm rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-medium">New project</h2>
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
            className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {isPending ? "Creating..." : "Create"}
          </button>
        </form>
      </div>
    </div>
  );
}
