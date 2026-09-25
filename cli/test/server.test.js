import test from "node:test";
import assert from "node:assert/strict";
import { createMcpServer } from "../dist/mcp/server.js";

test("createMcpServer without projectId registers all tools with default descriptions", () => {
  const server = createMcpServer();
  assert.ok(server);
  const tools = server._registeredTools;
  assert.ok(tools["list_projects"]);
  assert.ok(tools["list_feedback"]);
  assert.ok(tools["get_feedback"]);
  assert.ok(tools["get_prompt"]);
  assert.ok(tools["get_docs"]);
  assert.ok(tools["update_feedback_status"]);
  assert.equal(tools["list_projects"].description, "List the FeedbackKit projects you're a member of.");
  assert.equal(
    tools["list_feedback"].description,
    "List feedback reports captured by the iOS app, optionally filtered by project, status and/or fix stage.",
  );
});

test("createMcpServer with projectId scopes descriptions to that project", () => {
  const server = createMcpServer({ projectId: "proj_abc123" });
  assert.ok(server);
  const tools = server._registeredTools;
  assert.match(tools["list_projects"].description, /proj_abc123/);
  assert.match(tools["list_feedback"].description, /proj_abc123/);
  assert.match(tools["get_feedback"].description, /proj_abc123/);
  assert.match(tools["update_feedback_status"].description, /proj_abc123/);
});

test("list_feedback rejects query for another project when scoped", async () => {
  const server = createMcpServer({ projectId: "proj_abc123" });
  const tool = server._registeredTools["list_feedback"];
  const res = await tool.handler({ project_id: "other_project", limit: 20 });
  assert.equal(res.isError, true);
  assert.match(
    res.content[0].text,
    /Cannot query project "other_project": this MCP server is scoped to project "proj_abc123"/,
  );
});
