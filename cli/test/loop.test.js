import test from "node:test";
import assert from "node:assert/strict";
import { compareBuilds, formatTimeline, loopInstructions } from "../dist/loop.js";
import { createMcpServer } from "../dist/mcp/server.js";

test("compareBuilds orders dotted numeric builds and refuses to guess otherwise", () => {
  assert.equal(compareBuilds("42", "42"), 0);
  assert.equal(compareBuilds("41", "42"), -1);
  assert.equal(compareBuilds("1.2.10", "1.2.9"), 1);
  assert.equal(compareBuilds("1.2", "1.2.0"), 0);
  // UTC-timestamp builds from scripts/release_testflight.sh exceed 2^53.
  assert.equal(compareBuilds("20260925101010", "20260925101011"), -1);
  assert.equal(compareBuilds("99999999999999999999", "99999999999999999998"), 1);
  assert.equal(compareBuilds("abc123", "abc124"), null);
  assert.equal(compareBuilds("abc123", "abc123"), 0);
  assert.equal(compareBuilds(null, "1"), null);
  assert.equal(compareBuilds("", "1"), null);
});

test("loopInstructions tells the agent how to link its PR and flags reopened reports", () => {
  const item = { id: "11111111-2222-3333-4444-555555555555", fix_stage: null };
  const text = loopInstructions(item);
  assert.match(text, /FeedbackKit: 11111111-2222-3333-4444-555555555555/);
  assert.match(text, /claim_feedback/);
  assert.doesNotMatch(text, /reopened/);
  assert.match(loopInstructions({ ...item, fix_stage: "reopened", fixed_in_build: "7" }), /reopened.*build 7/s);
});

test("formatTimeline marks reporter-visible entries", () => {
  const text = formatTimeline([
    { kind: "question", actor_type: "agent", actor_label: "claude-code", body: "Which device?", visible_to_reporter: true, created_at: "2026-09-25T10:00:00Z" },
  ]);
  assert.match(text, /question.*claude-code \[reporter can see\]: Which device\?/);
  assert.equal(formatTimeline([]), "(no activity yet)");
});

test("the MCP server registers the closed-loop tools", () => {
  const tools = createMcpServer()._registeredTools;
  for (const name of ["claim_feedback", "post_update", "ask_reporter", "link_fix", "attach_after_screenshot"]) {
    assert.ok(tools[name], `${name} registered`);
  }
  // There is deliberately no tool that marks a fix verified.
  assert.ok(!Object.keys(tools).some((n) => /verif/.test(n)));
});

test("link_fix requires a PR or a commit", async () => {
  const res = await createMcpServer()._registeredTools["link_fix"].handler({ feedback_id: "x", merged: false });
  assert.equal(res.isError, true);
});
