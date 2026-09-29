import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/http.ts";
import { renderPromptTemplate } from "../_shared/promptTemplate.ts";
import {
  batchIssueBody,
  batchIssueTitle,
  issueTitle,
  MAX_BATCH_REPORTS,
  type ReportAssets,
  singleIssueBody,
} from "../_shared/issueBody.ts";
import {
  getInstallationIdForRepo,
  getInstallationToken,
  uploadScreenshotToRepo,
  createGitHubIssue,
  dispatchIssueToAgent,
  getProjectInstallationToken,
  getGitHubUserToken,
  copilotInstructions,
} from "../_shared/github.ts";

interface RequestBody {
  project_id: string;
  feedback_id?: string;
  /**
   * Several reports merged in the dashboard (MergedPromptView): one issue for
   * all of them, dispatched once, with a `FeedbackKit: <id>` line per report
   * so github-webhook moves each through the loop. Takes the place of
   * `feedback_id`.
   */
  feedback_ids?: string[];
  /** A batch's merged prompt as edited in the dashboard; generated when absent. */
  prompt?: string;
  /**
   * Hand the issue to the project's configured coding agent
   * (`projects.dispatch_labels` / `dispatch_comment`, 0014_closed_loop.sql).
   * Default true. On an already-linked item, `true` re-dispatches it.
   */
  dispatch?: boolean;
}

