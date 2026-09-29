// Shared by the scripts in scripts/agent-preview/: reading a FeedbackKit
// report and attaching an after-fix preview to it, as the access token in
// FEEDBACKKIT_TOKEN (an agent run's report-limited token, or any token with
// feedback:read / previews:write). Mirrors cli/src/loop.ts attachPreview.

// Same defaults as cli/src/supabaseClient.ts (the hosted backend's public URL and publishable key).
const API_URL = (process.env.FEEDBACKKIT_API_URL ?? "https://gpucoladcyvijefdjudf.supabase.co").replace(/\/+$/, "");
const ANON_KEY = process.env.FEEDBACKKIT_ANON_KEY ?? "sb_publishable_crkqEdaacVS02etk6k16ag_ATIk-8Kn";
const TOKEN = process.env.FEEDBACKKIT_TOKEN?.trim() || null;

/** Exit code for "nothing to capture" (not this kind of report, or already attached). */
export const SKIP = 3;

export function log(message) {
  console.error(`agent-preview: ${message}`);
}

export async function hosted(path, init = {}) {
  if (!TOKEN) throw new Error("Needs FEEDBACKKIT_TOKEN (a FeedbackKit access token for the report).");
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { apikey: ANON_KEY, "x-feedbackkit-token": TOKEN, ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${path.split("?")[0]}: ${res.status} ${await res.text()}`);
  return res;
}

/** The report, its timeline and project name, and (with `images`) its screenshots' bytes by storage path. */
export async function fetchReport(id, { images: withImages = false } = {}) {
  const [item] = await (await hosted(`/rest/v1/feedback_items?id=eq.${id}&select=*`)).json();
  if (!item) throw new Error(`Report ${id} not found (or the token can't read it).`);
  const events = await hosted(`/rest/v1/feedback_events?feedback_id=eq.${id}&select=*&order=created_at`)
    .then((r) => r.json())
    .catch(() => []);
  const project = await hosted(`/rest/v1/projects?id=eq.${item.project_id}&select=id,name`)
    .then((r) => r.json())
    .then((rows) => rows[0] ?? null)
    .catch(() => null);
  const images = {};
  for (const path of withImages ? [item.screenshot_raw_path, item.screenshot_annotated_path].filter(Boolean) : []) {
    try {
      const { signedURL } = await (
        await hosted(`/storage/v1/object/sign/feedback-screenshots/${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expiresIn: 300 }),
        })
      ).json();
      const res = await fetch(`${API_URL}/storage/v1${signedURL}`);
      if (res.ok) images[path] = new Uint8Array(await res.arrayBuffer());
    } catch {
      // A placeholder shows instead; the page itself is what matters.
    }
  }
  return { item, events, project, images };
}

/** True when the report got an after-fix preview at or after `since` (an ISO time). */
export function hasPreviewSince(report, since) {
  const t = Date.parse(since);
  return report.events.some((e) => e.kind === "after_screenshot" && Date.parse(e.created_at) >= t);
}

export async function attach(id, bytes, caption) {
  const url = new URL(`${API_URL}/functions/v1/attach-preview`);
  url.searchParams.set("feedback_id", id);
  url.searchParams.set("actor_label", process.env.FEEDBACKKIT_ACTOR_LABEL ?? "Coding agent");
  url.searchParams.set("actor_type", "agent");
  if (caption) url.searchParams.set("caption", caption);
  const res = await hosted(`${url.pathname}${url.search}`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: bytes,
  });
  return res.json();
}
