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
  screenshot_raw_png_base64: string;
  screenshot_annotated_png_base64: string;
  annotations: unknown;
  environment: Record<string, unknown>;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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

  const rawPath = `${project.id}/${payload.id}/raw.png`;
  const annotatedPath = `${project.id}/${payload.id}/annotated.png`;

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

  const { error: insertError } = await supabase.from("feedback_items").insert({
    id: payload.id,
    project_id: project.id,
    text: payload.text,
    screenshot_raw_path: rawPath,
    screenshot_annotated_path: annotatedPath,
    annotations: payload.annotations ?? [],
    environment: payload.environment ?? {},
    created_at: payload.created_at ?? new Date().toISOString(),
  });

  if (insertError) {
    return json({ error: "failed to record feedback", detail: insertError.message }, 500);
  }

  return json({ id: payload.id }, 201);
});

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
