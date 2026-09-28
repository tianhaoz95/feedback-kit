---
name: setup-agent-runner
description: Run a coding agent automatically on FeedbackKit reports, on the team's own Mac — register a self-hosted GitHub Actions runner, add a workflow that starts Claude Code or Google Antigravity when FeedbackKit labels an issue, and let the agent build the app, run it in the Simulator and open a PR that closes the loop back to the reporter. Also covers the lighter `feedbackkit watch` alternative for solo developers.
---

# setup-agent-runner

FeedbackKit hands a report to a coding agent by creating a GitHub issue and adding a label (project Settings → **Coding agent loop**). This skill makes that label start an agent **on a Mac the team controls**, not a hosted Linux box:

```
report ──▶ "Send to agent" ──▶ GitHub issue + label ──▶ self-hosted Mac runner
   ──▶ Claude Code builds, runs the Simulator, fixes ──▶ PR with `FeedbackKit: <id>`
   ──▶ merged ──▶ next build shipped ──▶ reporter confirms on their device
```

Hosted agents (Copilot, Codex cloud) run on Linux and can't build an iOS or macOS app. A Mac runner can, so the agent can reproduce the bug and attach an "after" screenshot.

## When to Use

- The team wants reports fixed without anyone opening an agent by hand.
- The app is iOS/macOS (needs Xcode), or the team wants to use its own Claude subscription instead of an API key.
- Trigger phrases: "run the agent automatically", "self-hosted runner for FeedbackKit", "auto-fix feedback", "agent on my Mac".

**Solo developer, no CI?** Skip the runner: `npx feedbackkit-cli watch --project <id>` in the repo does the same on a laptop (Step 7).

## Prerequisites

- The FeedbackKit GitHub App is installed and the project's repo is connected (see `setup-release-loop` Step 2).
- A Mac that stays on, with Xcode (for Apple apps) and Node.
- The `gh` CLI with admin access to the repo, and the Claude Code CLI (`claude`).
- **A private repository.** GitHub warns against self-hosted runners on public repos: anyone who can open a PR could run code on the Mac.

## Step-by-Step Instructions

### Step 1 -- Inspect

Find the repo (`gh repo view --json nameWithOwner,visibility`), how the app builds (scheme, `xcodegen`, `npm`), and existing workflows. **Stop if the repo is public** and suggest `feedbackkit watch` or a private fork instead.

### Step 2 -- Register the runner on the Mac

