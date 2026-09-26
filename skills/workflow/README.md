# FeedbackKit Workflow Skills

[Agent Skills](https://github.com/vercel-labs/skills) for the day-to-day loop once FeedbackKit is set up: a coding agent picking up user reports, fixing them, and getting the fix back to the person who reported it.

## Skills in this Category

| Skill | Description |
|---|---|
| [`fix-feedback`](fix-feedback/SKILL.md) | Pick up a FeedbackKit report over MCP, reproduce and fix it, attach before/after proof, and commit with a `FeedbackKit:` trailer so the fix ships back to the reporter's device for verification. |
| [`promote-release`](promote-release/SKILL.md) | Read release readiness (fixes verified, awaiting reporters, or reopened), explain what blocks a beta, recommend which build to promote, and record the promotion after the owner ships it. |

Together with the setup skills, these cover the whole loop: `setup-*-sdk` (the app asks "is it fixed?") → `setup-release-loop` (the repo announces builds) → `fix-feedback` (an agent fixes and links) → `promote-release` (the owner ships what reporters verified).

## Prerequisites

- The FeedbackKit MCP server connected to your agent (see [`setup-mcp-server`](../setup/setup-mcp-server/SKILL.md)).
- For iOS/macOS reproduction: [XcodeBuildMCP](https://www.xcodebuildmcp.com/) (optional but strongly recommended).
