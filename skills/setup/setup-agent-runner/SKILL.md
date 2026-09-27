---
name: setup-agent-runner
description: Run a coding agent automatically on FeedbackKit reports, on the team's own Mac — register a self-hosted GitHub Actions runner, add a workflow that starts Claude Code when FeedbackKit labels an issue, and let the agent build the app, run it in the Simulator and open a PR that closes the loop back to the reporter. Also covers the lighter `feedbackkit watch` alternative for solo developers.
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

### Step 3 -- Give the agent credentials

```bash
claude setup-token                      # opens a browser, prints a long-lived token (uses the team's Claude subscription)
gh secret set CLAUDE_CODE_OAUTH_TOKEN   # paste it when prompted
# or, with an API key instead: gh secret set ANTHROPIC_API_KEY
```

Install the Claude GitHub App on the repo (https://github.com/apps/claude) — the action uses it to push branches and open PRs.

Optional but recommended: on the runner Mac, `npx feedbackkit-cli login` as the runner's user. The workflow then gives the agent the FeedbackKit MCP tools (claim the report, ask the reporter, attach an "after" screenshot).

### Step 4 -- Add the workflow

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
- **Code signing:** the runner service can't unlock the login keychain. Build for the Simulator with `CODE_SIGNING_ALLOWED=NO`.
- **Runner offline:** a Mac that sleeps drops the runner; jobs wait in the queue until it's back. Disable sleep (System Settings → Energy) on a dedicated machine.
- **Both triggers set:** if the project also has a trigger comment containing `@claude`, one dispatch starts two runs — the `concurrency` group cancels the older one, but pick one trigger.
- **Label re-dispatch:** FeedbackKit removes and re-adds the label on reopen so `labeled` fires again; don't add a workflow step that removes it.
