// Deletes after-fix previews that have outlived their retention (see
// `previews_to_expire()` in 0025_access_tokens_and_previews.sql): 14 days
// after the report resolved, or 90 days after upload. The file is removed
// from Storage (SQL can't delete Storage objects) and the timeline entry
// stays, marked `expired_at` with its paths removed, so clients show
// "Preview expired" instead of a broken image. Also drops report-limited
// access tokens a day after they expired.
//
// Called once a day by .github/workflows/maintenance.yml with the
// MAINTENANCE_SECRET (`x-maintenance-secret`). `verify_jwt = false`; with no
// secret configured it refuses every call.
import { createClient } from "jsr:@supabase/supabase-js@2";

const BUCKET = "feedback-screenshots";

Deno.serve(async (req) => {
  const secret = Deno.env.get("MAINTENANCE_SECRET");
  if (!secret || req.headers.get("x-maintenance-secret") !== secret) {
    return json({ error: "unauthorized" }, 401);
  }

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });

    let expired = 0;
    for (let round = 0; round < 10; round++) {
      const { data: due, error } = await admin.rpc("previews_to_expire", { p_limit: 200 });
      if (error) return json({ error: "query_failed", message: error.message }, 500);
      if (!due?.length) break;

      const { error: removeError } = await admin.storage.from(BUCKET).remove(due.map((d: { path: string }) => d.path));
      if (removeError) return json({ error: "remove_failed", message: removeError.message, expired }, 500);

      const now = new Date().toISOString();
      for (const { event_id } of due as { event_id: string }[]) {
        const { data: event } = await admin.from("feedback_events").select("data").eq("id", event_id).single();
        if (!event) continue;
        const { media_path: _m, screenshot_path: _s, ...rest } = event.data ?? {};
        await admin.from("feedback_events").update({ data: { ...rest, expired_at: now } }).eq("id", event_id);
        expired++;
      }
    }

    const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count: tokens } = await admin
      .from("access_tokens")
      .delete({ count: "exact" })
      .not("feedback_id", "is", null)
      .lt("expires_at", dayAgo);

    return json({ expired, deleted_tokens: tokens ?? 0 }, 200);
  } catch (err) {
    console.error("cleanup-previews error:", err);
    return json({ error: "internal_error", message: err instanceof Error ? err.message : String(err) }, 500);
  }
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
