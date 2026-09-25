import { getAuthenticatedClient } from "../supabaseClient.js";
import { fetchFeedback, linkFix } from "../loop.js";

/** `feedbackkit link <id> --commit <sha>` / `--pr <url>` — record a fix by hand. */
export async function link(
  feedbackId: string,
  options: { pr?: string; commit?: string; merged?: boolean; summary?: string },
): Promise<void> {
  if (!options.pr && !options.commit) throw new Error("Pass --pr <url> and/or --commit <sha>.");
  const client = await getAuthenticatedClient();
  const item = await fetchFeedback(client, feedbackId);
  const stage = await linkFix(
    client,
    item,
    { prUrl: options.pr, commitSha: options.commit, merged: options.merged, summary: options.summary },
    { actorType: "user", actorLabel: "feedbackkit CLI" },
  );
  console.log(`Linked ${feedbackId} (${stage}).`);
}
