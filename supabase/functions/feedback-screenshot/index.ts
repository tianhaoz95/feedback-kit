import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/http.ts";
import { verifyScreenshotToken } from "../_shared/screenshotToken.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const feedbackId = url.searchParams.get("id");
  const token = url.searchParams.get("token");

  if (!feedbackId || !token) {
    return new Response("Missing id or token parameter", { status: 400, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return new Response("Server configuration error", { status: 500, headers: corsHeaders });
  }

  const isValid = await verifyScreenshotToken(feedbackId, token, supabaseServiceKey);
  if (!isValid) {
    return new Response("Invalid or unauthorized screenshot token", { status: 403, headers: corsHeaders });
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceKey);

  const { data: feedback, error: dbError } = await adminClient
    .from("feedback_items")
    .select("screenshot_annotated_path, screenshot_raw_path")
    .eq("id", feedbackId)
    .maybeSingle();

  if (dbError || !feedback) {
    return new Response("Feedback report not found", { status: 404, headers: corsHeaders });
  }

  const screenshotPath = feedback.screenshot_annotated_path || feedback.screenshot_raw_path;
  if (!screenshotPath) {
    return new Response("No screenshot available for this report", { status: 404, headers: corsHeaders });
  }

  const { data: fileData, error: dlErr } = await adminClient.storage
    .from("feedback-screenshots")
    .download(screenshotPath);

  if (dlErr || !fileData) {
    console.error("Storage download error:", dlErr);
    return new Response("Screenshot could not be retrieved", { status: 502, headers: corsHeaders });
  }

  return new Response(req.method === "HEAD" ? null : fileData, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
});
