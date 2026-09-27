// Refreshes a pull request's "FeedbackKit" commit status (branch delivery,
// 0024_delivery_modes.sql) after something a member did outside the other
// functions: "Mark verified" in the dashboard, or a preview release recorded
// with a `feedbackkit login` session.
//
//   POST { project_id, pr_number }  (member's JWT)  → { ok: true }
//
// The caller's own client reads the project, so RLS decides access; the
// GitHub call itself runs with the service role inside syncPrStatus.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/http.ts";
import { syncPrStatus } from "../_shared/prStatus.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "missing_auth" }, 401);

  let body: { project_id?: string; pr_number?: number };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json_body" }, 400);
  }
  if (!body.project_id || !Number.isInteger(body.pr_number)) return json({ error: "missing_fields" }, 400);

  const url = Deno.env.get("SUPABASE_URL")!;
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
  const { data: project } = await userClient.from("projects").select("id").eq("id", body.project_id).maybeSingle();
  if (!project) return json({ error: "project_not_found" }, 404);

  await syncPrStatus(createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!), project.id, body.pr_number!);
  return json({ ok: true }, 200);
});
