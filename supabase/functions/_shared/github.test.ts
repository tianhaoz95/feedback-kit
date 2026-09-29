import { assertEquals } from "jsr:@std/assert@1";
import { dispatchSettingsFor } from "./github.ts";

const project = { dispatch_labels: ["antigravity", "claude"], dispatch_comment: "@claude please fix", dispatch_copilot: true };

Deno.test("no agent keeps every configured trigger", () => {
  assertEquals(dispatchSettingsFor(project), {
    dispatch_labels: ["antigravity", "claude"],
    dispatch_comment: "@claude please fix",
    copilot: true,
  });
  assertEquals(dispatchSettingsFor(project, "all"), dispatchSettingsFor(project));
});

Deno.test("a picked label dispatches only that label", () => {
  assertEquals(dispatchSettingsFor(project, "claude"), { dispatch_labels: ["claude"], dispatch_comment: null, copilot: false });
});

Deno.test("copilot and the trigger comment can be picked on their own", () => {
  assertEquals(dispatchSettingsFor(project, "copilot"), { dispatch_labels: [], dispatch_comment: null, copilot: true });
  assertEquals(dispatchSettingsFor(project, "comment"), {
    dispatch_labels: [],
    dispatch_comment: "@claude please fix",
    copilot: false,
  });
});

Deno.test("an agent that isn't configured is refused", () => {
  assertEquals(dispatchSettingsFor(project, "codex"), null);
  assertEquals(dispatchSettingsFor({ dispatch_labels: [], dispatch_copilot: false }, "copilot"), null);
  assertEquals(dispatchSettingsFor({ dispatch_labels: ["claude"] }, "comment"), null);
});
