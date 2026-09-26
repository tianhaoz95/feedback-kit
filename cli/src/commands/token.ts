import { getAuthenticatedClient } from "../supabaseClient.js";
import { resolveProjectId } from "../loop.js";

/**
 * `feedbackkit token create <name>` — a project release token for CI, printed
 * once (only its hash is stored). Typical use:
 *
 *   feedbackkit token create github-actions | gh secret set FEEDBACKKIT_RELEASE_TOKEN
 */
export async function createToken(name: string, options: { project?: string }): Promise<void> {
  const client = await getAuthenticatedClient();
  const projectId = await resolveProjectId(client, options.project ?? process.env.FEEDBACKKIT_PROJECT_ID);
  const { data, error } = await client.rpc("create_release_token", { p_project_id: projectId, p_name: name });
  if (error) throw new Error(error.message);
  // Token alone on stdout so it can be piped; the note goes to stderr.
  console.log(data as string);
  console.error("Store this now — it won't be shown again. Revoke it any time from project Settings → Release tokens.");
}

export async function listTokens(options: { project?: string }): Promise<void> {
  const client = await getAuthenticatedClient();
  const projectId = await resolveProjectId(client, options.project ?? process.env.FEEDBACKKIT_PROJECT_ID);
  const { data, error } = await client
    .from("release_tokens")
    .select("id, name, token_prefix, created_at, last_used_at, revoked_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    console.log("No release tokens.");
    return;
  }
  for (const t of data) {
    const state = t.revoked_at ? "revoked" : t.last_used_at ? `last used ${t.last_used_at.slice(0, 16).replace("T", " ")}` : "never used";
    console.log(`${t.id}  ${t.token_prefix}…  ${t.name}  (${state})`);
  }
}

export async function revokeToken(id: string): Promise<void> {
  const client = await getAuthenticatedClient();
  const { data, error } = await client
    .from("release_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .is("revoked_at", null)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error(`No active release token ${id} in your projects.`);
  console.log(`Revoked ${id}.`);
}
