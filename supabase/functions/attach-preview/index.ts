// After-fix previews (0025_access_tokens_and_previews.sql): a coding agent
// (or a developer) attaches a screenshot or short video of the fixed screen
// to a report, shown in the dashboard and the Portal next to the reporter's
// original and annotated screenshots.
//
//   POST ?feedback_id=<id>&caption=…&actor_label=…&build=…&commit_sha=…
//   body: the file's bytes (PNG, JPEG, GIF, WebP, or MP4 up to 30 s), ≤ 20 MB
//   → { event_id, path, media_type }
//
// Who may: a member (their session in `Authorization`) or an access token
// with previews:write (`x-feedbackkit-token`). Either way the report is read
// through RLS with the caller's own credentials first, so access is decided
// by the same policies as everything else; only the upload and the timeline
// entry are written with the service role, because this function validates
// the file (real type from its bytes, size, video length) before storing it.
// `verify_jwt = false`: token callers present no JWT.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { MAX_PREVIEW_BYTES, MAX_VIDEO_SECONDS, mp4DurationSeconds, sniffMedia } from "../_shared/media.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-feedbackkit-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "feedback-screenshots";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const url = new URL(req.url);
    const feedbackId = url.searchParams.get("feedback_id") ?? "";
    if (!/^[0-9a-f-]{36}$/i.test(feedbackId)) return json({ error: "feedback_id_required" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const token = req.headers.get("x-feedbackkit-token");
    const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";

    // The caller's own view of the data: a token, or a member's session.
    let caller;
    let userId: string | null = null;
    if (token) {
      caller = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false },
        global: { headers: { "x-feedbackkit-token": token } },
      });
      const { data: info } = await caller.rpc("access_token_info");
      if (!info) return json({ error: "invalid_token" }, 401);
      if (!(info.scopes as string[]).includes("previews:write")) {
        return json({ error: "missing_scope", message: "This token can't attach previews (needs previews:write)." }, 403);
      }
    } else if (bearer) {
      caller = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${bearer}` } },
      });
      const { data: user } = await caller.auth.getUser(bearer);
      if (!user.user) return json({ error: "invalid_session" }, 401);
      userId = user.user.id;
    } else {
      return json({ error: "unauthorized" }, 401);
    }

    const { data: item } = await caller
      .from("feedback_items")
      .select("id, project_id")
      .eq("id", feedbackId)
      .maybeSingle();
    if (!item) return json({ error: "feedback_not_found" }, 404);

    const declared = Number(req.headers.get("content-length") ?? "0");
    if (declared > MAX_PREVIEW_BYTES) return json({ error: "too_large", message: "Previews can be up to 20 MB." }, 413);
    const bytes = new Uint8Array(await req.arrayBuffer());
    if (bytes.length === 0) return json({ error: "empty_body" }, 400);
    if (bytes.length > MAX_PREVIEW_BYTES) return json({ error: "too_large", message: "Previews can be up to 20 MB." }, 413);

    const kind = sniffMedia(bytes);
    if (!kind) {
      return json({ error: "unsupported_type", message: "Attach a PNG, JPEG, GIF or WebP image, or an MP4 video." }, 415);
    }
    let durationSeconds: number | null = null;
    if (kind.isVideo) {
      durationSeconds = mp4DurationSeconds(bytes);
      if (durationSeconds === null) {
        return json({ error: "unreadable_video", message: "Couldn't read this MP4's duration." }, 422);
      }
      if (durationSeconds > MAX_VIDEO_SECONDS + 0.5) {
        return json({ error: "too_long", message: `Videos can be up to ${MAX_VIDEO_SECONDS} seconds.` }, 422);
      }
    }

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const path = `${item.project_id}/${item.id}/after/${Date.now()}.${kind.extension}`;
    const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, bytes, {
      contentType: kind.mediaType,
      upsert: false,
    });
    if (uploadError) return json({ error: "upload_failed", message: uploadError.message }, 500);

    const text = (name: string, max: number) => {
      const value = url.searchParams.get(name)?.trim();
      return value ? value.slice(0, max) : null;
    };
    const { data: event, error: eventError } = await admin
      .from("feedback_events")
      .insert({
        feedback_id: item.id,
        project_id: item.project_id,
        kind: "after_screenshot",
        actor_type: token ? "agent" : url.searchParams.get("actor_type") === "user" ? "user" : "agent",
        actor_user_id: userId,
        actor_label: text("actor_label", 80) ?? "Coding agent",
        body: text("caption", 500) ?? (kind.isVideo ? "Video after the fix." : "Screenshot after the fix."),
        data: {
          media_path: path,
          media_type: kind.mediaType,
          // Portal builds from before videos read screenshot_path as an image.
          ...(kind.isVideo ? {} : { screenshot_path: path }),
          bytes: bytes.length,
          ...(durationSeconds !== null ? { duration_seconds: Math.round(durationSeconds * 10) / 10 } : {}),
          ...(text("build", 64) ? { build: text("build", 64) } : {}),
          ...(text("commit_sha", 64) ? { commit_sha: text("commit_sha", 64) } : {}),
        },
        visible_to_reporter: false,
      })
      .select("id")
      .single();
    if (eventError) {
      await admin.storage.from(BUCKET).remove([path]);
      return json({ error: "record_failed", message: eventError.message }, 500);
    }

    return json({ event_id: event.id, path, media_type: kind.mediaType }, 200);
  } catch (err) {
    console.error("attach-preview error:", err);
    return json({ error: "internal_error", message: err instanceof Error ? err.message : String(err) }, 500);
  }
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