const MAX_PROMPT_CHARS = 20_000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return json({ error: "method_not_allowed" }, 405);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "missing_auth", message: "Authorization header required" }, 401);
    }

    let body: RequestBody;
    try {
      body = await req.json();
    } catch {
      return json({ error: "invalid_json_body" }, 400);
    }

    const { project_id } = body;
    const shouldDispatch = body.dispatch !== false;
    const feedbackIds = Array.isArray(body.feedback_ids)
      ? Array.from(new Set(body.feedback_ids.filter((id) => typeof id === "string" && id.length > 0)))
      : body.feedback_id
      ? [body.feedback_id]
      : [];
    if (!project_id || feedbackIds.length === 0) {
      return json({ error: "missing_fields", message: "project_id and feedback_id (or feedback_ids) are required" }, 400);
    }
    if (feedbackIds.length > MAX_BATCH_REPORTS) {
      return json(
        { error: "too_many_reports", message: `One issue can hold at most ${MAX_BATCH_REPORTS} reports.` },
        400,
      );
    }
    const isBatch = feedbackIds.length > 1;
    const promptOverride = isBatch && typeof body.prompt === "string" ? body.prompt.slice(0, MAX_PROMPT_CHARS) : null;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 1. Client with caller's JWT to enforce RLS organization membership
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: { user }, error: userError } = await userClient.auth.getUser(token);
    if (userError || !user) {
      return json({ error: "unauthorized", message: "Invalid or expired session" }, 401);
    }

    // 2. Fetch project (scoped by RLS)
    const { data: project, error: projError } = await userClient
      .from("projects")
      .select("*")
      .eq("id", project_id)
      .single();

    if (projError || !project) {
      return json({ error: "project_not_found", message: "Project not found or access denied" }, 404);
    }

    // Check if project has GitHub repository connected
    if (!project.github_repo || !project.github_repo.includes("/")) {
      return json(
        {
          error: "github_repo_not_configured",
          message: "This project has no GitHub repository connected. Connect one in the Settings tab.",
        },
        400
      );
    }

    // 3. Fetch the feedback items, in the order they were given
    const { data: rows, error: fbError } = await userClient
      .from("feedback_items")
      .select("*")
      .in("id", feedbackIds)
      .eq("project_id", project_id);

    // deno-lint-ignore no-explicit-any
    const byId = new Map<string, any>((rows ?? []).map((row: { id: string }) => [row.id, row]));
    if (fbError || feedbackIds.some((id) => !byId.has(id))) {
      return json(
        { error: "feedback_not_found", message: isBatch ? "One or more feedback items weren't found" : "Feedback item not found" },
        404,
      );
    }
    const items = feedbackIds.map((id) => byId.get(id));

    // Admin client for backend updates (writing issue number/url, downloading storage)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Copilot only accepts the assignment as the member pressing the button
    // (0018_copilot_dispatch.sql); without a connected account the issue is
    // still created and labeled, and the response says why Copilot wasn't.
    let copilot: { userToken: string; instructions: string } | null = null;
    let copilotError: string | null = null;
    if (project.dispatch_copilot && body.dispatch !== false) {
      const userToken = await getGitHubUserToken(adminClient, user.id);
      if (userToken) copilot = { userToken, instructions: copilotInstructions(feedbackIds) };
      else copilotError = "github_user_not_connected";
    }

    // If already linked, return the existing issue — re-dispatching it to the
    // agent only when explicitly asked (`dispatch: true`). A batch counts as
    // linked only when every report is on the same issue (the batch was sent
    // before); a mix would need a report in two issues, so it's refused.
    const linked = items.filter((item) => item.github_issue_url);
    const linkedNumbers = new Set(linked.map((item) => item.github_issue_number));
    if (linked.length === items.length && linkedNumbers.size === 1) {
      const existing = items[0];
      let dispatched = null;
      if (body.dispatch === true && existing.github_issue_number) {
        const token = await getProjectInstallationToken(adminClient, project);
        if (token) {
          dispatched = await dispatchIssueToAgent(token, project.github_repo, existing.github_issue_number, project, undefined, copilot);
          if (dispatched) {
            for (const item of items) await recordDispatch(userClient, user.id, item, dispatched, existing.github_issue_url, feedbackIds);
          }
        }
      }
      return json(
        {
          success: true,
          issue_url: existing.github_issue_url,
          issue_number: existing.github_issue_number,
          feedback_ids: feedbackIds,
          already_linked: true,
          dispatched,
          copilot_error: copilotError,
        },
        200
      );
    }
    if (linked.length > 0) {
      return json(
        {
          error: "already_linked",
          message: `${linked.length} of the selected reports already ${linked.length === 1 ? "has a GitHub issue" : "have GitHub issues"}. Remove ${linked.length === 1 ? "it" : "them"} from the selection to open one issue for the rest.`,
          linked_feedback_ids: linked.map((item) => item.id),
        },
        409,
      );
    }

    const [owner, repo] = project.github_repo.split("/");

    // 4. Resolve installation ID
    let installationId = project.github_installation_id;
    if (!installationId) {
      const discoveredId = await getInstallationIdForRepo(owner, repo);
      if (!discoveredId) {
        return json(
          {
            error: "github_app_not_installed",
            message: `The FeedbackKit GitHub App is not installed on repository ${project.github_repo}. Please install it first.`,
            install_url: "https://github.com/apps/feedbackkit-app/installations/new",
          },
          400
        );
      }
      installationId = discoveredId;
      await adminClient
        .from("projects")
        .update({ github_installation_id: installationId })
        .eq("id", project_id);
    }

    // 5. Get installation token
    const tokenInstall = await getInstallationToken(installationId);
    if (!tokenInstall) {
      return json({ error: "github_auth_failed", message: "Could not authenticate with GitHub App." }, 500);
    }

    // 6. Screenshot, attachment and coding-agent prompt for each report: the
    // prompt edited in the dashboard, else the project's template filled with
    // that report (not the raw template).
    const { data: tmpl } = await userClient
      .from("prompt_templates")
      .select("template_text")
      .eq("project_id", project_id)
      .single();
    const templateText: string =
      tmpl?.template_text || `Fix the issue reported on the {{screen_name}} screen:\n\n{{feedback_text}}`;

    const reports: ReportAssets[] = [];
    for (const feedback of items) {
      const { screenshotMd, screenshotUrl } = await resolveScreenshot(adminClient, tokenInstall, owner, repo, feedback);
      let attachmentUrl: string | null = null;
      if (feedback.attachment_path) {
        const { data: signedAtt } = await adminClient.storage
          .from("feedback-screenshots")
          .createSignedUrl(feedback.attachment_path, 60 * 60 * 24 * 7);
        attachmentUrl = signedAtt?.signedUrl ?? null;
      }
      const promptText = renderPromptTemplate(feedback.edited_prompt || templateText, feedback, screenshotUrl, attachmentUrl);
      reports.push({ feedback, screenshotMd, attachmentUrl, promptText });
    }

    // 7. Construct issue content
    const title = isBatch ? batchIssueTitle(items) : issueTitle(items[0]);
    const issueBody = isBatch
      ? batchIssueBody(reports, project.delivery_mode, promptOverride)
      : singleIssueBody(reports[0], project.delivery_mode);

    // 8. Create GitHub issue
    let issue: { number: number; html_url: string };
    try {
      issue = await createGitHubIssue(tokenInstall, owner, repo, title, issueBody);
    } catch (err) {
      return json({ error: "github_issue_creation_failed", message: String(err) }, 502);
    }

    // 9. Link every report to the issue
    await adminClient
      .from("feedback_items")
      .update({ github_issue_url: issue.html_url, github_issue_number: issue.number })
      .in("id", feedbackIds);
    await adminClient
      .from("feedback_items")
      .update({ status: "in_progress" })
      .in("id", feedbackIds)
      .eq("status", "new");

    let dispatched = null;
    if (shouldDispatch) {
      dispatched = await dispatchIssueToAgent(tokenInstall, project.github_repo, issue.number, project, undefined, copilot);
      if (dispatched) {
        for (const item of items) await recordDispatch(userClient, user.id, item, dispatched, issue.html_url, feedbackIds);
      }
    }

    return json(
      {
        success: true,
        issue_url: issue.html_url,
        issue_number: issue.number,
        feedback_ids: feedbackIds,
        dispatched,
        copilot_error: copilotError,
      },
      201
    );
  } catch (err) {
    console.error("create-github-issue error:", err);
    return json(
      {
        error: "internal_error",
        message: err instanceof Error ? err.message : String(err),
      },
      500
    );
  }
});

