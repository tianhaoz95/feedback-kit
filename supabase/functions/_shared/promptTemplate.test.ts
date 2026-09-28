import { assertEquals, assertMatch, assertNotMatch } from "jsr:@std/assert@1";
import { renderPromptTemplate } from "./promptTemplate.ts";

const feedback = {
  id: "a30c5ece-bff1-45b5-802a-603fde2c206e",
  text: "Add logos for the coding agents",
  environment: { screenName: "Landing page", osName: "macOS", osVersion: "10.15.7", platform: "web", pageUrl: "https://example.com/" },
  products: [],
  logs: [],
};

Deno.test("fills every placeholder the template uses", () => {
  const out = renderPromptTemplate(
    "## User's report\n{{feedback_text}}\n## Screen\n{{screen_name}}\nOS: {{os_name}} {{os_version}}\nURL: {{page_url}}\n## Screenshot\nAt: {{screenshot_url}}",
    feedback,
    "https://raw.githubusercontent.com/o/r/HEAD/shot.png",
    null,
  );
  assertNotMatch(out, /{{/);
  assertMatch(out, /Add logos for the coding agents/);
  assertMatch(out, /OS: macOS 10\.15\.7/);
  assertMatch(out, /At: https:\/\/raw\.githubusercontent\.com/);
});

Deno.test("drops the screenshot section when there's no screenshot", () => {
  const out = renderPromptTemplate("{{feedback_text}}\n## Screenshot\nAt: {{screenshot_url}}\n## Task\nFix it.", feedback, null, null);
  assertNotMatch(out, /Screenshot/);
  assertMatch(out, /## Task/);
});

Deno.test("appends web context when the template has no web placeholders", () => {
  assertEquals(renderPromptTemplate("{{feedback_text}}", feedback, null, null).includes("## Web context"), true);
});
