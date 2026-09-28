// Release recording for CI (see 0015_push_to_main_releases.sql, DESIGN.md §8).
//
// Every push to main ships a beta build from CI, and CI has no dashboard
// session to act as — so instead of a user JWT it presents a project-scoped
// access token with the releases:write scope (`x-release-token`, created in
// project Settings; `fkr_…` release tokens from before access tokens are
// the same thing — see 0025_access_tokens_and_previews.sql). With that scope
// a token can do exactly three things here for its one project: list fixes
// waiting to ship, record a release that ships some of them, and mark a
// release promoted to production. `verify_jwt = false`; service-role client, like
// ingest-feedback — the token check below is the whole trust boundary.
//
//   GET                              → { project, candidates: [...merged fixes] }
//   GET ?pr=<n>                      → { project, candidates: [...fixes linked to PR n] } (preview builds)
//   POST { build, version?, commit_sha?, product_key?, channel?, pr_number?, feedback_ids } → { release_id, shipped }
//   POST { action: "promote", build, product_key? }  → { promoted }
//
// `feedbackkit release --token` is the client: it fetches candidates, keeps
// the ones whose fix commit is in the build (git ancestry, checked locally in
// the CI checkout), and records the release with those ids.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { syncPrStatus } from "../_shared/prStatus.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-release-token, x-feedbackkit-token",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const MAX_IDS = 500;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const token = req.headers.get("x-release-token") ?? req.headers.get("x-feedbackkit-token") ?? "";
    if (!/^fk[rt]_[0-9a-f]{48}$/.test(token)) return json({ error: "missing_or_malformed_token" }, 401);

    const hash = await sha256Hex(token);
    let { data: tokenRow, error: lookupError } = await supabase
      .from("access_tokens")
      .select("id, project_id, name, scopes, revoked_at, expires_at, parent_id")
      .eq("token_hash", hash)
      .maybeSingle();
    let table = "access_tokens";
    if (lookupError) {
      // Deployed before 0025: the old release_tokens table, release-only.
      const legacy = await supabase
        .from("release_tokens")
        .select("id, project_id, name, revoked_at")
        .eq("token_hash", hash)
        .maybeSingle();
      tokenRow = legacy.data
        ? { ...legacy.data, scopes: ["releases:write"], expires_at: null, parent_id: null }
        : null;
      table = "release_tokens";
    }
    if (!tokenRow || tokenRow.revoked_at || tokenRow.parent_id) return json({ error: "invalid_token" }, 401);
    if (tokenRow.expires_at && new Date(tokenRow.expires_at).getTime() <= Date.now()) {
      return json({ error: "token_expired" }, 401);
    }
    if (!(tokenRow.scopes as string[]).includes("releases:write")) {
      return json({ error: "missing_scope", message: "This token can't record releases (needs releases:write)." }, 403);
    }

    await supabase.from(table).update({ last_used_at: new Date().toISOString() }).eq("id", tokenRow.id);

    const { data: project } = await supabase
      .from("projects")
      .select("id, name")
      .eq("id", tokenRow.project_id)
      .single();
    if (!project) return json({ error: "project_not_found" }, 404);

    if (req.method === "GET") {
      // A preview build of PR n ships the fixes linked to that PR, whatever
      // stage they're at (not verified yet); a main build ships merged ones.
      const pr = Number(new URL(req.url).searchParams.get("pr"));
      let query = supabase
        .from("feedback_items")
        .select("id, text, fix_commit_sha, fix_summary, product_keys, created_at")
        .eq("project_id", project.id);
      query = Number.isInteger(pr) && pr > 0
        ? query.eq("fix_pr_number", pr).in("fix_stage", ["agent_working", "pr_open", "shipped", "reopened"])
        : query.eq("fix_stage", "merged");
      const { data: candidates, error } = await query.order("created_at", { ascending: true }).limit(MAX_IDS);
      if (error) return json({ error: "query_failed", message: error.message }, 500);
      return json({ project, candidates: candidates ?? [] }, 200);
    }

    if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

    // deno-lint-ignore no-explicit-any
    let body: Record<string, any>;
    try {
      body = await req.json();
    } catch {
      return json({ error: "invalid_json_body" }, 400);
    }

    const build = typeof body.build === "string" ? body.build.trim().slice(0, 64) : "";
    if (!build) return json({ error: "build_required" }, 400);
    const productKey = typeof body.product_key === "string" && body.product_key ? body.product_key.slice(0, 100) : null;

    if (body.action === "promote") {
      let query = supabase
        .from("releases")
        .update({ channel: "production", promoted_at: new Date().toISOString() })
        .eq("project_id", project.id)
        .eq("build", build);
      query = productKey ? query.eq("product_key", productKey) : query;
      const { data: promoted, error } = await query.select("id");
      if (error) return json({ error: "promote_failed", message: error.message }, 500);
      if (!promoted || promoted.length === 0) return json({ error: "release_not_found" }, 404);
      await recordPromotedEvents(supabase, project.id, build, tokenRow.name);
      return json({ promoted: promoted.map((r: { id: string }) => r.id) }, 200);
    }

    const ids: unknown = body.feedback_ids ?? [];
    if (!Array.isArray(ids) || ids.length > MAX_IDS || ids.some((id) => typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id))) {
      return json({ error: "invalid_feedback_ids" }, 400);
    }
    const channel = body.channel === "production" || body.channel === "preview" ? body.channel : "beta";
    const prNumber = Number.isInteger(body.pr_number) && body.pr_number > 0 ? body.pr_number : null;
    if (channel === "preview" && !prNumber) return json({ error: "pr_number_required" }, 400);

    const { data: shipped, error } = await supabase.rpc("record_release_system", {
      p_project_id: project.id,
      p_build: build,
      p_version: typeof body.version === "string" ? body.version.slice(0, 64) : null,
      p_commit_sha: typeof body.commit_sha === "string" ? body.commit_sha.slice(0, 64) : null,
      p_product_key: productKey,
      p_channel: channel,
      p_feedback_ids: ids,
      p_actor_label: `CI (${tokenRow.name})`,
    });
    if (error) return json({ error: "record_failed", message: error.message }, 500);
    if (prNumber) {
      await supabase.from("releases").update({ pr_number: prNumber })
        .eq("project_id", project.id).eq("build", build).eq("channel", "preview");
      await syncPrStatus(supabase, project.id, prNumber);
    }
    return json({ shipped: shipped ?? [] }, 200);
  } catch (err) {
    console.error("ci-release error:", err);
    return json({ error: "internal_error", message: err instanceof Error ? err.message : String(err) }, 500);
  }
});

/** Timeline entry on every report fixed in a build that just went to production. */
// deno-lint-ignore no-explicit-any
async function recordPromotedEvents(supabase: any, projectId: string, build: string, tokenName: string) {
  const { data: items } = await supabase
    .from("feedback_items")
    .select("id, project_id")
    .eq("project_id", projectId)
    .eq("fixed_in_build", build);
  if (!items?.length) return;
  await supabase.from("feedback_events").insert(
    items.map((item: { id: string; project_id: string }) => ({
      feedback_id: item.id,
      project_id: item.project_id,
      kind: "promoted",
      actor_type: "system",
      actor_label: `CI (${tokenName})`,
      body: `Build ${build} released to production.`,
      data: { build },
      visible_to_reporter: false,
    })),
  );
}

async function sha256Hex(text: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
