import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/http.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const event = req.headers.get("x-github-event");
  if (!event) {
    return json({ error: "missing_event_header" }, 400);
  }

  // Only handle issue events for now
  if (event !== "issues") {
    return json({ status: "ignored_event", event }, 200);
  }

  let payload: Record<string, any>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid_json_body" }, 400);
  }

  const { action, issue, repository } = payload;
  if (!action || !issue) {
    return json({ error: "invalid_payload" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, supabaseServiceKey);

  const issueUrl = issue.html_url;
  const issueNumber = issue.number;

  if (action === "closed") {
    // Automatically mark matching feedback as resolved
    const { data, error } = await adminClient
      .from("feedback_items")
      .update({ status: "resolved" })
      .or(`github_issue_url.eq.${issueUrl},github_issue_number.eq.${issueNumber}`);

    return json({ status: "resolved_sync", issue_number: issueNumber }, 200);
  } else if (action === "reopened") {
    // Reopen as in_progress
    const { data, error } = await adminClient
      .from("feedback_items")
      .update({ status: "in_progress" })
      .or(`github_issue_url.eq.${issueUrl},github_issue_number.eq.${issueNumber}`);

    return json({ status: "reopened_sync", issue_number: issueNumber }, 200);
  }

  return json({ status: "unhandled_action", action }, 200);
});
