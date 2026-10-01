import { assert, assertEquals, assertMatch, assertStringIncludes } from "jsr:@std/assert@1";
import { batchIssueBody, batchIssueTitle, issueTitle, singleIssueBody, type ReportAssets } from "./issueBody.ts";

function report(id: string, text: string, extra: Record<string, unknown> = {}): ReportAssets {
  return {
    feedback: {
      id,
      project_id: "test-proj-id",
      text,
      created_at: "2026-09-01T12:00:00Z",
      environment: { screenName: "Cart", osName: "iOS", osVersion: "18.0", deviceModel: "iPhone" },
      products: [],
      logs: [],
      ...extra,
    },
    screenshotMd: "*(No screenshot included)*",
    attachmentUrl: null,
    promptText: `Fix: ${text}`,
  };
}

const a = report("11111111-1111-1111-1111-111111111111", "Checkout button overlaps the total");
const b = report("22222222-2222-2222-2222-222222222222", "Remove button does nothing");

Deno.test("single issue keeps one trailer, prompt, and dashboard link", () => {
  const body = singleIssueBody(a, "batch");
  assertStringIncludes(body, "FeedbackKit: 11111111-1111-1111-1111-111111111111");
  assertStringIncludes(body, "Fix: Checkout button overlaps the total");
  assertStringIncludes(body, "[View report in FeedbackKit Dashboard](https://feedback-kit.hejitech.workers.dev/projects/test-proj-id/feedback/11111111-1111-1111-1111-111111111111)");
  assertEquals(issueTitle(a.feedback), "[Feedback] [Cart] Checkout button overlaps the total");
});

Deno.test("batch issue has a section, trailer, and dashboard link per report", () => {
  const body = batchIssueBody([a, b], "batch");
  assertMatch(body, /## 1\. \[Cart\] Checkout button/);
  assertMatch(body, /## 2\. \[Cart\] Remove button/);
  assertStringIncludes(body, "FeedbackKit: 11111111-1111-1111-1111-111111111111\nFeedbackKit: 22222222-2222-2222-2222-222222222222");
  assertStringIncludes(body, "## Report 2 of 2");
  assertStringIncludes(body, "one trailer per report you fixed");
  assertStringIncludes(body, "[View report in FeedbackKit Dashboard](https://feedback-kit.hejitech.workers.dev/projects/test-proj-id/feedback/11111111-1111-1111-1111-111111111111)");
  assertEquals(batchIssueTitle([a.feedback, b.feedback]), "[Feedback] 2 reports: [Cart] Checkout button overlaps the total (+1 more)");
});

Deno.test("batch issue uses the dashboard's edited prompt and branch wording", () => {
  const body = batchIssueBody([a, b], "branch", "My edited merged prompt");
  assertStringIncludes(body, "My edited merged prompt");
  assert(!body.includes("## Report 1 of 2"));
  assertStringIncludes(body, "Open one pull request");
});

Deno.test("batch issue drops logs to stay under GitHub's body limit", () => {
  const logs = Array.from({ length: 40 }, (_, i) => ({ level: "log", message: "x".repeat(290) + i, timestamp: "2026-09-01T12:00:00Z" }));
  const reports = Array.from({ length: 20 }, (_, i) => report(`${i}`.padStart(8, "0") + "-1111-1111-1111-111111111111", `Bug ${i}`, { logs }));
  const body = batchIssueBody(reports, "batch");
  assert(body.length <= 65_000, `body is ${body.length} chars`);
  assert(!body.includes("Console &amp; network log"));
});
