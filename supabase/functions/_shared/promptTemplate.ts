// Fills a project's prompt template for the GitHub issue create-github-issue
// opens. Ported from cli/src/promptTemplate.ts (itself a port of
// web/src/lib/prompt-template.ts) — keep all three in sync by hand, same
// plain find-and-replace approach.

// deno-lint-ignore no-explicit-any
type Feedback = any;

export function formatProductsList(products?: { name?: string; key: string; description?: string }[]): string {
  if (!Array.isArray(products) || products.length === 0) return "(none specified)";
  return products
    .map((p) => `- **${p.name || p.key}** (\`${p.key}\`)${p.description ? `: ${p.description}` : ""}`)
    .join("\n");
}

function formatConsoleLogs(logs?: { level?: string; message?: string; timestamp?: string }[]): string {
  if (!Array.isArray(logs) || logs.length === 0) return "(none captured)";
  return "```\n" + logs.map((l) => `${(l.timestamp ?? "").slice(11, 19)} [${l.level}] ${l.message}`).join("\n") + "\n```";
}

// deno-lint-ignore no-explicit-any
function browserLabel(env: any): string {
  if (env.browserName) return `${env.browserName} ${env.browserVersion ?? ""}`.trim();
  return env.deviceModel ?? "";
}

const WEB_PLACEHOLDERS = /{{\s*(page_url|console_logs|browser)\s*}}/;

export function renderPromptTemplate(
  template: string,
  feedback: Feedback,
  screenshotUrl: string | null,
  attachmentUrl: string | null,
): string {
  let rendered = template;
  if (!screenshotUrl) {
    rendered = rendered.replace(/(?:^|\n)##\s*Screenshot\s*\n[\s\S]*?(?=(?:\n##\s|$))/gi, "");
  }

  const env = feedback.environment ?? {};
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
    feedback_id: feedback.id,
  };

  // Same rule as web/src/lib/prompt-template.ts: the default template never
  // mentions the attachment, so say it exists and how to fetch it.
  if (attachmentUrl && !/{{\s*attachment_url\s*}}/.test(rendered)) {
    const name = feedback.attachment_filename ? ` (\`${feedback.attachment_filename}\`)` : "";
    rendered = [
      rendered.trimEnd(),
      "",
      "## Attachment",
      `The reporter attached a file${name}. Download it from this signed link (no auth needed; it expires) and use it as context for the report: ${attachmentUrl}`,
    ].join("\n");
  }

  if (env.platform === "web" && !WEB_PLACEHOLDERS.test(rendered)) {
    rendered = [
      rendered.trimEnd(),
      "",
      "## Web context",
      `- Page URL: ${env.pageUrl ?? "(unknown)"}`,
      `- Browser: ${browserLabel(env)}`,
      `- Viewport: ${env.screenWidthPoints}×${env.screenHeightPoints} @${env.screenScale}x`,
      "",
      "### Console & network log (most recent last)",
      formatConsoleLogs(feedback.logs),
    ].join("\n");
  }

  return rendered.replace(/{{\s*(\w+)\s*}}/g, (match, key: string) => (key in values ? values[key] : match)).trim();
}

/** "Tauri app on Windows" for a desktop shell, "Web" for a browser tab. */
function webPlatformLabel(env: { runtime?: string; osName?: string }): string {
  if (!env.runtime) return "Web";
  const runtime = env.runtime === "tauri" ? "Tauri" : env.runtime === "electron" ? "Electron" : env.runtime;
  return env.osName ? `${runtime} app on ${env.osName}` : `${runtime} app`;
}
