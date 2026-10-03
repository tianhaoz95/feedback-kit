import type { DeliveryMode, FeedbackItem } from "@/lib/types";

/**
 * Fills a `{{placeholder}}` template with a feedback item's data. Deliberately
 * a plain find-and-replace rather than a templating library — the set of
 * placeholders is small and fixed, and keeping this trivial keeps the
 * template text itself (which developers edit directly) easy to read.
 */
export function formatProductsList(products?: FeedbackItem["products"]): string {
  if (!products || products.length === 0) {
    return "(none specified)";
  }
  return products
    .map((p) => {
      const desc = p.description ? `: ${p.description}` : "";
      return `- **${p.name || p.key}** (\`${p.key}\`)${desc}`;
    })
    .join("\n");
}

/** Recent console/network logs as a fenced block for a coding agent, newest last. */
export function formatConsoleLogs(logs?: FeedbackItem["logs"]): string {
  if (!logs || logs.length === 0) return "(none captured)";
  const lines = logs.map((l) => {
    const time = l.timestamp ? l.timestamp.slice(11, 19) : "";
    return `${time} [${l.level}] ${l.message}`;
  });
  return "```\n" + lines.join("\n") + "\n```";
}

function browserLabel(env: FeedbackItem["environment"]): string {
  if (env.browserName) return `${env.browserName} ${env.browserVersion ?? ""}`.trim();
  return env.deviceModel ?? "";
}

/**
 * Appended to a web report's prompt when the project's template predates the
 * web SDK (references none of its placeholders), so every existing project
 * gets the page URL and logs without having to edit its template first.
 */
function webContextSection(feedback: FeedbackItem): string {
  const env = feedback.environment;
  return [
    "## Web context",
    `- Page URL: ${env.pageUrl ?? "(unknown)"}`,
    `- Browser: ${browserLabel(env)}`,
    `- Viewport: ${env.screenWidthPoints}×${env.screenHeightPoints} @${env.screenScale}x`,
    "",
    "### Console & network log (most recent last)",
    formatConsoleLogs(feedback.logs),
  ].join("\n");
}

/**
 * Appended when a prompt is *copied* from the dashboard (never saved into
 * `edited_prompt`), mirroring cli/src/loop.ts `loopInstructions`: without the
 * report id a pasted prompt gives the agent no way to move the fix stage, so
 * the report would sit at "New" even after the fix lands.
 */
export function closingTheLoopSection(
  feedback: Pick<FeedbackItem, "id"> | Pick<FeedbackItem, "id">[],
  mode: DeliveryMode = "batch",
): string {
  const ids = (Array.isArray(feedback) ? feedback : [feedback]).map((item) => item.id);
  if (ids.length === 0) return "";
  const single = ids.length === 1;
  const idList = ids.map((id) => `\`${id}\``).join(", ");
  const claim = single
    ? `call \`claim_feedback\` with \`feedback_id: "${ids[0]}"\``
    : `call \`claim_feedback\` for each report (${idList})`;
  const trailers = ids.map((id) => `   \`FeedbackKit: ${id}\``).join("\n");
  return `

---
## Closing the loop (FeedbackKit ${single ? "report" : "reports"} ${idList})

1. If the FeedbackKit MCP server is connected, ${claim} before you start, so the team sees ${single ? "it's" : "they're"} being worked on.
${mode === "branch"
    ? `2. Open a pull request for the fix; don't push to the default branch. This project checks fixes on a preview build of the PR before merging. Put ${single ? "this line" : "one line per report you fixed"} in the PR description (and the fix commit's message):
${trailers}
3. Don't merge the PR or mark ${single ? "it" : "them"} resolved yourself: the PR's "FeedbackKit" check turns green once ${single ? "the fix is" : "the fixes are"} verified on the preview.`
    : `2. Add ${single ? "this trailer" : "one trailer per report you fixed"} to your fix commit's message (last paragraph, like \`Co-Authored-By\`) — when the commit reaches the default branch, FeedbackKit links it and ships it with the next beta build:
