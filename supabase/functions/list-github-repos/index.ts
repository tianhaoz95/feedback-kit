import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/http.ts";
import { listAppRepositories } from "../_shared/github.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST" && req.method !== "GET") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ error: "missing_auth", message: "Authorization header required" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // 1. Verify caller session
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    return json({ error: "unauthorized", message: "Invalid or expired session" }, 401);
  }

  const userLogin = (user.user_metadata?.user_name ||
    user.user_metadata?.preferred_username) as string | undefined;

  try {
    const repos = await listAppRepositories(userLogin);
    return json({ repositories: repos }, 200);
  } catch (err) {
    return json({ error: "failed_to_list_repos", message: String(err) }, 500);
  }
});
