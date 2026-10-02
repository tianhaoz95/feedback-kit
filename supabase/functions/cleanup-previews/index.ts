// Deletes after-fix previews that have outlived their retention (see
// `previews_to_expire()` in 0025_access_tokens_and_previews.sql): 14 days
// after the report resolved, or 90 days after upload. The file is removed
// from Storage (SQL can't delete Storage objects) and the timeline entry
// stays, marked `expired_at` with its paths removed, so clients show
// "Preview expired" instead of a broken image. Also drops report-limited
// access tokens a day after they expired, and deletes Free plan reports'
// screenshots and attachments past the plan's retention
// (`free_media_to_expire()`, 0028_indie_pricing.sql): the report and its
// text stay, with its media paths cleared and `media_expired_at` set.
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

    let mediaExpired = 0;
    for (let round = 0; round < 10; round++) {
      const { data: due, error } = await admin.rpc("free_media_to_expire", { p_limit: 200 });
      // Missing before its migration: skip, like every other fail-open check.
      if (error || !due?.length) break;

      const paths = (due as { paths: string[] }[]).flatMap((d) => d.paths);
      if (paths.length) {
        const { error: removeError } = await admin.storage.from(BUCKET).remove(paths);
        if (removeError) return json({ error: "remove_failed", message: removeError.message, expired, mediaExpired }, 500);
      }
      const { error: updateError } = await admin
        .from("feedback_items")
        .update({
          screenshot_raw_path: null,
          screenshot_annotated_path: null,
          attachment_path: null,
          media_expired_at: new Date().toISOString(),
        })
        .in("id", (due as { feedback_id: string }[]).map((d) => d.feedback_id));
      if (updateError) return json({ error: "update_failed", message: updateError.message, expired, mediaExpired }, 500);
      mediaExpired += due.length;
    }

    const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count: tokens } = await admin
      .from("access_tokens")
      .delete({ count: "exact" })
      .not("feedback_id", "is", null)
      .lt("expires_at", dayAgo);

    return json({ expired, media_expired: mediaExpired, deleted_tokens: tokens ?? 0 }, 200);
  } catch (err) {
    console.error("cleanup-previews error:", err);
    return json({ error: "internal_error", message: err instanceof Error ? err.message : String(err) }, 500);
  }
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
