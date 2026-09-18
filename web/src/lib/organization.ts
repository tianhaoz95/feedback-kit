import { supabase } from "@/lib/supabase";

/**
 * The org the current user acts as. Membership supports many-to-many
 * (multiple people per org, and — in the schema, though not yet in this UI —
 * a person could belong to more than one org), but v1 of the dashboard just
 * uses the first membership found. An org switcher is the natural next step
 * once that becomes a real scenario for users.
 */
export async function getCurrentOrganizationId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  return data?.organization_id ?? null;
}
