# feedbackkit-cli

A CLI and MCP server for reading FeedbackKit dashboard feedback — so a coding
agent (Claude Code, Cursor, etc.) can pull a bug report and its generated
prompt directly, instead of a human copying it out of the dashboard and
pasting it in.

## Installation

Install globally from npm:

```bash
npm install -g feedbackkit-cli
```

This puts both `feedbackkit` and `feedbackkit-cli` on your `PATH`.

Or run directly without installing via `npx`:

```bash
npx feedbackkit-cli <command>
```

### Installing from GitHub Packages

FeedbackKit CLI is also published to the GitHub npm package registry as `@tianhaoz95/feedbackkit-cli`. Because GitHub Packages requires authentication even for public packages:

1. Create a GitHub Personal Access Token (classic with `read:packages` scope, or fine-grained with read access to packages).
2. Configure npm for the `@tianhaoz95` scope in `~/.npmrc`:

```ini
@tianhaoz95:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_PAT
```

3. Install globally or run via `npx`:

```bash
npm install -g @tianhaoz95/feedbackkit-cli
# Or run with npx:
npx @tianhaoz95/feedbackkit-cli <command>
```

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
feedbackkit list [--project <id>] [--status new|in_progress|resolved|wont_fix] [--stage <fix stage>]
feedbackkit prompt <feedbackId>             # print the generated coding-agent prompt
feedbackkit timeline <feedbackId>           # fix-loop activity: agent progress, PRs, releases, reporter replies
feedbackkit link <feedbackId> --pr <url> | --commit <sha> [--merged] [--summary <text>]
feedbackkit release --build <n> [--project <id>] [--commit <rev>] [--product <key>] [--channel beta|production] [--token <fkr_…>] [--dry-run]
feedbackkit promote --build <n> [--product <key>] [--token <fkr_…>]   # a beta went to production
feedbackkit token create <name> | list | revoke <id>                  # release tokens for CI
feedbackkit docs [topic]                    # print FeedbackKit's own docs (no topic = list topics)
feedbackkit mcp                             # run an MCP server over stdio
```

`docs` doesn't require being logged in — it's static reference content
(`src/docs.ts`), covering the SDK (iOS/macOS/watchOS install + usage), the
dashboard, the CLI, and MCP itself. It exists so an agent connected via MCP
can answer "how do I add FeedbackKit to my iOS app?" from real, current
documentation instead of guessing from training data — see the `get_docs`
tool below.

`--dashboard-url` defaults to the hosted GitHub Pages dashboard; point it at
`http://localhost:3000` when developing against a local Supabase stack
(`./scripts/start-web.sh`).

## MCP server

`feedbackkit mcp` runs an MCP server over stdio. Point your agent's MCP
client config at it, e.g. for Claude Code:

```bash
claude mcp add feedbackkit -- feedbackkit mcp
```

Or without a global install:

```bash
claude mcp add feedbackkit -- npx -y feedbackkit-cli mcp
```

For Codex:

```bash
codex mcp add feedbackkit -- feedbackkit mcp
```

Or in `~/.codex/config.toml` (user-wide) or `.codex/config.toml` (project):

```toml
[mcp_servers.feedbackkit]
command = "feedbackkit"
args = ["mcp"]
```

For Antigravity (in `~/.gemini/config/mcp_config.json` or `.agents/mcp_config.json`):

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

Or configure via JSON for other agents (e.g. Cursor, Windsurf, Claude Desktop):

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

Or using `npx`:

```json
{
  "mcpServers": {
    "feedbackkit": {
      "command": "npx",
      "args": ["-y", "feedbackkit-cli", "mcp"]
    }
  }
}
```

### Scoping to a specific project

To limit the MCP server to a single project so the coding agent only pulls feedback and prompts for that specific project (preventing it from pulling from other projects or spending tokens on them), add `--project <id>` or `--project-id <id>` to `args`, or set the `FEEDBACKKIT_PROJECT_ID` environment variable.

#### Claude Code

```bash
claude mcp add --scope project feedbackkit -- feedbackkit mcp --project YOUR_PROJECT_ID
```

#### Codex

In `.codex/config.toml`:

```toml
[mcp_servers.feedbackkit]
command = "feedbackkit"
args = ["mcp", "--project", "YOUR_PROJECT_ID"]
```

#### Antigravity

In `.agents/mcp_config.json`:

```json
{
  "mcpServers": {
    "feedbackkit": {
      "command": "feedbackkit",
      "args": ["mcp", "--project", "YOUR_PROJECT_ID"]
    }
  }
}
```

#### Cursor, Windsurf, Claude Desktop & Other Agents

