// Title and body of the GitHub issue create-github-issue opens — for one
// report, or for a batch merged in the dashboard (MergedPromptView). Pure
// string building so it can be tested without GitHub or storage.
//
// Every report in the issue gets its own `FeedbackKit: <id>` line in
// "Closing the loop": github-webhook links a PR or commit to each id it
// names (and to every report on the issue for `Fixes #n`), so one issue and
// one PR carry a whole batch through merged → shipped → verified.

import { formatProductsList } from "./promptTemplate.ts";

// deno-lint-ignore no-explicit-any
type Feedback = any;

/** What was resolved for one report before building the body. */
export interface ReportAssets {
  feedback: Feedback;
  /** Markdown for the screenshot (image, signed-URL fallback, or "none"). */
  screenshotMd: string;
  attachmentUrl: string | null;
  /** The report's coding-agent prompt: its edited prompt, else the project template filled in. */
  promptText: string;
}

/** Most reports a batch issue takes: GitHub caps an issue body at 65,536 characters. */
export const MAX_BATCH_REPORTS = 20;
/** In a batch, only the newest log lines per report, so the body stays under GitHub's cap. */
const BATCH_LOG_LINES = 40;
const BATCH_LOG_LINE_CHARS = 300;
const MAX_ISSUE_BODY = 65_000;

function snippet(text: string | null | undefined, max: number): string | null {
  if (!text) return null;
  return text.length > max ? text.slice(0, max - 3) + "..." : text;
}

function screenPrefix(feedback: Feedback): string {
  const screenName = feedback.environment?.screenName;
  return screenName ? `[${screenName}] ` : "";
}

export function issueTitle(feedback: Feedback): string {
  return `[Feedback] ${screenPrefix(feedback)}${snippet(feedback.text, 60) ?? "New bug report"}`;
}

export function batchIssueTitle(items: Feedback[]): string {
  const first = snippet(items[0]?.text, 50) ?? "bug report";
  return `[Feedback] ${items.length} reports: ${screenPrefix(items[0])}${first} (+${items.length - 1} more)`;
}

type LogLine = { level?: string; message?: string; timestamp?: string };

function logsDetails(feedback: Feedback, limit?: number): string {
  const all: LogLine[] = Array.isArray(feedback.logs) ? feedback.logs : [];
  if (all.length === 0) return "";
  const shown = limit ? all.slice(-limit) : all;
  const line = (l: LogLine) => {
    const text = `${(l.timestamp || "").slice(11, 19)} [${l.level}] ${l.message}`;
    return limit && text.length > BATCH_LOG_LINE_CHARS ? text.slice(0, BATCH_LOG_LINE_CHARS - 1) + "…" : text;
  };
  const count = shown.length < all.length ? `last ${shown.length} of ${all.length} entries` : `${all.length} entries`;
  return `
<details>
<summary><b>Console &amp; network log</b> (${count})</summary>

\`\`\`
${shown.map(line).join("\n")}
\`\`\`

</details>
`;
}

/** The environment table, with the web rows for web SDK reports (0013_web_sdk.sql). */
function environmentTable(feedback: Feedback): string {
  const env = feedback.environment || {};
  const isWeb = env.platform === "web";
  const webRows = isWeb
    ? `| **Page URL** | ${env.pageUrl || "—"} |
| **Browser** | ${env.browserName ? `${env.browserName} ${env.browserVersion || ""}` : env.deviceModel || "—"} |
`
    : "";
  return `| Spec | Value |
|---|---|
| **Screen** | ${env.screenName || "—"} |
${webRows}| **OS** | ${env.osName || ""} ${env.osVersion || ""} |
| **Device** | ${env.deviceModel || "—"} |
| **App Version** | ${env.appVersion || "—"} (${env.appBuild || ""}) |
| **Locale** | ${env.locale || "—"} |
| **${isWeb ? "Viewport" : "Screen Size"}** | ${env.screenWidthPoints || ""}×${env.screenHeightPoints || ""} @${env.screenScale || 1}x |
| **Reported At** | ${new Date(feedback.created_at).toUTCString()} |
`;
}

function productsSection(feedback: Feedback, heading: string): string {
  if (!Array.isArray(feedback.products) || feedback.products.length === 0) return "";
  return `\n${heading} Affected Products\n${formatProductsList(feedback.products)}\n`;
}

