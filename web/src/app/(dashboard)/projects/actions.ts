"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganizationId } from "@/lib/organization";

export async function createProject(formData: FormData) {
  const supabase = await createClient();
  const organizationId = await getCurrentOrganizationId(supabase);
  if (!organizationId) redirect("/login");

  const name = String(formData.get("name") || "").trim();
  if (!name) return;

  const { data, error } = await supabase
    .from("projects")
    .insert({ organization_id: organizationId, name })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/projects");
  redirect(`/projects/${data.id}`);
}
