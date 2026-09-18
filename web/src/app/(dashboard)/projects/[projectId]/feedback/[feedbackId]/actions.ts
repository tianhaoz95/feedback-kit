"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FeedbackStatus } from "@/lib/types";

export async function updateFeedbackStatus(
  projectId: string,
  feedbackId: string,
  status: FeedbackStatus,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("feedback_items")
    .update({ status })
    .eq("id", feedbackId);

  if (error) throw new Error(error.message);
  revalidatePath(`/projects/${projectId}/feedback/${feedbackId}`);
}

export async function saveEditedPrompt(
  projectId: string,
  feedbackId: string,
  formData: FormData,
) {
  const supabase = await createClient();
  const editedPrompt = String(formData.get("template_text") || "");

  const { error } = await supabase
    .from("feedback_items")
    .update({ edited_prompt: editedPrompt })
    .eq("id", feedbackId);

  if (error) throw new Error(error.message);
  revalidatePath(`/projects/${projectId}/feedback/${feedbackId}`);
}

export async function resetEditedPrompt(projectId: string, feedbackId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("feedback_items")
    .update({ edited_prompt: null })
    .eq("id", feedbackId);

  if (error) throw new Error(error.message);
  revalidatePath(`/projects/${projectId}/feedback/${feedbackId}`);
}
