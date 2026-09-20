# feedbackkit-cli

A CLI and MCP server for reading FeedbackKit dashboard feedback — so a coding
agent (Claude Code, Cursor, etc.) can pull a bug report and its generated
prompt directly, instead of a human copying it out of the dashboard and
pasting it in.

## How auth works

`feedbackkit login` opens your browser to the dashboard, where you authorize
the CLI (signing in with GitHub first, if you aren't already). The dashboard
hands the CLI your **real Supabase session** — the same one the browser
dashboard uses — via a one-time redirect to a local server the CLI starts
for this purpose. There's no separate token type: the CLI is just another
signed-in client, and Postgres row-level security enforces access exactly
like it does for the web dashboard. See:

- `web/src/pages/CliAuthPage.tsx` — the authorize page
- `supabase/migrations/0007_cli_sessions.sql` — the bookkeeping table that
  lets you see/revoke connected CLIs from the dashboard's "CLI access" page,
  and why that revocation is cooperative rather than an instant, cryptographic
  kill (the CLI checks its own row before doing work)

Credentials are stored at `~/.feedbackkit/credentials.json` (owner-only
permissions).

## Commands

```bash
feedbackkit login [--dashboard-url <url>]   # sign in via your browser
feedbackkit logout                          # remove local credentials
feedbackkit whoami                          # show the signed-in user
feedbackkit projects                        # list your projects
feedbackkit list [--project <id>] [--status new|in_progress|resolved|wont_fix]
feedbackkit prompt <feedbackId>             # print the generated coding-agent prompt
feedbackkit mcp                             # run an MCP server over stdio
```

`--dashboard-url` defaults to the hosted GitHub Pages dashboard; point it at
`http://localhost:3000` when developing against a local Supabase stack
(`./scripts/start-web.sh`).

## MCP server

`feedbackkit mcp` runs an MCP server over stdio. Point your agent's MCP
client config at it, e.g. for Claude Code:

```json
{
  "mcpServers": {
    "feedbackkit": {
      "command": "feedbackkit",
      "args": ["mcp"]
    }
  }
}
```

Tools exposed:

| Tool | What it does |
|---|---|
| `list_projects` | List projects you're a member of |
| `list_feedback` | List feedback, optionally filtered by `project_id`/`status` |
| `get_feedback` | Full detail for one feedback item, with a signed screenshot URL |
| `get_prompt` | The generated (or developer-edited) coding-agent prompt for one item |
| `update_feedback_status` | Mark a feedback item's status, e.g. `resolved` after fixing it |

Everything but `update_feedback_status` is read-only by design — the goal is
to remove the copy/paste step, not to let an agent triage your feedback
inbox unsupervised.

## Developing

```bash
npm install
npm run build   # tsc -b, outputs to dist/
node dist/index.js --help
```

There's no published npm package yet — run it from `dist/` directly, or
`npm link` this directory to get a `feedbackkit` binary on your `PATH`.

`src/types.ts` and `src/promptTemplate.ts` are hand-kept-in-sync copies of
`web/src/lib/types.ts` and `web/src/lib/prompt-template.ts` — same pattern
this repo already uses for the Swift↔JSON wire format (see CLAUDE.md).
