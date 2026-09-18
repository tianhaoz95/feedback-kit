"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updatePromptTemplate(projectId: string, formData: FormData) {
  const supabase = await createClient();
  const templateText = String(formData.get("template_text") || "");

  const { error } = await supabase
    .from("prompt_templates")
    .update({ template_text: templateText, updated_at: new Date().toISOString() })
    .eq("project_id", projectId);

  if (error) throw new Error(error.message);
  revalidatePath(`/projects/${projectId}`);
}
