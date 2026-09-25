import type { FeedbackItem } from "./types.js";

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

// Appended to web reports when the template uses none of the web
// placeholders — same rule as web/src/lib/prompt-template.ts.
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

const WEB_PLACEHOLDERS = /{{\s*(page_url|console_logs|browser)\s*}}/;

// Ported from web/src/lib/prompt-template.ts — must be kept in sync by hand
// (same plain find-and-replace approach, deliberately not a templating
// library; see that file's comment for why).
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
    platform: env.platform === "web" ? "Web" : env.osName ?? "",
    page_url: env.pageUrl ?? "(not a web report)",
    browser: env.platform === "web" ? browserLabel(env) : "(not a web report)",
    console_logs: formatConsoleLogs(feedback.logs),
    // Lets a template ask for `FeedbackKit: {{feedback_id}}` in the PR description,
    // which is how the GitHub webhook links a PR back to the report (0014_closed_loop.sql).
    feedback_id: feedback.id,
  };

  if (env.platform === "web" && !WEB_PLACEHOLDERS.test(rendered)) {
    rendered = `${rendered.trimEnd()}\n\n${webContextSection(feedback)}`;
  }

  return rendered
    .replace(/{{\s*(\w+)\s*}}/g, (match, key: string) =>
      key in values ? values[key] : match,
    )
    .trim();
}
