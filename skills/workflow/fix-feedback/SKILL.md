---
name: fix-feedback
description: Fix a user-reported bug from FeedbackKit end to end — pull the report (annotated screenshot, logs, reporter's replies) over MCP, claim it, reproduce, fix, attach an after-fix screenshot, and link the PR/commit so the fix ships back to the reporter's device for verification. Also handles reports the reporter reopened as still broken.
---

# fix-feedback

Closes the loop on a FeedbackKit report: the person who reported the bug gets asked "is it fixed?" on their own device once your fix ships, and if they say no, the report comes back to you with a fresh screenshot. This skill is the agent's half of that loop.

## When to Use

- The user asks to fix a FeedbackKit report, or "work through the feedback inbox".
- A report was reopened (the reporter says the previous fix didn't work).
- Trigger phrases: "fix the latest feedback", "fix feedback <id>", "what did users report", "handle reopened feedback".

## Prerequisites

- FeedbackKit MCP server connected (`feedbackkit mcp`, scoped with `--project <id>` ideally). If the tools aren't available, set it up with the `setup-mcp-server` skill first.
- For Apple platforms, XcodeBuildMCP (or iOS Simulator MCP) lets you reproduce and verify in a simulator. For web, a browser tool (e.g. Playwright MCP).

## Step-by-Step Instructions

### Step 1 -- Pick the report

- Specific id → use it.
- Otherwise call `list_feedback` with `fix_stage: "reopened"` first (reporters waiting on a fix that didn't work), then `status: "new"`. Prefer reopened ones.

### Step 2 -- Read everything about it

Call `get_feedback` with the id. It returns:
- the report JSON (text, environment: screen/device/OS/app build, web page URL + console/network logs),
- the **annotated screenshot as an image** — the reporter's drawings mark exactly what's wrong; look at it,
- the **timeline**: earlier attempts, PRs, the reporter's replies,
- for reopened reports, the **reporter's latest screenshot** showing what still looks wrong.

Then call `get_prompt` for the project's prompt template plus loop instructions.

### Step 3 -- Claim it

Call `claim_feedback` with a one-line plan (e.g. "Likely a missing safe-area inset in CheckoutView"). This tells the team (and the dashboard) an agent is on it.

### Step 4 -- Ask only if you must

If something only the reporter can answer blocks you (which device, which account state, what they expected), call `ask_reporter` with one short, plain-language question. It appears in the app on their device; their answer shows up in the timeline (`get_feedback`). Don't ask things the screenshot, logs, or code already answer. Continue with your best interpretation while waiting if you reasonably can.

### Step 5 -- Reproduce, then fix

1. Find the screen from `environment.screenName` (iOS/macOS) or `environment.pageUrl` (web).
2. If you can run the app, reproduce the bug first (XcodeBuildMCP: build + launch in a simulator, navigate, screenshot; web: open the page).
3. Make the minimal, style-consistent fix. For reopened reports, read what the previous fix changed (timeline → PR) and why it didn't cover the reporter's case before changing anything.
4. Run the project's tests/build.

### Step 6 -- Prove it

If you can run the app, screenshot the fixed screen (same state the reporter showed) to a PNG and call `attach_after_screenshot` with its absolute path and a short caption. Reviewers see it side by side with the reporter's screenshot.

### Step 7 -- Link the fix

- **Opening a PR:** put this line in the PR description — FeedbackKit's GitHub webhook links the PR and tracks it to merge automatically:
  ```
  FeedbackKit: <feedback id>
  ```
- **Committing directly (no PR):** call `link_fix` with `commit_sha`.
- Either way, you may call `link_fix` with a `summary` — one plain-language sentence the **reporter** will see ("The checkout button is no longer hidden behind the keyboard."). No jargon, no file names.

Optionally call `post_update` with `notify_reporter: true` for a short friendly note to the reporter; use `notify_reporter: false` for technical notes to the team.

### Step 8 -- Don't close it yourself

Do **not** mark the report resolved. Once the fix is merged, the team's release step (`feedbackkit release --build <n>`) marks it shipped, and the reporter confirms on their device — that's what resolves it. `update_feedback_status` is only for non-code outcomes (e.g. `wont_fix` when the user asked for something out of scope — explain why with `post_update`).

## Verification

- `get_feedback` timeline shows your `claimed`, optional `after_screenshot`, and a `pr_opened`/`pr_merged` entry.
- The PR description contains `FeedbackKit: <id>` (or `link_fix` was called).
- The report is **not** marked resolved by you.
