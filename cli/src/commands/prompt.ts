import { getAuthenticatedClient } from "../supabaseClient.js";
import { renderPromptTemplate } from "../promptTemplate.js";
import type { FeedbackItem, PromptTemplate } from "../types.js";

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

  if (feedback.edited_prompt) {
    console.log(feedback.edited_prompt);
    return;
  }

  const { data: template } = await client
    .from("prompt_templates")
    .select("*")
    .eq("project_id", feedback.project_id)
    .single<PromptTemplate>();

  const [{ data: screenshotSigned }, attachmentSigned] = await Promise.all([
    client.storage.from("feedback-screenshots").createSignedUrl(feedback.screenshot_annotated_path, 3600),
    feedback.attachment_path
      ? client.storage.from("feedback-screenshots").createSignedUrl(feedback.attachment_path, 3600)
      : Promise.resolve(null),
  ]);

  console.log(
    renderPromptTemplate(
      template?.template_text ?? "",
      feedback,
      screenshotSigned?.signedUrl ?? null,
      attachmentSigned?.data?.signedUrl ?? null,
    ),
  );
}
