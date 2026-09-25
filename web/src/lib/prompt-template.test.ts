import test from "node:test";
import assert from "node:assert/strict";
import { renderPromptTemplate, renderMergedPrompt } from "./prompt-template.ts";
import type { FeedbackItem } from "./types.ts";

type MockFeedbackOverrides = Omit<Partial<FeedbackItem>, "environment"> & {
  environment?: Partial<FeedbackItem["environment"]>;
};

function createMockFeedback(overrides: MockFeedbackOverrides = {}): FeedbackItem {
  const defaultEnv: FeedbackItem["environment"] = {
    screenName: "CartView",
    osName: "iOS",
    osVersion: "18.2",
    deviceModel: "iPhone 16 Pro",
    appVersion: "1.2.0",
    appBuild: "42",
    bundleIdentifier: "com.example.DemoApp",
    locale: "en_US",
    screenWidthPoints: 393,
    screenHeightPoints: 852,
    screenScale: 3,
  };

  return {
    id: "fb_mock_1",
    project_id: "proj_1",
    status: "new",
    text: "Button overlaps with text on iPhone 16",
    screenshot_raw_path: "proj_1/fb_mock_1/screenshot.png",
    screenshot_annotated_path: "proj_1/fb_mock_1/annotated.png",
    attachment_path: null,
    attachment_filename: null,
    attachment_mime_type: null,
    github_issue_url: null,
    github_issue_number: null,
    edited_prompt: null,
    created_at: "2026-09-22T12:00:00Z",
    annotations: [],
    ...overrides,
    environment: {
      ...defaultEnv,
      ...(overrides.environment ?? {}),
    },
  };
}

test("renderPromptTemplate replaces placeholders accurately", () => {
  const item = createMockFeedback();
  const template = "Screen: {{screen_name}} | Issue: {{feedback_text}} | Device: {{device_model}} | Shot: {{screenshot_url}}";
  const result = renderPromptTemplate(template, item, "https://example.com/shot.png", null);

  assert.equal(
    result,
    "Screen: CartView | Issue: Button overlaps with text on iPhone 16 | Device: iPhone 16 Pro | Shot: https://example.com/shot.png"
  );
});

test("renderPromptTemplate removes screenshot section when screenshotUrl is null", () => {
  const item = createMockFeedback();
  const template = `## User's report\n{{feedback_text}}\n\n## Screenshot\nAn annotated screenshot is at: {{screenshot_url}}\n\n## Task\nFix this`;
  const result = renderPromptTemplate(template, item, null, null);
  assert.equal(
    result,
    "## User's report\nButton overlaps with text on iPhone 16\n\n## Task\nFix this"
  );
});

test("renderMergedPrompt returns empty string when no items provided", () => {
  assert.equal(renderMergedPrompt([], {}), "");
});

test("renderMergedPrompt falls back to single prompt template when exactly one item provided", () => {
  const item = createMockFeedback();
  const result = renderMergedPrompt(
    [item],
    { fb_mock_1: { screenshot: "https://example.com/shot.png", attachment: null } },
    "Fix: {{feedback_text}}"
  );
  assert.equal(result, "Fix: Button overlaps with text on iPhone 16");
});

