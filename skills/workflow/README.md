# FeedbackKit Workflow Skills

[Agent Skills](https://github.com/vercel-labs/skills) for the day-to-day loop once FeedbackKit is set up: a coding agent picking up user reports, fixing them, and getting the fix back to the person who reported it.

## Skills in this Category

| Skill | Description |
|---|---|
| [`fix-feedback`](fix-feedback/SKILL.md) | Pick up a FeedbackKit report over MCP, reproduce and fix it, attach before/after proof, and link the fix so it ships back to the reporter's device for verification. |

## Prerequisites

- The FeedbackKit MCP server connected to your agent (see [`setup-mcp-server`](../setup/setup-mcp-server/SKILL.md)).
- For iOS/macOS reproduction: [XcodeBuildMCP](https://www.xcodebuildmcp.com/) (optional but strongly recommended).
