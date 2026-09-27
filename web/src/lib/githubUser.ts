import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

/**
 * Connecting a member's own GitHub account (the FeedbackKit GitHub App's user
 * authorization), so "Send to agent" can assign issues to Copilot's coding
 * agent as them — GitHub rejects that from the app's installation token. See
 * supabase/migrations/0018_copilot_dispatch.sql and the github-user-auth
 * Edge Function.
 */
export interface GitHubUserConnection {
  github_login: string | null;
  connected_at: string;
  expired: boolean;
}

const PENDING_KEY = "feedbackkit.githubUserAuth";
export const GITHUB_CALLBACK_PATH = "/github/callback";

export function githubCallbackUrl(): string {
  return `${window.location.origin}${GITHUB_CALLBACK_PATH}`;
}

export async function fetchGitHubUserConnection(): Promise<GitHubUserConnection | null> {
  const { data, error } = await supabase.rpc("github_user_connection");
  if (error) throw error;
  return ((data ?? []) as GitHubUserConnection[])[0] ?? null;
}

export async function disconnectGitHubUser(): Promise<void> {
  const { error } = await supabase.rpc("disconnect_github_user");
  if (error) throw error;
}

/** The error body an Edge Function answered with, when it answered at all. */
async function functionErrorBody(error: unknown): Promise<{ error?: string; message?: string } | null> {
  if (error instanceof FunctionsHttpError) return await error.context.json().catch(() => null);
  return null;
}

/** Sends the browser to GitHub; it comes back to GitHubCallbackPage, then to `returnTo`. */
export async function startGitHubUserConnect(returnTo: string): Promise<void> {
  const state = crypto.randomUUID();
  const { data, error } = await supabase.functions.invoke("github-user-auth", {
    body: { action: "authorize_url", redirect_uri: githubCallbackUrl(), state },
  });
  if (error) {
    const body = await functionErrorBody(error);
    throw new Error(body?.message ?? error.message);
  }
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ state, returnTo }));
  } catch {
    // Private mode: the callback then can't verify state and asks to retry.
  }
  window.location.assign((data as { url: string }).url);
}

/** Verifies the callback's state and stores the token server-side. Returns where to go next. */
export async function finishGitHubUserConnect(code: string, state: string): Promise<{ returnTo: string; login: string | null }> {
  let pending: { state?: string; returnTo?: string } = {};
  try {
    pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? "{}");
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // Treated as a state mismatch below.
  }
  if (!pending.state || pending.state !== state) {
    throw new Error("This sign-in link doesn't match one started here. Start again from project Settings.");
  }
  const { data, error } = await supabase.functions.invoke("github-user-auth", {
    body: { action: "exchange", code, redirect_uri: githubCallbackUrl() },
  });
  if (error) {
    const body = await functionErrorBody(error);
    throw new Error(body?.message ?? error.message);
  }
  return { returnTo: pending.returnTo ?? "/projects", login: (data as { github_login: string | null }).github_login };
}
