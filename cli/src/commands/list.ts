import { getAuthenticatedClient } from "../supabaseClient.js";
import type { FeedbackItem, FeedbackStatus, FixStage } from "../types.js";

const VALID_STATUSES: FeedbackStatus[] = ["new", "in_progress", "resolved", "wont_fix"];
const VALID_STAGES: FixStage[] = ["agent_working", "pr_open", "merged", "shipped", "verified", "reopened"];

export async function listFeedback(options: { project?: string; status?: string; stage?: string }): Promise<void> {
  if (options.status && !VALID_STATUSES.includes(options.status as FeedbackStatus)) {
    throw new Error(`--status must be one of: ${VALID_STATUSES.join(", ")}`);
  }
  if (options.stage && !VALID_STAGES.includes(options.stage as FixStage)) {
    throw new Error(`--stage must be one of: ${VALID_STAGES.join(", ")}`);
  }

  const client = await getAuthenticatedClient();
  let query = client.from("feedback_items").select("*").order("created_at", { ascending: false });
  if (options.project) query = query.eq("project_id", options.project);
  if (options.status) query = query.eq("status", options.status);
  if (options.stage) query = query.eq("fix_stage", options.stage);

  const { data, error } = await query.returns<FeedbackItem[]>();
  if (error) throw new Error(error.message);

  if (!data || data.length === 0) {
    console.log("No feedback found.");
    return;
  }

  for (const item of data) {
    const screen = item.environment?.screenName ?? "?";
    const text = item.text.length > 60 ? `${item.text.slice(0, 57)}...` : item.text;
    const stage = item.fix_stage ? ` / ${item.fix_stage}` : "";
    console.log(`${item.id}  [${item.status}${stage}]  ${screen}  ${text}`);
  }
}
