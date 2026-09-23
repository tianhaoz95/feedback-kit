# CLI & MCP Server (`cli/`)

The FeedbackKit CLI is published on npm as [`feedbackkit-cli`](https://www.npmjs.com/package/feedbackkit-cli). It doubles as a Model Context Protocol (MCP) server for AI coding agents.

---

## What the CLI Does

- **Terminal Interface**: Inspect organizations, list projects, view feedback items, and fetch generated agent prompts directly from your shell.
- **MCP Server (`feedbackkit mcp`)**: Bridges AI coding tools (Claude Code, Cursor, Antigravity, Codex) directly to user feedback. An AI agent can inspect the active bug report without human copy-pasting.

---

## Authentication Flow

1. Developer runs `feedbackkit login`.
2. The CLI starts a local HTTP server on a random port (e.g. `http://127.0.0.1:45123`).
3. CLI opens the browser to:
   ```
   https://feedback-kit.tianhaozhou95.workers.dev/cli-auth?port=45123&state=...
   ```
4. User clicks "Authorize".
5. The web app sends the active Supabase session (access + refresh tokens) back to the local CLI listener.
6. The CLI persists credentials in `~/.config/feedbackkit/credentials.json`.

---

## MCP Tools Catalog

When launched via `feedbackkit mcp`, the server registers standard MCP tools:

| Tool | Parameters | Description |
|---|---|---|
| `list_projects` | None | Lists projects the authenticated user belongs to |
| `list_feedback` | `projectId`, `limit`, `status` | Lists recent feedback items for a project |
| `get_feedback` | `feedbackId` | Returns structured feedback details, diagnostics, and signed screenshot URLs |
| `get_prompt` | `feedbackId` | Returns the rendered AI coding prompt for a specific issue |
| `get_docs` | `topic` | Reads local documentation topics (can run offline without login) |

---

## Local Development & Testing

```bash
cd cli
npm install
npm run build      # Compiles TypeScript to dist/
npm test           # Runs node test suite

# Test CLI locally
node dist/index.js --help

# Test MCP server with MCP inspector
npx @modelcontextprotocol/inspector node dist/index.js mcp
```
