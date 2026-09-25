import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/http.ts";
import {
  getInstallationIdForRepo,
  getInstallationToken,
  uploadScreenshotToRepo,
  createGitHubIssue,
  dispatchIssueToAgent,
  getProjectInstallationToken,
} from "../_shared/github.ts";

interface RequestBody {
  project_id: string;
  feedback_id: string;
  /**
   * Hand the issue to the project's configured coding agent
   * (`projects.dispatch_labels` / `dispatch_comment`, 0014_closed_loop.sql).
   * Default true. On an already-linked item, `true` re-dispatches it.
   */
  dispatch?: boolean;
}

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

    const { project_id, feedback_id } = body;
    const shouldDispatch = body.dispatch !== false;
    if (!project_id || !feedback_id) {
      return json({ error: "missing_fields", message: "project_id and feedback_id are required" }, 400);
    }

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

    // 3. Fetch feedback item
    const { data: feedback, error: fbError } = await userClient
      .from("feedback_items")
      .select("*")
      .eq("id", feedback_id)
      .eq("project_id", project_id)
      .single();

    if (fbError || !feedback) {
      return json({ error: "feedback_not_found", message: "Feedback item not found" }, 404);
    }

    // Admin client for backend updates (writing issue number/url, downloading storage)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // If already linked, return the existing issue — re-dispatching it to the
    // agent only when explicitly asked (`dispatch: true`).
    if (feedback.github_issue_url) {
      let dispatched = null;
      if (body.dispatch === true && feedback.github_issue_number) {
        const token = await getProjectInstallationToken(adminClient, project);
        if (token) {
          dispatched = await dispatchIssueToAgent(token, project.github_repo, feedback.github_issue_number, project);
          if (dispatched) await recordDispatch(userClient, user.id, feedback, dispatched, feedback.github_issue_url);
        }
      }
      return json(
        {
          success: true,
          issue_url: feedback.github_issue_url,
          issue_number: feedback.github_issue_number,
          already_linked: true,
          dispatched,
        },
        200
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

    // 6. Handle screenshot
    let screenshotMd = "*(No screenshot included)*";
    if (feedback.screenshot_annotated_path) {
      try {
        const { data: fileData, error: dlErr } = await adminClient.storage
          .from("feedback-screenshots")
          .download(feedback.screenshot_annotated_path);

        if (!dlErr && fileData) {
          const bytes = new Uint8Array(await fileData.arrayBuffer());
          const repoAssetUrl = await uploadScreenshotToRepo(tokenInstall, owner, repo, feedback.id, bytes);
          if (repoAssetUrl) {
            screenshotMd = `![Feedback Screenshot](${repoAssetUrl})`;
          } else {
            // Fallback to 7-day signed URL
            const { data: signed } = await adminClient.storage
              .from("feedback-screenshots")
              .createSignedUrl(feedback.screenshot_annotated_path, 60 * 60 * 24 * 7);
            if (signed?.signedUrl) {
              screenshotMd = `![Feedback Screenshot](${signed.signedUrl})\n*(Signed URL valid for 7 days)*`;
            }
          }
        }
      } catch (e) {
        console.warn("Screenshot handling error:", e);
      }
    }

    // 7. Get coding-agent prompt
    let promptText = feedback.edited_prompt;
    const productsFormatted =
      Array.isArray(feedback.products) && feedback.products.length > 0
        ? feedback.products
            .map((p: { name?: string; key: string; description?: string }) => {
              const desc = p.description ? `: ${p.description}` : "";
              return `- **${p.name || p.key}** (\`${p.key}\`)${desc}`;
            })
            .join("\n")
        : "(none specified)";

    if (!promptText) {
      const { data: tmpl } = await userClient
        .from("prompt_templates")
        .select("template_text")
        .eq("project_id", project_id)
        .single();

      promptText =
        tmpl?.template_text ||
        `Fix the issue reported on the ${feedback.environment?.screenName || "app"} screen:\n\n${feedback.text}`;
    }

    if (promptText) {
      promptText = promptText.replace(/{{\s*products\s*}}/g, productsFormatted);
    }

    // 8. Construct issue content
    const env = feedback.environment || {};
    const screenName = env.screenName ? `[${env.screenName}] ` : "";
    const title = `[Feedback] ${screenName}${
      feedback.text
        ? feedback.text.length > 60
          ? feedback.text.slice(0, 57) + "..."
          : feedback.text
        : "New bug report"
    }`;

    let productsMd = "";
    if (Array.isArray(feedback.products) && feedback.products.length > 0) {
      productsMd = `\n## Affected Products\n${productsFormatted}\n`;
    }

    let attachmentMd = "";
    if (feedback.attachment_path) {
      const { data: signedAtt } = await adminClient.storage
        .from("feedback-screenshots")
        .createSignedUrl(feedback.attachment_path, 60 * 60 * 24 * 7);
      if (signedAtt?.signedUrl) {
        attachmentMd = `\n## Attachment\n[${feedback.attachment_filename || "Download Attachment"}](${signedAtt.signedUrl})\n`;
      }
    }

    const screenshotSection = screenshotMd ? `\n## Screenshot\n${screenshotMd}\n` : "";

    // Web SDK reports (environment.platform === "web", see 0013_web_sdk.sql)
    // carry the page URL, browser and recent console/network logs.
    const isWeb = env.platform === "web";
    const webRows = isWeb
      ? `| **Page URL** | ${env.pageUrl || "—"} |
| **Browser** | ${env.browserName ? `${env.browserName} ${env.browserVersion || ""}` : env.deviceModel || "—"} |
`
      : "";
    const logs = Array.isArray(feedback.logs) ? feedback.logs : [];
    const logsMd = logs.length > 0
      ? `
<details>
<summary><b>Console &amp; network log</b> (${logs.length} entries)</summary>

\`\`\`
${logs.map((l: { level?: string; message?: string; timestamp?: string }) => `${(l.timestamp || "").slice(11, 19)} [${l.level}] ${l.message}`).join("\n")}
\`\`\`

</details>
`
      : "";

    const issueBody = `## Description
${feedback.text || "*(No description provided)*"}
${productsMd}${screenshotSection}
## Environment
| Spec | Value |
|---|---|
| **Screen** | ${env.screenName || "—"} |
${webRows}| **OS** | ${env.osName || ""} ${env.osVersion || ""} |
| **Device** | ${env.deviceModel || "—"} |
| **App Version** | ${env.appVersion || "—"} (${env.appBuild || ""}) |
| **Locale** | ${env.locale || "—"} |
| **${isWeb ? "Viewport" : "Screen Size"}** | ${env.screenWidthPoints || ""}×${env.screenHeightPoints || ""} @${env.screenScale || 1}x |
| **Reported At** | ${new Date(feedback.created_at).toUTCString()} |
${attachmentMd}${logsMd}
<details>
<summary><b>🤖 Coding Agent Prompt</b> (click to expand)</summary>

\`\`\`markdown
${promptText}
\`\`\`

</details>

## Closing the loop
When you open a pull request for this, include this line in its description so FeedbackKit can track the fix through to the reporter's device:

\`\`\`
FeedbackKit: ${feedback.id}
\`\`\`

---
*Logged via [FeedbackKit](https://feedback-kit.hejitech.workers.dev/) from report \`${feedback.id}\`*`;

    // 9. Create GitHub issue
    let issue: { number: number; html_url: string };
    try {
      issue = await createGitHubIssue(tokenInstall, owner, repo, title, issueBody);
    } catch (err) {
      return json({ error: "github_issue_creation_failed", message: String(err) }, 502);
    }

    // 10. Update feedback item in database
    await adminClient
      .from("feedback_items")
      .update({
        github_issue_url: issue.html_url,
        github_issue_number: issue.number,
        status: feedback.status === "new" ? "in_progress" : feedback.status,
      })
      .eq("id", feedback.id);

    let dispatched = null;
    if (shouldDispatch) {
      dispatched = await dispatchIssueToAgent(tokenInstall, project.github_repo, issue.number, project);
      if (dispatched) await recordDispatch(userClient, user.id, feedback, dispatched, issue.html_url);
    }

    return json(
      {
        success: true,
        issue_url: issue.html_url,
        issue_number: issue.number,
        dispatched,
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

/** Timeline entry for a dispatch, written as the calling user (RLS applies). */
async function recordDispatch(
  // deno-lint-ignore no-explicit-any
  userClient: any,
  userId: string,
  feedback: { id: string; project_id: string },
  dispatched: { labels: string[]; commented: boolean },
  issueUrl: string,
) {
  const how = [
    dispatched.labels.length > 0 ? `labeled ${dispatched.labels.map((l) => `\`${l}\``).join(", ")}` : null,
    dispatched.commented ? "posted the trigger comment" : null,
  ]
    .filter(Boolean)
    .join(" and ");
  const { error } = await userClient.from("feedback_events").insert({
    feedback_id: feedback.id,
    project_id: feedback.project_id,
    kind: "dispatched",
    actor_type: "user",
    actor_user_id: userId,
    actor_label: "Dashboard",
    body: `Sent to the coding agent via GitHub (${how || "no trigger configured"}).`,
    data: { ...dispatched, issue_url: issueUrl },
  });
  if (error) console.warn("Failed to record dispatch event:", error.message);
  await userClient.from("feedback_items").update({ fix_stage: "agent_working" }).eq("id", feedback.id).is("fix_stage", null);
}