${trailers}
   If you open a pull request instead, put the same ${single ? "line" : "lines"} in its description. Without the GitHub App, call \`link_fix\` with the commit sha.
3. Don't mark ${single ? "it" : "them"} resolved yourself: once the fix ships in a build, the reporter confirms it on their device.`}
4. If you can run the fixed app, call \`attach_preview\` with a screenshot of the screen the reporter showed (and, with a caption, any capture that shows progress along the way), so the team can review it on the report without running the build.${single ? "" : `
   Post each \`attach_preview\` and \`post_update\` to the report it's about (its \`feedback_id\`), not all to the first one.`}`;
}

const WEB_PLACEHOLDERS = /{{\s*(page_url|console_logs|browser)\s*}}/;

/**
 * Appended when the report has an attachment but the template never mentions
 * `{{attachment_url}}` (the default one doesn't), so the agent still learns
 * the file exists and how to fetch it.
 */
function attachmentSection(feedback: FeedbackItem, attachmentUrl: string): string {
  const name = feedback.attachment_filename ? ` (\`${feedback.attachment_filename}\`)` : "";
  return [
    "## Attachment",
    `The reporter attached a file${name}. Download it from this signed link (no auth needed; it expires) and use it as context for the report: ${attachmentUrl}`,
  ].join("\n");
}

export function renderPromptTemplate(
  template: string,
  feedback: FeedbackItem,
  screenshotUrl: string | null,
  attachmentUrl: string | null,
): string {
  let rendered = template;
  if (!screenshotUrl) {
    rendered = rendered.replace(
      /(?:^|\n)##\s*Screenshot\s*\n[\s\S]*?(?=(?:\n##\s|$))/gi,
      "",
    );
  }

  const env = feedback.environment;
  const values: Record<string, string> = {
    feedback_text: feedback.text || "(no description provided)",
    screen_name: env.screenName ?? "(unknown)",
    os_name: env.osName ?? "",
    os_version: env.osVersion ?? "",
    device_model: env.deviceModel ?? "",
    app_version: env.appVersion ?? "",
    app_build: env.appBuild ?? "",
    locale: env.locale ?? "",
    screenshot_url: screenshotUrl ?? "",
    attachment_url: attachmentUrl ?? "(no attachment)",
    products: formatProductsList(feedback.products),
    platform: env.platform === "web" ? webPlatformLabel(env) : env.osName ?? "",
    page_url: env.pageUrl ?? "(not a web report)",
    browser: env.platform === "web" ? browserLabel(env) : "(not a web report)",
    console_logs: formatConsoleLogs(feedback.logs),
    // Lets a template ask for `FeedbackKit: {{feedback_id}}` in the PR description,
    // which is how the GitHub webhook links a PR back to the report (0014_closed_loop.sql).
    feedback_id: feedback.id,
  };

  if (attachmentUrl && !/{{\s*attachment_url\s*}}/.test(rendered)) {
    rendered = `${rendered.trimEnd()}\n\n${attachmentSection(feedback, attachmentUrl)}`;
  }

  if (env.platform === "web" && !WEB_PLACEHOLDERS.test(rendered)) {
    rendered = `${rendered.trimEnd()}\n\n${webContextSection(feedback)}`;
  }

  return rendered
    .replace(/{{\s*(\w+)\s*}}/g, (match, key: string) =>
      key in values ? values[key] : match,
    )
    .trim();
}

export const PROMPT_TEMPLATE_PLACEHOLDERS = [
  "feedback_id",
  "feedback_text",
  "screen_name",
  "os_name",
  "os_version",
  "device_model",
  "app_version",
  "app_build",
  "locale",
  "screenshot_url",
  "attachment_url",
  "products",
  "platform",
  "page_url",
  "browser",
  "console_logs",
] as const;

/**
 * Merges multiple feedback items into a single unified prompt for a coding agent.
 * This instructs the agent to solve all reported issues cohesively in a single pass,
 * avoiding git merge conflicts or redundant code passes across screens.
 */