test("renderMergedPrompt produces coordinated multi-issue prompt for multiple items", () => {
  const item1 = createMockFeedback({
    id: "fb_1",
    text: "Checkout button disabled unexpectedly",
    environment: { screenName: "CheckoutSheet", osName: "iOS", osVersion: "18.2", deviceModel: "iPhone 16" },
  });
  const item2 = createMockFeedback({
    id: "fb_2",
    text: "Cart badge does not increment after adding item",
    environment: { screenName: "ProductDetail", osName: "iOS", osVersion: "18.2", deviceModel: "iPhone 16" },
  });

  const signedUrls = {
    fb_1: { screenshot: "https://storage.example.com/fb_1.png", attachment: null },
    fb_2: { screenshot: "https://storage.example.com/fb_2.png", attachment: "https://storage.example.com/log.txt" },
  };

  const merged = renderMergedPrompt([item1, item2], signedUrls);

  // Check header
  assert.match(merged, /Resolve all 2 reported issues described below in a coordinated manner/);
  assert.match(merged, /prevent regressions across shared files/);

  // Check summary lines
  assert.match(merged, /## Summary of Issues \(2 total\)/);
  assert.match(merged, /1\. \[CheckoutSheet\] Checkout button disabled unexpectedly \(ID: `fb_1`, Status: new\)/);
  assert.match(merged, /2\. \[ProductDetail\] Cart badge does not increment after adding item \(ID: `fb_2`, Status: new\)/);

  // Check issue details
  assert.match(merged, /### Issue 1: \[CheckoutSheet\] Checkout button disabled unexpectedly/);
  assert.match(merged, /- \*\*Screenshot URL\*\*: https:\/\/storage\.example\.com\/fb_1\.png/);
  assert.match(merged, /### Issue 2: \[ProductDetail\] Cart badge does not increment after adding item/);
  assert.match(merged, /- \*\*Screenshot URL\*\*: https:\/\/storage\.example\.com\/fb_2\.png/);

  // Check guidelines
  assert.match(merged, /## Coordinated Implementation Guidelines/);
  assert.match(merged, /Analyze Shared Dependencies/);
  assert.match(merged, /Coordinated Multi-Issue Fixes/);
});

test("renderMergedPrompt includes custom edited_prompt when available", () => {
  const item1 = createMockFeedback({
    id: "fb_1",
    edited_prompt: "Special instructions for fixing CheckoutSheet: check StoreKit validation.",
  });
  const item2 = createMockFeedback({ id: "fb_2" });

  const merged = renderMergedPrompt([item1, item2], {});

  assert.match(merged, /Special instructions for fixing CheckoutSheet: check StoreKit validation\./);
});

test("renderPromptTemplate formats products correctly", () => {
  const item = createMockFeedback({
    products: [
      { key: "ios", name: "iOS App", description: "SwiftUI client" },
      { key: "backend", name: "Backend API", description: "Node/Edge functions" },
    ],
  });
  const template = "Products:\n{{products}}";
  const result = renderPromptTemplate(template, item, null, null);
  assert.equal(
    result,
    "Products:\n- **iOS App** (`ios`): SwiftUI client\n- **Backend API** (`backend`): Node/Edge functions"
  );
});

test("renderPromptTemplate handles empty products with none specified fallback", () => {
  const item = createMockFeedback({ products: [] });
  const template = "Products:\n{{products}}";
  const result = renderPromptTemplate(template, item, null, null);
  assert.equal(result, "Products:\n(none specified)");
});


const webEnv: Partial<FeedbackItem["environment"]> = {
  screenName: "Project › Settings",
  osName: "macOS",
  osVersion: "15.2",
  deviceModel: "Chrome 141",
  bundleIdentifier: "app.example.com",
  platform: "web",
  pageUrl: "https://app.example.com/projects/1?tab=settings",
  browserName: "Chrome",
  browserVersion: "141.0.7390.54",
  screenWidthPoints: 1440,
  screenHeightPoints: 900,
  screenScale: 2,
};

test("renderPromptTemplate appends web context to a pre-web-SDK template", () => {
  const feedback = createMockFeedback({
    environment: webEnv,
    logs: [{ level: "error", message: "TypeError: x is undefined", timestamp: "2026-09-25T12:00:01.000Z" }],
  });
  const result = renderPromptTemplate("## Report\n{{feedback_text}}", feedback, null, null);
  assert.ok(result.includes("## Web context"));
  assert.ok(result.includes("- Page URL: https://app.example.com/projects/1?tab=settings"));
  assert.ok(result.includes("- Browser: Chrome 141.0.7390.54"));
  assert.ok(result.includes("12:00:01 [error] TypeError: x is undefined"));
});

test("renderPromptTemplate fills web placeholders and doesn't duplicate the section", () => {
  const feedback = createMockFeedback({ environment: webEnv, logs: [] });
  const result = renderPromptTemplate("URL {{page_url}} on {{platform}} / {{browser}}\n{{console_logs}}", feedback, null, null);
  assert.equal(
    result,
    "URL https://app.example.com/projects/1?tab=settings on Web / Chrome 141.0.7390.54\n(none captured)",
  );
  assert.ok(!result.includes("## Web context"));
});

test("renderPromptTemplate leaves native reports without a web section", () => {
  const result = renderPromptTemplate("{{feedback_text}} {{platform}}", createMockFeedback(), null, null);
  assert.equal(result, "Button overlaps with text on iPhone 16 iOS");
});

test("renderMergedPrompt includes page URL and logs for web reports", () => {
  const web = createMockFeedback({
    id: "fb_web",
    environment: webEnv,
    logs: [{ level: "network", message: "POST /api/save → 500", timestamp: "2026-09-25T12:00:02.000Z" }],
  });
  const result = renderMergedPrompt([web, createMockFeedback({ id: "fb_ios" })], {});
  assert.ok(result.includes("Page URL: https://app.example.com/projects/1?tab=settings"));
  assert.ok(result.includes("[network] POST /api/save → 500"));
});
