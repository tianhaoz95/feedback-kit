import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganizationId } from "@/lib/organization";
import type { Project } from "@/lib/types";
import { createProject } from "./actions";

export default async function ProjectsPage() {
  const supabase = await createClient();
  const organizationId = await getCurrentOrganizationId(supabase);

  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .returns<Project[]>();

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
            href={`/projects/${project.id}`}
            className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-neutral-300"
          >
            <h2 className="font-medium">{project.name}</h2>
            <p className="mt-1 truncate font-mono text-xs text-neutral-400">{project.project_key}</p>
          </Link>
        ))}
        {(projects ?? []).length === 0 ? (
          <p className="text-sm text-neutral-500">No projects yet — create your first one.</p>
        ) : null}
      </div>

      <div className="max-w-sm rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-medium">New project</h2>
        <form action={createProject} className="mt-3 flex gap-2">
          <input
            name="name"
            required
            placeholder="e.g. Consumer App"
            className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Create
          </button>
        </form>
      </div>
    </div>
  );
}
