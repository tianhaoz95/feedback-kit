import { getAuthenticatedClient } from "../supabaseClient.js";

export async function whoami(): Promise<void> {
  const client = await getAuthenticatedClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? "Couldn't determine the current user.");
  console.log(user.email ?? user.id);
}
