// Connects a dashboard user's GitHub account through the FeedbackKit GitHub
// App's user authorization, so "Send to agent" can assign issues to Copilot's
// coding agent as that user (0018_copilot_dispatch.sql — GitHub rejects the
// assignment from an installation token). The token is stored for the service
// role only; the dashboard sees just the login via github_user_connection().
//
//   POST {action: "authorize_url", redirect_uri, state} → {url}
//   POST {action: "exchange", code, redirect_uri}        → {github_login}
//
// Answers 501 {error: "github_user_auth_not_configured"} until
// GITHUB_APP_CLIENT_ID and GITHUB_APP_CLIENT_SECRET are set, the same way
// billing answers before Stripe exists.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/http.ts";
import { githubUserAuthConfig, requestGitHubUserToken, tokenRow } from "../_shared/github.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const config = githubUserAuthConfig();
  if (!config) {
    return json({ error: "github_user_auth_not_configured", message: "GitHub account connection isn't set up on this server yet." }, 501);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "missing_auth" }, 401);
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser(authHeader.replace(/^Bearer\s+/i, ""));
  if (userError || !user) return json({ error: "unauthorized" }, 401);

  let body: { action?: string; code?: string; redirect_uri?: string; state?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json_body" }, 400);
  }

  if (body.action === "authorize_url") {
    if (!body.redirect_uri || !body.state) return json({ error: "missing_fields" }, 400);
    const url = new URL("https://github.com/login/oauth/authorize");
    url.searchParams.set("client_id", config.clientId);
    url.searchParams.set("redirect_uri", body.redirect_uri);
    url.searchParams.set("state", body.state);
    return json({ url: url.toString() }, 200);
  }

  if (body.action === "exchange") {
    if (!body.code || !body.redirect_uri) return json({ error: "missing_fields" }, 400);
    const token = await requestGitHubUserToken({ code: body.code, redirect_uri: body.redirect_uri });
    if (!token.access_token) {
      return json({ error: "github_exchange_failed", message: token.error_description ?? token.error ?? "GitHub didn't return a token." }, 400);
    }
    const me = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${token.access_token}`, Accept: "application/vnd.github+json", "User-Agent": "FeedbackKit" },
    });
    const login = me.ok ? ((await me.json()).login as string | undefined) ?? null : null;

    const adminClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { error } = await adminClient
      .from("github_user_tokens")
      .upsert({ user_id: user.id, github_login: login, ...tokenRow(token) });
    if (error) return json({ error: "store_failed", message: error.message }, 500);
    return json({ github_login: login }, 200);
  }

  return json({ error: "unknown_action" }, 400);
});
