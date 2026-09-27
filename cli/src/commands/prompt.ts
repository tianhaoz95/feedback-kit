import { getAuthenticatedClient } from "../supabaseClient.js";
import { renderFeedbackPrompt } from "../loop.js";
import type { FeedbackItem } from "../types.js";

export async function printPrompt(feedbackId: string): Promise<void> {
  const client = await getAuthenticatedClient();

  const { data: feedback, error } = await client
    .from("feedback_items")
    .select("*")
    .eq("id", feedbackId)
    .single<FeedbackItem>();
  if (error || !feedback) {
    throw new Error(`Feedback ${feedbackId} not found, or you don't have access to it.`);
  }

  console.log(await renderFeedbackPrompt(client, feedback));
}
