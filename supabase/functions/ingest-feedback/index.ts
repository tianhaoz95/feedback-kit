// Public ingestion endpoint the FeedbackKit iOS SDK POSTs to.
//
// Auth model: there's no user auth here at all — the request is identified
// purely by `project_key`, which is safe to embed in a shipped app binary (it
// only ever lets someone *create* feedback for a project, never read
// anything). This function uses the service-role key to write, so it
// completely bypasses the dashboard's RLS policies by design.
//
// Wire format is documented in Sources/FeedbackKit/Networking/FeedbackSubmitter.swift
// (the `IngestPayload` type) — keep the two in sync.
import { createClient } from "jsr:@supabase/supabase-js@2";

interface IngestPayload {
  project_key: string;
  id: string;
  created_at: string;
  text: string;
  screenshot_raw_png_base64?: string;
  screenshot_annotated_png_base64?: string;
  annotations: unknown;
  environment: Record<string, unknown>;
  attachment_filename?: string;
  attachment_mime_type?: string;
  attachment_data_base64?: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "method not allowed" }, 405);
  }

  let payload: IngestPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }

  if (!payload.project_key || !payload.id || payload.text === undefined) {
    return json({ error: "missing required fields" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("project_key", payload.project_key)
    .single();

  if (projectError || !project) {
    return json({ error: "unknown project_key" }, 401);
  }

  // Screenshots are optional — the user can toggle them off before
  // submitting, e.g. for a pure-description report.
  let rawPath: string | null = null;
  let annotatedPath: string | null = null;
  if (payload.screenshot_raw_png_base64 && payload.screenshot_annotated_png_base64) {
    rawPath = `${project.id}/${payload.id}/raw.png`;
    annotatedPath = `${project.id}/${payload.id}/annotated.png`;

    const [rawUpload, annotatedUpload] = await Promise.all([
      supabase.storage
        .from("feedback-screenshots")
        .upload(rawPath, decodeBase64(payload.screenshot_raw_png_base64), {
          contentType: "image/png",
          upsert: true,
        }),
      supabase.storage
        .from("feedback-screenshots")
        .upload(annotatedPath, decodeBase64(payload.screenshot_annotated_png_base64), {
          contentType: "image/png",
          upsert: true,
        }),
    ]);

    if (rawUpload.error || annotatedUpload.error) {
      return json(
        { error: "failed to store screenshots", detail: rawUpload.error ?? annotatedUpload.error },
        500,
      );
    }
  }

  let attachmentPath: string | null = null;
  if (payload.attachment_data_base64 && payload.attachment_filename) {
    attachmentPath = `${project.id}/${payload.id}/attachment/${sanitizeFilename(payload.attachment_filename)}`;
    const { error: attachmentError } = await supabase.storage
      .from("feedback-screenshots")
      .upload(attachmentPath, decodeBase64(payload.attachment_data_base64), {
        contentType: payload.attachment_mime_type || "application/octet-stream",
        upsert: true,
      });
    if (attachmentError) {
      return json({ error: "failed to store attachment", detail: attachmentError }, 500);
    }
  }

  const { error: insertError } = await supabase.from("feedback_items").insert({
    id: payload.id,
    project_id: project.id,
    text: payload.text,
    screenshot_raw_path: rawPath,
    screenshot_annotated_path: annotatedPath,
    annotations: payload.annotations ?? [],
    environment: payload.environment ?? {},
    created_at: payload.created_at ?? new Date().toISOString(),
    attachment_path: attachmentPath,
    attachment_filename: attachmentPath ? payload.attachment_filename : null,
    attachment_mime_type: attachmentPath ? (payload.attachment_mime_type ?? null) : null,
  });

  if (insertError) {
    return json({ error: "failed to record feedback", detail: insertError.message }, 500);
  }

  return json({ id: payload.id }, 201);
});

// Keeps the original filename (for nicer downloads) while stripping
// anything that could be read as a path separator or otherwise escape the
// `{project_id}/{feedback_id}/attachment/` prefix it's uploaded under.
function sanitizeFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() || "attachment";
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-200);
}

function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