In `mcp.json`:

```json
{
  "mcpServers": {
    "feedbackkit": {
      "type": "stdio",
      "command": "feedbackkit",
      "args": ["mcp", "--project", "YOUR_PROJECT_ID"]
    }
  }
}
```

#### Environment Variable Alternative

```json
{
  "mcpServers": {
    "feedbackkit": {
      "command": "feedbackkit",
      "args": ["mcp"],
      "env": {
        "FEEDBACKKIT_PROJECT_ID": "YOUR_PROJECT_ID"
      }
    }
  }
}
```

When scoped to a project:
- `list_projects` only returns that project.
- `list_feedback` defaults to that project and rejects queries for other project IDs.
- `get_feedback` and `get_prompt` only return items belonging to that project.
- `update_feedback_status` only updates items belonging to that project.

Tools exposed:

| Tool | What it does |
|---|---|
| `list_projects` | List projects you're a member of (or the scoped project) |
| `list_feedback` | List feedback, optionally filtered by `project_id`/`status`/`fix_stage` (scoped project enforced) |
| `get_feedback` | Full detail for one feedback item plus its timeline, with the annotated screenshot — and the reporter's latest "still broken" screenshot — as MCP image content |
| `get_prompt` | The generated (or developer-edited) coding-agent prompt for one item, plus loop instructions (claim, ask, link the PR) |
| `claim_feedback` | Mark a report as being worked on (fix stage `agent_working`) |
| `post_update` | Add a progress note to the timeline; `notify_reporter` shows it on the reporter's device |
| `ask_reporter` | Ask the reporter a question — shown in the app on their device; the reply lands in the timeline |
| `link_fix` | Record the fix PR/commit and a one-line summary the reporter sees (automatic for PRs containing `FeedbackKit: <id>`) |
| `attach_after_screenshot` | Upload a local PNG of the fixed screen for before/after review |
| `get_docs` | FeedbackKit's own documentation — no `topic` lists topics, e.g. `sdk`/`dashboard`/`cli`/`mcp`; with `topic` returns that topic's full content. Doesn't require being logged in. |
| `update_feedback_status` | Mark a feedback item's status, e.g. `resolved` after fixing it |

The write tools are deliberately narrow: an agent can claim a report, post
progress, ask the reporter a question and link its fix, but it can't mark a
fix *verified*. Only the reporter can, from their own device, once the fix
ships (see below).

## Closing the loop: `release`

`feedbackkit release --build <n>` announces a build. Run it from your repo
after uploading, e.g. at the end of `scripts/release_testflight.sh`, which
does it automatically when `FEEDBACKKIT_PROJECT_ID` is set. Every report
whose fix is merged *and* whose fix commit is an ancestor of the release
commit (`--commit`, default `HEAD`) is marked shipped in that build. SDKs
with fix verification enabled then ask the reporter "is it fixed?" once
they're on that build or newer. `--dry-run` shows what would ship and why.
Fixes with no recorded commit are included; use `--include <ids...>` to
ship specific reports regardless of git. See `feedbackkit docs loop` and
DESIGN.md §7.

**In CI**, pass a project release token instead of logging in:
`FEEDBACKKIT_RELEASE_TOKEN=fkr_… feedbackkit release --build "$BUILD"` (check
out with full history so the ancestry check works). The token can only list
waiting fixes, record releases and promote them, for one project. Create one
with `feedbackkit token create github-actions | gh secret set
FEEDBACKKIT_RELEASE_TOKEN`, or in project Settings → Release tokens.
`FEEDBACKKIT_API_URL` points token mode at a self-hosted backend. See
DESIGN.md §8.

## Developing

```bash
npm install
npm run build   # tsc -b, outputs to dist/
node dist/index.js --help
```

To test local development changes, run from `dist/` directly or `npm link`
this directory to link the local `feedbackkit` binary to your `PATH`.

`test/closed-loop.integration.mjs` exercises the whole loop (schema, RLS,
Edge Functions, MCP tools, `release` against a real git repo) on a local
Supabase stack. It's not part of `npm test`; its header has the steps.

`src/types.ts` and `src/promptTemplate.ts` are hand-kept-in-sync copies of
`web/src/lib/types.ts` and `web/src/lib/prompt-template.ts` — same pattern
this repo already uses for the Swift↔JSON wire format (see CLAUDE.md).
`src/docs.ts` is similarly a condensed, hand-kept-in-sync copy of
`web/src/pages/docs/*.tsx`'s content, in plain markdown instead of JSX —
verify against the real source (`Sources/FeedbackKit/`, the website) if the
two ever seem to disagree.