export function renderMergedPrompt(
  items: FeedbackItem[],
  signedUrls: Record<string, { screenshot: string | null; attachment: string | null }>,
  templateText?: string,
): string {
  if (items.length === 0) return "";
  if (items.length === 1) {
    const item = items[0];
    const urls = signedUrls[item.id];
    return (
      item.edited_prompt ??
      renderPromptTemplate(
        templateText ?? "",
        item,
        urls?.screenshot ?? null,
        urls?.attachment ?? null
      )
    );
  }

  const header = `You are an expert software engineer addressing multiple user feedback reports for this app in a single pass.
Resolve all ${items.length} reported issues described below in a coordinated manner. By solving them together, ensure changes are cohesive, avoid git merge conflicts, and prevent regressions across shared files, state, or navigation flows.`;

  const summaryLines = items
    .map((item, idx) => {
      const screen = item.environment?.screenName ? `[${item.environment.screenName}] ` : "";
      const textSnippet = item.text
        ? item.text.length > 70
          ? `${item.text.slice(0, 67)}…`
          : item.text
        : "(no description)";
      return `${idx + 1}. ${screen}${textSnippet} (ID: \`${item.id}\`, Status: ${item.status})`;
    })
    .join("\n");

  const detailSections = items
    .map((item, idx) => {
      const env = item.environment || ({} as Partial<typeof item.environment>);
      const urls = signedUrls[item.id];
      const screenshot = urls?.screenshot
        ? urls.screenshot
        : item.screenshot_annotated_path
        ? "(Screenshot loading or available in dashboard)"
        : null;
      const screenshotLine = screenshot ? `\n- **Screenshot URL**: ${screenshot}` : "";
      const attachment = urls?.attachment
        ? `${item.attachment_filename || "Attachment"}: ${urls.attachment}`
        : "(No attachment)";
      const screen = env.screenName ? `[${env.screenName}] ` : "";
      const titleSnippet = item.text
        ? item.text.length > 60
          ? `${item.text.slice(0, 57)}…`
          : item.text
        : "Issue report";

      const customPromptSection = item.edited_prompt
        ? `\n- **Custom Prompt / Developer Notes**:\n\`\`\`markdown\n${item.edited_prompt}\n\`\`\``
        : "";

      const productsLine =
        item.products && item.products.length > 0
          ? `\n- **Affected Products**:\n${item.products
              .map(
                (p) =>
                  `  - **${p.name || p.key}** (\`${p.key}\`)${p.description ? `: ${p.description}` : ""}`,
              )
              .join("\n")}`
          : "";

      const webLines =
        env.platform === "web"
          ? `\n  - Page URL: ${env.pageUrl || "—"}\n  - Browser: ${browserLabel(env as FeedbackItem["environment"])}${
              item.logs && item.logs.length > 0
                ? `\n- **Console & network log**:\n${formatConsoleLogs(item.logs)}`
                : ""
            }`
          : "";

      return `### Issue ${idx + 1}: ${screen}${titleSnippet}
- **Report ID**: \`${item.id}\`
- **Screen**: ${env.screenName || "(unknown)"}
- **Status**: ${item.status}${productsLine}
- **User Description**:
${item.text ? `> ${item.text.split("\n").join("\n> ")}` : "*(No description provided)*"}
- **Environment**:
  - OS: ${env.osName || ""} ${env.osVersion || ""}
  - Device: ${env.deviceModel || "Unknown"}
  - App Version: ${env.appVersion || "—"} (${env.appBuild || "—"})
  - Locale: ${env.locale || "—"}${webLines}${screenshotLine}
- **Attachment**: ${attachment}${customPromptSection}`;
    })
    .join("\n\n---\n\n");

  const instructions = `## Coordinated Implementation Guidelines
1. **Analyze Shared Dependencies**: Review all ${items.length} issues above before modifying code. Identify any shared files, view models, database models, or theme variables.
2. **Coordinated Multi-Issue Fixes**: Implement the fixes cohesively so that resolving one issue does not cause conflicts, duplication, or regressions in another.
3. **Architecture & Styling Conventions**: Maintain existing project idioms and code style across Swift/SwiftUI/UIKit/AppKit and web front-end code.
4. **Verification**: Verify each modified screen or workflow and ensure all test suites pass.`;

  return `${header}

## Summary of Issues (${items.length} total)
${summaryLines}

---

## Issue Details

${detailSections}

---

${instructions}
`;
}

/** "Tauri app on Windows" for a desktop shell, "Web" for a browser tab. */
function webPlatformLabel(env: { runtime?: string; osName?: string }): string {
  if (!env.runtime) return "Web";
  const runtime = env.runtime === "tauri" ? "Tauri" : env.runtime === "electron" ? "Electron" : env.runtime;
  return env.osName ? `${runtime} app on ${env.osName}` : `${runtime} app`;
}
