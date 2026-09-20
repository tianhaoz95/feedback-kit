import { getAuthenticatedClient } from "../supabaseClient.js";
import type { FeedbackItem, FeedbackStatus } from "../types.js";

const VALID_STATUSES: FeedbackStatus[] = ["new", "in_progress", "resolved", "wont_fix"];

export async function listFeedback(options: { project?: string; status?: string }): Promise<void> {
  if (options.status && !VALID_STATUSES.includes(options.status as FeedbackStatus)) {
    throw new Error(`--status must be one of: ${VALID_STATUSES.join(", ")}`);
  }

  const client = await getAuthenticatedClient();
  let query = client.from("feedback_items").select("*").order("created_at", { ascending: false });
  if (options.project) query = query.eq("project_id", options.project);
  if (options.status) query = query.eq("status", options.status);

  const { data, error } = await query.returns<FeedbackItem[]>();
  if (error) throw new Error(error.message);

  if (!data || data.length === 0) {
    console.log("No feedback found.");
    return;
  }

  for (const item of data) {
    const screen = item.environment?.screenName ?? "?";
    const text = item.text.length > 60 ? `${item.text.slice(0, 57)}...` : item.text;
    console.log(`${item.id}  [${item.status}]  ${screen}  ${text}`);
  }
}
