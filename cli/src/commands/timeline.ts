import { getAuthenticatedClient } from "../supabaseClient.js";
import { fetchFeedback, fetchTimeline, formatTimeline } from "../loop.js";

export async function timeline(feedbackId: string): Promise<void> {
  const client = await getAuthenticatedClient();
  const item = await fetchFeedback(client, feedbackId);
  console.log(`${item.id}  [${item.status}${item.fix_stage ? ` / ${item.fix_stage}` : ""}]  ${item.text}`);
  if (item.fix_pr_url) console.log(`Fix: ${item.fix_pr_url}`);
  if (item.fixed_in_build) console.log(`Shipped in build ${item.fixed_in_build}`);
  console.log("");
  console.log(formatTimeline(await fetchTimeline(client, item.id)));
}
