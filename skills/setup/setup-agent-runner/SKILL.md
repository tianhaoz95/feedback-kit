---
name: setup-agent-runner
description: Run a coding agent automatically on FeedbackKit reports — register a self-hosted GitHub Actions runner on the team's own Mac (Claude Code or Google Antigravity), or run Antigravity on a GitHub-hosted runner with a Gemini API key — so FeedbackKit labeling an issue starts the agent, which builds the app, fixes the report and opens a PR that closes the loop back to the reporter. Also covers the lighter `feedbackkit watch` alternative for solo developers.
---

# setup-agent-runner

FeedbackKit hands a report to a coding agent by creating a GitHub issue and adding a label (project Settings → **Coding agent loop**). This skill makes that label start an agent **on a Mac the team controls**, not a hosted Linux box:

```
report ──▶ "Send to agent" ──▶ GitHub issue + label ──▶ self-hosted Mac runner
   ──▶ Claude Code builds, runs the Simulator, fixes ──▶ PR with `FeedbackKit: <id>`
   ──▶ merged ──▶ next build shipped ──▶ reporter confirms on their device
```

Hosted agents (Copilot, Codex cloud) run on Linux and can't build an iOS or macOS app. A Mac runner can, so the agent can reproduce the bug and attach an "after" screenshot.

**No Mac to spare, or a public repo?** Antigravity can also run on a **GitHub-hosted** macOS (or Linux) runner, signed in with a Gemini API key (Step 3c). Nothing to register or keep awake, and each run gets a clean VM; the trade-off is API billing instead of a subscription.

## When to Use

- The team wants reports fixed without anyone opening an agent by hand.
- The app is iOS/macOS (needs Xcode), or the team wants to use its own Claude subscription instead of an API key.
- Trigger phrases: "run the agent automatically", "self-hosted runner for FeedbackKit", "auto-fix feedback", "agent on my Mac".

**Solo developer, no CI?** Skip the runner: `npx feedbackkit-cli watch --project <id>` in the repo does the same on a laptop (Step 7).

## Prerequisites

- The FeedbackKit GitHub App is installed and the project's repo is connected (see `setup-release-loop` Step 2).
- A Mac that stays on, with Xcode (for Apple apps) and Node.
- The `gh` CLI with admin access to the repo, and the Claude Code CLI (`claude`).
- **A private repository**, preferably, for a self-hosted runner. GitHub warns against self-hosted runners on public repos: anyone who can open a PR could try to run code on the Mac. On a public repo, use the GitHub-hosted Antigravity route (Step 3c), or accept the risk only with Step 2b's hook and approval required for outside contributors.
- For the GitHub-hosted route instead of a Mac: a Gemini API key (Google AI Studio). No runner, no Xcode or Claude CLI needed locally.

## Step-by-Step Instructions

### Step 1 -- Inspect

Find the repo (`gh repo view --json nameWithOwner,visibility`), how the app builds (scheme, `xcodegen`, `npm`), and existing workflows. **If the repo is public**, recommend the GitHub-hosted Antigravity route (Step 3c), `feedbackkit watch`, or a private fork instead: GitHub runs a pull request's own workflow files, so anyone who can open a PR can try to run code on a self-hosted runner. If the user still wants their Mac, say that plainly, then require both guards before going on: the job-started hook (Step 2b) and "Require approval for all external contributors" (`gh api -X PUT repos/OWNER/REPO/actions/permissions/fork-pr-contributor-approval -f approval_policy=all_external_contributors`). Tell them never to approve an outside PR's workflow run without reading its `.github/` changes.

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

Prefer a dedicated macOS user for the runner, with no personal credentials in it: report text is untrusted agent input, and that account is the real boundary for whatever the agent can run.

### Step 2b -- Only let the agent workflows use the runner

Do this on every self-hosted runner, private repo or not. A workflow's `if:` can't protect the runner: a pull request (from a fork, or anyone with write access) brings its own workflow files, and one with `runs-on: [self-hosted, feedbackkit-agent]` lands on the Mac. The runner's job-started hook can, because it lives on the Mac: it runs before every job's first step, and a non-zero exit fails the job.

