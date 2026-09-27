import { getAuthenticatedClient } from "../supabaseClient.js";
import { fetchDeliveryMode, resolveProjectId, type DeliveryMode } from "../loop.js";

const DESCRIPTIONS: Record<DeliveryMode, string> = {
  batch: "batch — agents may commit to main; betas ship every merged fix; reporters confirm; you promote a beta.",
  branch: "branch — agents open PRs; a preview of each PR ships its fixes; the PR's FeedbackKit check passes once they're verified.",
};

/**
 * `feedbackkit delivery [batch|branch]` — shows or sets how a project delivers
 * fixes (0024_delivery_modes.sql), the same setting as Settings → Delivery.
 */
export async function delivery(mode: string | undefined, options: { project?: string }): Promise<void> {
  const client = await getAuthenticatedClient();
  const projectId = await resolveProjectId(client, options.project ?? process.env.FEEDBACKKIT_PROJECT_ID);
  if (mode === undefined) {
    console.log(DESCRIPTIONS[await fetchDeliveryMode(client, projectId)]);
    return;
  }
  if (mode !== "batch" && mode !== "branch") throw new Error(`Delivery mode must be batch or branch, not "${mode}".`);
  const { error } = await client.from("projects").update({ delivery_mode: mode }).eq("id", projectId);
  if (error) throw new Error(error.message);
  console.log(`Set ${projectId} to ${DESCRIPTIONS[mode]}`);
}
