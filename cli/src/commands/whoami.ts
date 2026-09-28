import { getAuthenticatedClient, tokenInfo } from "../supabaseClient.js";

export async function whoami(): Promise<void> {
  const client = await getAuthenticatedClient();
  const token = tokenInfo(client);
  if (token) {
    const limit = token.feedback_id ? `, limited to report ${token.feedback_id}` : "";
    const expiry = token.expires_at ? `, expires ${token.expires_at.slice(0, 16).replace("T", " ")}` : "";
    console.log(`Access token "${token.name}" for ${token.project_name ?? token.project_id} [${token.scopes.join(" ")}]${limit}${expiry}`);
    return;
  }
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? "Couldn't determine the current user.");
  console.log(user.email ?? user.id);
}