Copy `templates/runner-job-started-hook.sh.template` outside the runner directory (e.g. `~/actions-runner-hooks/feedbackkit-job-started.sh`), replace `__REPO__`, `__DEFAULT_BRANCH__` and `__WORKFLOWS__` (the agent workflow files you add in Step 3/4, e.g. `feedbackkit-agent.yml`), then:

```bash
chmod 755 ~/actions-runner-hooks/feedbackkit-job-started.sh
echo "ACTIONS_RUNNER_HOOK_JOB_STARTED=$HOME/actions-runner-hooks/feedbackkit-job-started.sh" >> ~/actions-runner/.env
cd ~/actions-runner && ./svc.sh stop && ./svc.sh start
```

It allows only the listed workflows as committed on the default branch (a fork PR's run reports `…@refs/pull/<n>/merge` as its workflow ref), only the `issues`, `issue_comment` and `pull_request_target` events, and for `pull_request_target` only branches of the same repository. Check it by hand before relying on it:

```bash
H=~/actions-runner-hooks/feedbackkit-job-started.sh
GITHUB_REPOSITORY=OWNER/REPO GITHUB_WORKFLOW_REF="OWNER/REPO/.github/workflows/<file>@refs/heads/main" GITHUB_EVENT_NAME=issues bash $H; echo $?        # 0
GITHUB_REPOSITORY=OWNER/REPO GITHUB_WORKFLOW_REF="OWNER/REPO/.github/workflows/evil.yml@refs/pull/1/merge" GITHUB_EVENT_NAME=pull_request bash $H; echo $?  # 1
```

The first real run's "Set up job" log shows `Runner policy: allowed (…)`. Adding another workflow to this runner later means adding it to `WORKFLOWS`.

### Step 3 -- Pick the agent

| Agent | Template | How it signs in | How it's fenced |
|---|---|---|---|
| Claude Code | `templates/feedbackkit-agent.yml.template` | `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY` secret | `--allowedTools` in the workflow; FeedbackKit MCP tools through a per-run token |
| Google Antigravity (self-hosted Mac) | `templates/feedbackkit-agent-antigravity.yml.template` | Signed in once, interactively, as the runner's user (uses their Google AI Pro/Ultra subscription) | Allow rules (commands and FeedbackKit MCP tools) in the runner user's Antigravity settings; the agent only edits files, the workflow commits, pushes and opens the PR |
| Google Antigravity (GitHub-hosted) | `templates/feedbackkit-agent-antigravity-hosted.yml.template` | `GEMINI_API_KEY` secret, billed per token to that key's Google project | Allow rules written by the workflow itself (version-controlled); fresh VM per run; FeedbackKit MCP tools through a per-run token |

Use a different dispatch label per agent if the repo has both workflows, or both run.

For **Claude Code**, continue with Step 3a. For **Antigravity on the Mac**, skip to Step 3b. For **Antigravity on GitHub-hosted runners**, skip Step 2 and go to Step 3c.

If the user is choosing between the two Antigravity routes, explain the difference before setting anything up: a Google AI Pro/Ultra subscription only covers the interactive sign-in, so using it means the self-hosted Mac; an API key works anywhere but is billed separately (its free tier has low rate limits, and Google may use free-tier prompts to improve its products — including the code and report text).

### Step 3a -- Give Claude Code credentials

```bash
claude setup-token                      # opens a browser, prints a long-lived token (uses the team's Claude subscription)
gh secret set CLAUDE_CODE_OAUTH_TOKEN   # paste it when prompted
# or, with an API key instead: gh secret set ANTHROPIC_API_KEY
```

Install the Claude GitHub App on the repo (https://github.com/apps/claude). claude-code-action trades the job's `id-token: write` for a short-lived token from that app's installation, and uses it for everything it does on GitHub: the progress comment on the issue, pushing the fix branch, opening the PR (all as `claude[bot]`). It's the same kind of thing as the FeedbackKit GitHub App, with a different job: FeedbackKit's app starts the work (creates the issue, adds the label, receives the webhooks that move the report), Claude's app is how the agent writes its results back. The `claude` login on the runner Mac doesn't replace either the app or the `CLAUDE_CODE_OAUTH_TOKEN` secret: the action installs its own Claude Code and only signs in from its inputs.

Rather not install it? Pass `github_token:` to the action instead:
- `${{ secrets.GITHUB_TOKEN }}`: no setup, but GitHub doesn't start other workflows from its pushes or PRs, so CI won't run on the agent's PR by itself, and comments show as `github-actions[bot]`.
- A token from a GitHub App the team owns (an `actions/create-github-app-token` step): CI runs normally. Never use the FeedbackKit app's private key for this: it would sit in a job where the agent reads untrusted report text, and the agent's pushes would look like FeedbackKit's own.

Optional but recommended: the FeedbackKit MCP tools (claim the report, ask the reporter, attach a preview of the fix). See **The agent-runner token** below.

### Step 3b -- Set up Antigravity on the runner Mac

As the user the runner service runs as:

1. Install the Antigravity CLI and run `agy` once interactively to sign in. Headless runs (`agy -p`) reuse those cached credentials; with none they exit with an auth error.
2. Allow the commands the agent needs in `~/.gemini/antigravity-cli/settings.json`. Antigravity 1.2 reads allow rules only from this global file (not from the repository), and **a denied command ends the whole run** — even `ls` goes through this check — so list read-only commands as well as the build and test tools:

   ```bash
   S=~/.gemini/antigravity-cli/settings.json; [ -f "$S" ] || echo '{}' > "$S"
   jq '.permissions.allow = ((.permissions.allow // []) + [
     "command(ls)", "command(cat)", "command(grep)", "command(find)", "command(head)", "command(tail)", "command(wc)", "command(pwd)",
     "read_url(raw.githubusercontent.com)", "read_url(github.com)", "read_url(*.supabase.co)", "read_url(supabase.co)",
     "command(rg)", "command(sort)", "command(uniq)", "command(diff)", "command(stat)", "command(file)", "command(which)", "command(mkdir)",
     "command(git log)", "command(git show)", "command(git diff)", "command(git status)", "command(git blame)",
     "command(git grep)", "command(git ls-files)", "command(git rev-parse)",
     "command(xcodebuild)", "command(xcrun)", "command(swift)", "command(xcodegen)"
   ] | unique)' "$S" > "$S.tmp" && mv "$S.tmp" "$S"
   ```

   The `read_url` rules let it open the report's screenshot linked from the issue; without them the run stops the moment it tries. Swap the last line for the project's tools (e.g. `command(node)`, `command(npm)` for a web app). Allow only git's read subcommands, as above (agents look up history often, and a denied `git log` ends the run); never plain `command(git)`: the workflow does all commits and pushes. Never use `--dangerously-skip-permissions` here — report text is untrusted input.
3. Optional but recommended — the FeedbackKit MCP tools, so the agent claims the report, can ask the reporter, and attaches a screenshot or short video of the fix (the loop works without them, through the PR's `FeedbackKit:` line). Register the server and allow its tools, then create the agent-runner token (below):

   ```bash
   agy mcp add feedbackkit -- npx -y feedbackkit-cli@latest mcp   # as the runner's user
   jq '.permissions.allow = ((.permissions.allow // []) + [
     "mcp(feedbackkit/claim_feedback)", "mcp(feedbackkit/post_update)", "mcp(feedbackkit/ask_reporter)",
     "mcp(feedbackkit/attach_preview)", "mcp(feedbackkit/get_feedback)", "mcp(feedbackkit/get_prompt)"
   ] | unique)' "$S" > "$S.tmp" && mv "$S.tmp" "$S"
   ```

   MCP calls need allow rules like commands do, one per tool as `mcp(<server>/<tool>)` (`mcp(feedbackkit/*)` allows them all; a bare `mcp(feedbackkit)` matches nothing). Leave out `update_feedback_status` and `link_fix`: the workflow links the fix itself.
4. Copy `templates/feedbackkit-agent-antigravity.yml.template` to `.github/workflows/feedbackkit-agent-antigravity.yml` and replace `__DISPATCH_LABEL__` (e.g. `antigravity`) and `__CI_WORKFLOWS__` with the repository's CI workflow files (e.g. `ci.yml`; add `workflow_dispatch:` to each if missing, since a PR opened by the run's own token doesn't start workflows by itself — or leave it empty), and `__MAIN_WORKFLOWS__` with the workflows a push to the default branch runs (CI and the beta/release workflow, each with `workflow_dispatch:`; or leave it empty). With the project's delivery mode set to **Batch** (Settings → Delivery), the workflow pushes the fix straight to the default branch, and a push with the run's own token starts no workflows either, so it dispatches those. Under **Branch previews**, or when branch protection refuses the push, it opens a PR instead. The checkout keeps no credentials (`persist-credentials: false`), so only the workflow's own step can push.
5. The workflow opens the pull request with the run's own token, which GitHub blocks unless the repository allows it: **Settings → Actions → General → Workflow permissions → "Allow GitHub Actions to create and approve pull requests"**. Ask the user before turning it on (it also lets any workflow approve PRs). If they say no, the run still pushes its branch and fails at the last step; they open the PR from that branch by hand.

Then continue at Step 5.

### Step 3c -- Antigravity on GitHub-hosted runners

No runner to register (skip Step 2). Each run installs `agy` with the official installer (`curl -fsSL https://antigravity.google/cli/install.sh | bash`), writes its settings, and signs in with an API key.

1. Create a Gemini API key in Google AI Studio, **in a Google project used only for this**, and set a spending cap on it. The agent can read its own environment, so a malicious report could try to get it to send the key somewhere; a dedicated, capped key limits what that costs.
2. Store it: `gh secret set GEMINI_API_KEY` (paste when prompted). Only the workflow's "Run Antigravity" step receives it.
3. Copy `templates/feedbackkit-agent-antigravity-hosted.yml.template` to `.github/workflows/feedbackkit-agent-antigravity-hosted.yml` and replace:
   - `__DISPATCH_LABEL__` (e.g. `antigravity`),
   - `__RUNNER__`: `macos-15` to build an iOS/macOS app, `ubuntu-latest` for a web app (cheaper and faster; GitHub-hosted runners are free on public repos),
   - `__CI_WORKFLOWS__` and `__MAIN_WORKFLOWS__` as in Step 3b.
4. Edit the allow list in the workflow's **Configure Antigravity** step: it starts with read-only commands, read-only git and the Apple build tools; swap the last line for the project's tools (e.g. `command(npm)`, `command(node)` for a web app). Same rules as Step 3b: never plain `command(git)`, never `--dangerously-skip-permissions`. The settings need `"modelProvider": "gemini"`; the key alone does nothing.
5. The same repository setting as Step 3b's item 5 (Actions may create pull requests), asked the same way.

For the FeedbackKit MCP tools, create the agent-runner token (below); the workflow registers the MCP server and its allow rules itself. Without it the loop still closes through the PR's `FeedbackKit:` line.

Then continue at Step 5.

### The agent-runner token (every route)

The FeedbackKit MCP tools need to act on the report. No login on the runner: store an **Agent runner** access token as a secret, and each workflow run trades it for a token limited to that run's report (every report, for an issue that merges several, so each update lands on its own report) that expires in 90 minutes (`feedbackkit token issue`). Only that run token reaches the agent, so a report that talks the agent into leaking it exposes one report for an hour, not the project.

```bash
npx feedbackkit-cli token create agent-runner --preset agent --project <project-id> | gh secret set FEEDBACKKIT_AGENT_TOKEN
```

(Or project Settings → **Access tokens** → **Agent runner**.) The preset's scopes: read reports, work on them (claim, progress, link — never verify), ask the reporter, attach previews, and issue run tokens. Every template already has the "Issue a FeedbackKit token for this report" step; it's skipped while the secret isn't set.

**Previews of the fix:** when the agent can run the fixed app (the iOS Simulator on a Mac runner; a browser for a web app), it captures the screen the reporter showed and calls `attach_preview` with a screenshot or a short video (MP4, up to 30 s and 20 MB). The team sees it in the report's **After** view in the dashboard and the Portal, next to the reporter's original and annotated screenshots. Previews are deleted 14 days after the report resolves (90 days at most). For iOS, allow `xcrun` (Claude: `Bash(xcrun simctl:*)`, already in the template) so it can run `xcrun simctl io booted screenshot`.

### Step 4 -- Add the Claude Code workflow

Copy `templates/feedbackkit-agent.yml.template` to `.github/workflows/feedbackkit-agent.yml`, replace `__DISPATCH_LABEL__` (e.g. `claude`) and `__CI_WORKFLOWS__` (as in Step 3b), and widen `--allowedTools` only as far as the build needs (e.g. `Bash(npm ci:*),Bash(npm test:*)` for a web app). A rule matches the start of the command, so allow the exact form the agent will type (`npm --prefix web …` doesn't match `Bash(npm test:*)`); the workflow's system prompt already tells it to use relative paths from the repository root. Keep `allowed_bots: feedbackkit-app`: the label is added by FeedbackKit's GitHub App, and claude-code-action refuses bot-triggered runs otherwise.

claude-code-action only pushes a branch and links "Create PR", so the workflow's last step opens the PR (with `Fixes #N` and the `FeedbackKit:` lines) using the run's own token. That needs the same repository setting as Step 3b's item 5, asked the same way.

### Step 5 -- Point FeedbackKit at it

Dashboard → project **Settings → Coding agent loop** → dispatch labels = the same label. From then on, **Send to agent** on a report (and a reporter's "still broken") starts a run.

### Step 6 -- Tell the user what's guarded

- Only people with write access, or FeedbackKit's app, can add the label.
- The runner only runs the agent workflows from the default branch (Step 2b's hook), so a pull request's own workflow files can't reach the Mac.
- Report text is written by app users. It reaches the agent as issue text, so a malicious report could try to steer it. The allowed-tools list is the fence: no credentials on the runner beyond what the build needs, and under Branch previews the agent opens a PR — it never merges. Under Batch delivery the Antigravity workflows push the fix straight to the default branch, so a report's fix ships without review: tell the user, and suggest branch protection on the default branch (the workflow then opens a PR instead) or Branch previews if they want a person to review every fix. Say plainly that allowing an interpreter or package manager (`node`, `npm`, `python`, `swift` running scripts) lets the agent run any code and reach the network through it (Antigravity has been seen running `node -e "fetch(...)"` to download assets), so on a Mac that holds personal credentials the real boundary is the runner's user account.
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
- **Antigravity PRs and CI**: they're opened with the job's `GITHUB_TOKEN`. On repos that require approval for outside contributors, their `pull_request` runs wait at "action_required" (the workflow approves them); elsewhere they don't start at all (the workflow dispatches `__CI_WORKFLOWS__`). FeedbackKit's webhook sees the PR either way and links the fix.
- **Antigravity "failed before finishing" with an `AGY_ERROR`**: an API or sign-in error, which agy reports with exit code 0 (the workflow checks for it). Self-hosted: the runner user's sign-in expired, run `agy` once interactively. Hosted: the `GEMINI_API_KEY` secret is missing, invalid or out of quota.
- **Code signing:** the runner service can't unlock the login keychain. Build for the Simulator with `CODE_SIGNING_ALLOWED=NO`.
- **"Refused by runner policy"** in a job's setup log = the job-started hook (Step 2b) blocked it: a workflow not in its `WORKFLOWS` list, a run from a branch other than the default (including any PR's own workflow), or a PR from a fork. Add the workflow to the hook if it's meant to run there.
- **Runner offline:** a Mac that sleeps drops the runner; jobs wait in the queue until it's back. Disable sleep (System Settings → Energy) on a dedicated machine.
- **Both triggers set:** if the project also has a trigger comment containing `@claude`, one dispatch starts two runs — the `concurrency` group cancels the older one, but pick one trigger.
- **Label re-dispatch:** FeedbackKit removes and re-adds the label on reopen so `labeled` fires again; don't add a workflow step that removes it.
