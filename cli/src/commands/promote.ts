import { getAuthenticatedClient } from "../supabaseClient.js";
import { CiReleaseClient, DEFAULT_API_URL, currentUserId, resolveProjectId } from "../loop.js";

/**
 * `feedbackkit promote --build N` — record that a beta build went to
 * production (e.g. after submitting it in App Store Connect). The release
 * readiness view and each fixed report's timeline show it.
 */
export async function promote(options: {
  build: string;
  product?: string;
  project?: string;
  token?: string;
  apiUrl?: string;
}): Promise<void> {
  const build = options.build.trim();
  if (!build) throw new Error("--build is required.");
  const token = options.token ?? process.env.FEEDBACKKIT_RELEASE_TOKEN;

  if (token) {
    const ci = new CiReleaseClient(token, options.apiUrl ?? process.env.FEEDBACKKIT_API_URL ?? DEFAULT_API_URL);
    const { promoted } = await ci.promote(build, options.product);
    console.log(`Build ${build} marked as released to production (${promoted.length} release record(s)).`);
    return;
  }

  const client = await getAuthenticatedClient();
  const projectId = await resolveProjectId(client, options.project ?? process.env.FEEDBACKKIT_PROJECT_ID);
  let query = client
    .from("releases")
    .update({ channel: "production", promoted_at: new Date().toISOString(), promoted_by: await currentUserId(client) })
    .eq("project_id", projectId)
    .eq("build", build);
  if (options.product) query = query.eq("product_key", options.product);
  const { data, error } = await query.select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error(`No release of build ${build} found in this project.`);

  const { data: items } = await client.from("feedback_items").select("id").eq("project_id", projectId).eq("fixed_in_build", build);
  if (items && items.length > 0) {
    const userId = await currentUserId(client);
    await client.from("feedback_events").insert(
      items.map((item: { id: string }) => ({
        feedback_id: item.id,
        project_id: projectId,
        kind: "promoted",
        actor_type: "user",
        actor_user_id: userId,
        actor_label: "feedbackkit promote",
        body: `Build ${build} released to production.`,
        data: { build },
      })),
    );
  }
  console.log(`Build ${build} marked as released to production.`);
}