On the Mac that will run the agent (for the repo's `OWNER/REPO`):

```bash
mkdir -p ~/actions-runner && cd ~/actions-runner
URL=$(gh api repos/actions/runner/releases/latest --jq '.assets[] | select(.name | test("osx-arm64.*tar.gz$")) | .browser_download_url')
curl -sL "$URL" | tar xz
TOKEN=$(gh api -X POST repos/OWNER/REPO/actions/runners/registration-token --jq .token)
./config.sh --url https://github.com/OWNER/REPO --token "$TOKEN" \
  --labels feedbackkit-agent --name "$(hostname -s)-feedbackkit" --unattended
./svc.sh install && ./svc.sh start
```

(`osx-x64` on an Intel Mac.) `svc.sh` installs a LaunchAgent for the logged-in user, so the runner can use the Simulator and that user's `~/.feedbackkit` login.

### Step 3 -- Pick the agent

| Agent | Template | How it signs in | How it's fenced |
|---|---|---|---|
| Claude Code | `templates/feedbackkit-agent.yml.template` | `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY` secret | `--allowedTools` in the workflow; FeedbackKit MCP tools included |
| Google Antigravity | `templates/feedbackkit-agent-antigravity.yml.template` | Signed in once, interactively, as the runner's user | Allow rules (commands and FeedbackKit MCP tools) in the runner user's Antigravity settings; the agent only edits files, the workflow commits, pushes and opens the PR |

Use a different dispatch label per agent if the repo has both workflows, or both run.

For **Claude Code**, continue with Step 3a. For **Antigravity**, skip to Step 3b.

### Step 3a -- Give Claude Code credentials

```bash
claude setup-token                      # opens a browser, prints a long-lived token (uses the team's Claude subscription)
gh secret set CLAUDE_CODE_OAUTH_TOKEN   # paste it when prompted
# or, with an API key instead: gh secret set ANTHROPIC_API_KEY
```

Install the Claude GitHub App on the repo (https://github.com/apps/claude) — the action uses it to push branches and open PRs.

Optional but recommended: on the runner Mac, `npx feedbackkit-cli login` as the runner's user. The workflow then gives the agent the FeedbackKit MCP tools (claim the report, ask the reporter, attach an "after" screenshot).

### Step 3b -- Set up Antigravity on the runner Mac

As the user the runner service runs as:

1. Install the Antigravity CLI and run `agy` once interactively to sign in. Headless runs (`agy -p`) reuse those cached credentials; with none they exit with an auth error.
2. Allow the commands the agent needs in `~/.gemini/antigravity-cli/settings.json`. Antigravity 1.2 reads allow rules only from this global file (not from the repository), and **a denied command ends the whole run** — even `ls` goes through this check — so list read-only commands as well as the build and test tools:

   ```bash
   S=~/.gemini/antigravity-cli/settings.json; [ -f "$S" ] || echo '{}' > "$S"
   jq '.permissions.allow = ((.permissions.allow // []) + [
     "command(ls)", "command(cat)", "command(grep)", "command(find)", "command(head)", "command(tail)", "command(wc)", "command(pwd)",
     "read_url(raw.githubusercontent.com)", "read_url(github.com)",
     "command(rg)", "command(sort)", "command(uniq)", "command(diff)", "command(stat)", "command(file)", "command(which)", "command(mkdir)",
     "command(git log)", "command(git show)", "command(git diff)", "command(git status)", "command(git blame)",
     "command(git grep)", "command(git ls-files)", "command(git rev-parse)",
     "command(xcodebuild)", "command(xcrun)", "command(swift)", "command(xcodegen)"
   ] | unique)' "$S" > "$S.tmp" && mv "$S.tmp" "$S"
   ```

   The `read_url` rules let it open the report's screenshot, which FeedbackKit stores in the repository and links from the issue; without them the run stops the moment it tries. Swap the last line for the project's tools (e.g. `command(node)`, `command(npm)` for a web app). Allow only git's read subcommands, as above (agents look up history often, and a denied `git log` ends the run); never plain `command(git)`: the workflow does all commits and pushes. Never use `--dangerously-skip-permissions` here — report text is untrusted input.
3. Optional but recommended — the FeedbackKit MCP tools, so the agent claims the report, can ask the reporter, and attaches an "after" screenshot (the loop works without them, through the PR's `FeedbackKit:` line):

   ```bash
   npx feedbackkit-cli login                                   # as the runner's user
   agy mcp add feedbackkit -- npx -y feedbackkit-cli mcp --project <project-id>
   jq '.permissions.allow = ((.permissions.allow // []) + [
     "mcp(feedbackkit/claim_feedback)", "mcp(feedbackkit/post_update)", "mcp(feedbackkit/ask_reporter)",
     "mcp(feedbackkit/attach_after_screenshot)", "mcp(feedbackkit/get_feedback)", "mcp(feedbackkit/get_prompt)"
   ] | unique)' "$S" > "$S.tmp" && mv "$S.tmp" "$S"
   ```

   MCP calls need allow rules like commands do, one per tool as `mcp(<server>/<tool>)` (`mcp(feedbackkit/*)` allows them all; a bare `mcp(feedbackkit)` matches nothing). Leave out `update_feedback_status` and `link_fix`: the workflow links the fix itself.
4. Copy `templates/feedbackkit-agent-antigravity.yml.template` to `.github/workflows/feedbackkit-agent-antigravity.yml` and replace `__DISPATCH_LABEL__` (e.g. `antigravity`). The checkout keeps no credentials (`persist-credentials: false`), so only the workflow's own step can push.

Then continue at Step 5.

### Step 4 -- Add the Claude Code workflow

Copy `templates/feedbackkit-agent.yml.template` to `.github/workflows/feedbackkit-agent.yml`, replace `__DISPATCH_LABEL__` (e.g. `claude`), and widen `--allowedTools` only as far as the build needs (e.g. `Bash(npm test:*)` for a web app). Keep `allowed_bots: feedbackkit-app`: the label is added by FeedbackKit's GitHub App, and claude-code-action refuses bot-triggered runs otherwise.

### Step 5 -- Point FeedbackKit at it

Dashboard → project **Settings → Coding agent loop** → dispatch labels = the same label. From then on, **Send to agent** on a report (and a reporter's "still broken") starts a run.

### Step 6 -- Tell the user what's guarded

- Only people with write access, or FeedbackKit's app, can add the label.
- Report text is written by app users. It reaches the agent as issue text, so a malicious report could try to steer it. The allowed-tools list is the fence: no network tools, no credentials on the runner beyond what the build needs, and the agent opens a PR — it never merges.
- Every run is visible in the repo's Actions tab.

### Step 7 -- Alternative: `feedbackkit watch` (no CI)

For one developer on a laptop:

```bash
cd path/to/repo
npx feedbackkit-cli watch --project <project-id>             # Claude Code (default)
npx feedbackkit-cli watch --project <project-id> --agent codex
```

Reports are queued with **Run on my machine** in the dashboard. Each run gets its own git worktree and branch; the fix is pushed and opened as a PR with `gh`. `--auto` also picks up every new report without a click — only for trusted reporters (internal testers), since report text becomes agent input. `--max-runs` caps runs per day.

## Verification

1. Send a test report from the app, then **Send to agent** in the dashboard.
2. The repo's Actions tab shows **FeedbackKit agent** running on the `feedbackkit-agent` runner.
3. A PR appears whose description contains `FeedbackKit: <id>`, and the report's fix stage moves to **PR open**.

## Non-Obvious Pitfalls

- **"Workflow initiated by non-human actor"** in the run log = `allowed_bots` is missing the FeedbackKit app.
- **Antigravity: "a tool required the "command" (or "mcp") permission … auto-denied"** = the agent tried a command or MCP tool that isn't in the allow list, and the run stopped there. Add it (if it's safe) to the runner user's `~/.gemini/antigravity-cli/settings.json` and send the report to the agent again.
- **Antigravity PRs don't start your other workflows**: they're opened with the job's `GITHUB_TOKEN`, which GitHub doesn't let trigger workflows. FeedbackKit's webhook still sees them and links the fix.
- **Code signing:** the runner service can't unlock the login keychain. Build for the Simulator with `CODE_SIGNING_ALLOWED=NO`.
- **Runner offline:** a Mac that sleeps drops the runner; jobs wait in the queue until it's back. Disable sleep (System Settings → Energy) on a dedicated machine.
- **Both triggers set:** if the project also has a trigger comment containing `@claude`, one dispatch starts two runs — the `concurrency` group cancels the older one, but pick one trigger.
- **Label re-dispatch:** FeedbackKit removes and re-adds the label on reopen so `labeled` fires again; don't add a workflow step that removes it.