function attachmentSection(assets: ReportAssets, heading: string): string {
  if (!assets.attachmentUrl) return "";
  return `\n${heading} Attachment\n[${assets.feedback.attachment_filename || "Download Attachment"}](${assets.attachmentUrl})\n`;
}

function promptDetails(summary: string, promptText: string): string {
  return `<details>
<summary><b>${summary}</b> (click to expand)</summary>

\`\`\`markdown
${promptText}
\`\`\`

</details>`;
}

export function closingTheLoopSection(ids: string[], deliveryMode: string | null | undefined): string {
  const single = ids.length === 1;
  const intro = deliveryMode === "branch"
    ? single
      ? "Open a pull request for the fix (don't push to the default branch) and put this line in its description. The PR is merged once the fix is verified on a preview build:"
      : "Open one pull request that fixes these reports (don't push to the default branch) and put one line per report you fixed in its description. The PR is merged once the fixes are verified on a preview build:"
    : single
    ? "Add this trailer to the fix commit's message (or, if you open a pull request, its description) so FeedbackKit can track the fix through the next beta build to the reporter's device:"
    : "Add one trailer per report you fixed to the fix commit's message (or, if you open a pull request, its description) so FeedbackKit can track each fix through the next beta build to its reporter's device:";
  return `## Closing the loop
${intro}

\`\`\`
${ids.map((id) => `FeedbackKit: ${id}`).join("\n")}
\`\`\``;
}

export function singleIssueBody(assets: ReportAssets, deliveryMode: string | null | undefined): string {
  const { feedback } = assets;
  const screenshotSection = assets.screenshotMd ? `\n## Screenshot\n${assets.screenshotMd}\n` : "";
  return `## Description
${feedback.text || "*(No description provided)*"}
${productsSection(feedback, "##")}${screenshotSection}
## Environment
${environmentTable(feedback)}${attachmentSection(assets, "##")}${logsDetails(feedback)}
${promptDetails("🤖 Coding Agent Prompt", assets.promptText)}

${closingTheLoopSection([feedback.id], deliveryMode)}

---
*Logged via [FeedbackKit](https://feedback-kit.hejitech.workers.dev/) from report \`${feedback.id}\`*`;
}

/**
 * The prompt for the whole batch: the dashboard's merged prompt when the
 * member edited it (`override`), else each report's own prompt under one
 * header — the same framing as web/src/lib/prompt-template.ts renderMergedPrompt.
 */
export function batchPrompt(reports: ReportAssets[], override?: string | null): string {
  if (override && override.trim()) return override.trim();
  const header = `You are an expert software engineer addressing multiple user feedback reports for this app in a single pass.
Resolve all ${reports.length} reported issues described below in a coordinated manner. By solving them together, ensure changes are cohesive, avoid git merge conflicts, and prevent regressions across shared files, state, or navigation flows.`;
  const sections = reports.map((r, i) => `## Report ${i + 1} of ${reports.length} (\`${r.feedback.id}\`)\n\n${r.promptText}`);
  return [header, ...sections].join("\n\n");
}

export function batchIssueBody(
  reports: ReportAssets[],
  deliveryMode: string | null | undefined,
  promptOverride?: string | null,
): string {
  const build = (withLogs: boolean) => {
    const index = reports
      .map((r, i) => `${i + 1}. ${screenPrefix(r.feedback)}${snippet(r.feedback.text, 80) ?? "*(no description)*"} — \`${r.feedback.id}\``)
      .join("\n");
    const sections = reports
      .map((r, i) => {
        const f = r.feedback;
        return `## ${i + 1}. ${screenPrefix(f)}${snippet(f.text, 60) ?? "Bug report"}

### Description
${f.text || "*(No description provided)*"}
${productsSection(f, "###")}
### Screenshot
${r.screenshotMd}

### Environment
${environmentTable(f)}${attachmentSection(r, "###")}${withLogs ? logsDetails(f, BATCH_LOG_LINES) : ""}`;
      })
      .join("\n\n---\n\n");
    return `These ${reports.length} reports were merged in FeedbackKit to be fixed together in one change.

${index}

---

${sections}

---

${promptDetails("🤖 Coding Agent Prompt (all reports)", batchPrompt(reports, promptOverride))}

${closingTheLoopSection(reports.map((r) => r.feedback.id), deliveryMode)}

---
*Logged via [FeedbackKit](https://feedback-kit.hejitech.workers.dev/) from ${reports.length} reports*`;
  };
  const body = build(true);
  return body.length <= MAX_ISSUE_BODY ? body : build(false);
}
