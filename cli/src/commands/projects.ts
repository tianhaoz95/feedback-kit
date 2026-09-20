import { getAuthenticatedClient } from "../supabaseClient.js";
import type { Project } from "../types.js";

export async function listProjects(): Promise<void> {
  const client = await getAuthenticatedClient();
  const { data, error } = await client
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<Project[]>();
  if (error) throw new Error(error.message);

  if (!data || data.length === 0) {
    console.log("No projects found.");
    return;
  }
  for (const project of data) {
    console.log(`${project.id}  ${project.name}`);
  }
}
