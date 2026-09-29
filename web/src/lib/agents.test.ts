import test from "node:test";
import assert from "node:assert/strict";
import { agentOptions, defaultAgent } from "./agents.ts";

test("lists every configured trigger, then local, then supported agents not set up", () => {
  const options = agentOptions({ dispatch_labels: ["antigravity"], dispatch_comment: null, dispatch_copilot: false });
  assert.deepEqual(
    options.map((o) => [o.id, o.configured]),
    [
      ["antigravity", true],
      ["local", true],
      ["claude", false],
      ["copilot", false],
    ],
  );
  assert.equal(options[0].name, "Antigravity");
});

test("offers All configured only when there's more than one GitHub trigger", () => {
  const options = agentOptions({ dispatch_labels: ["claude", "my-bot"], dispatch_comment: "@bot fix", dispatch_copilot: true });
  assert.deepEqual(
    options.filter((o) => o.configured).map((o) => o.id),
    ["claude", "my-bot", "comment", "copilot", "all", "local"],
  );
  assert.equal(options.find((o) => o.id === "my-bot")?.name, "my-bot");
  assert.equal(options.some((o) => !o.configured && o.id === "claude"), false);
});

test("defaultAgent keeps a saved choice only while it's configured", () => {
  const options = agentOptions({ dispatch_labels: ["antigravity", "claude"], dispatch_comment: null, dispatch_copilot: false });
  assert.equal(defaultAgent(options, "claude")?.id, "claude");
  assert.equal(defaultAgent(options, "copilot")?.id, "antigravity");
  assert.equal(defaultAgent(options, "local")?.id, "local");
  assert.equal(defaultAgent(agentOptions({ dispatch_labels: [], dispatch_comment: null, dispatch_copilot: false }), null), null);
});