/**
 * The annotated screenshot, committed to the repo so the link lasts; a 7-day
 * signed URL if that fails.
 */
async function resolveScreenshot(
  // deno-lint-ignore no-explicit-any
  adminClient: any,
  tokenInstall: string,
  owner: string,
  repo: string,
  feedback: { id: string; screenshot_annotated_path?: string | null },
): Promise<{ screenshotMd: string; screenshotUrl: string | null }> {
  let screenshotMd = "*(No screenshot included)*";
  let screenshotUrl: string | null = null;
  if (!feedback.screenshot_annotated_path) return { screenshotMd, screenshotUrl };
  try {
    const { data: fileData, error: dlErr } = await adminClient.storage
      .from("feedback-screenshots")
      .download(feedback.screenshot_annotated_path);

    if (!dlErr && fileData) {
      const bytes = new Uint8Array(await fileData.arrayBuffer());
      const repoAssetUrl = await uploadScreenshotToRepo(tokenInstall, owner, repo, feedback.id, bytes);
      if (repoAssetUrl) {
        screenshotUrl = repoAssetUrl;
        screenshotMd = `![Feedback Screenshot](${repoAssetUrl})`;
      } else {
        // Fallback to 7-day signed URL
        const { data: signed } = await adminClient.storage
          .from("feedback-screenshots")
          .createSignedUrl(feedback.screenshot_annotated_path, 60 * 60 * 24 * 7);
        if (signed?.signedUrl) {
          screenshotUrl = signed.signedUrl;
          screenshotMd = `![Feedback Screenshot](${signed.signedUrl})\n*(Signed URL valid for 7 days)*`;
        }
      }
    }
  } catch (e) {
    console.warn("Screenshot handling error:", e);
  }
  return { screenshotMd, screenshotUrl };
}

/** Timeline entry for a dispatch, written as the calling user (RLS applies). */
async function recordDispatch(
  // deno-lint-ignore no-explicit-any
  userClient: any,
  userId: string,
  feedback: { id: string; project_id: string },
  dispatched: { labels: string[]; commented: boolean; copilot: boolean },
  issueUrl: string,
  batchIds: string[],
) {
  const how = [
    dispatched.labels.length > 0 ? `labeled ${dispatched.labels.map((l) => `\`${l}\``).join(", ")}` : null,
    dispatched.commented ? "posted the trigger comment" : null,
    dispatched.copilot ? "assigned Copilot" : null,
  ]
    .filter(Boolean)
    .join(" and ");
  const others = batchIds.length - 1;
  const { error } = await userClient.from("feedback_events").insert({
    feedback_id: feedback.id,
    project_id: feedback.project_id,
    kind: "dispatched",
    actor_type: "user",
    actor_user_id: userId,
    actor_label: "Dashboard",
    body: others > 0
      ? `Sent to the coding agent via GitHub together with ${others} other ${others === 1 ? "report" : "reports"} (${how || "no trigger configured"}).`
      : `Sent to the coding agent via GitHub (${how || "no trigger configured"}).`,
    data: { ...dispatched, issue_url: issueUrl, ...(others > 0 ? { batch_feedback_ids: batchIds } : {}) },
  });
  if (error) console.warn("Failed to record dispatch event:", error.message);
  await userClient.from("feedback_items").update({ fix_stage: "agent_working" }).eq("id", feedback.id).is("fix_stage", null);
}
