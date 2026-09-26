---
name: promote-release
description: Help the app owner decide which beta build is ready for production using FeedbackKit's release readiness (fixes verified by the people who reported them, still awaiting them, or reopened as still broken), dig into anything blocking, and record the promotion after the owner releases it in App Store Connect or wherever they ship.
---

# promote-release

In FeedbackKit's loop, every push ships a beta and each fix in it goes back to the person who reported it, who confirms it on their own device. This skill is the last step: turning that evidence into a promote / don't-promote call, and recording the result. **Promotion itself is the owner's action** in App Store Connect (or their release tool). The agent informs it and records it, but never does it for them.

## When to Use

- "Which beta can we ship?", "is build N ready for the App Store?", "what's blocking the release?"
- After promoting in App Store Connect: "mark build N as released".
- No CI announcing builds yet, and the team wants to announce one by hand.

## Prerequisites

- FeedbackKit CLI logged in (`npx feedbackkit-cli login`), and/or the FeedbackKit MCP server connected (`list_releases`, `get_feedback`, `list_feedback` tools).
- Builds are being announced (see the `setup-release-loop` skill). If `releases` lists nothing, go to "No releases yet" below.

## Step-by-Step Instructions

### Step 1 -- Read readiness

Run `npx feedbackkit-cli releases` (add `--json` to parse it), or call the MCP tool `list_releases`. Each release has a verdict:

| Verdict | Meaning |
|---|---|
| `ready` | Every fix in the build was verified by its reporter. |
| `waiting` | Some reporters haven't opened the build / answered yet. |
| `blocked` | At least one reporter said the fix **didn't work** (reopened). |
| `no_fixes` | The build carries no reported fixes. Promote it on its other merits. |
| `production` | Already promoted. |

Also note `unreachable`: fixes whose reports came from an old SDK without a reporter id. Nobody will verify those on device, so they need a human check.

### Step 2 -- Explain what's blocking or pending

- **Blocked:** for each reopened report, call `get_feedback` (MCP) or `npx feedbackkit-cli timeline <id>`. Summarize what the reporter says is still wrong. Their newest screenshot and comment are in the timeline. Recommend fixing it (the `fix-feedback` skill) before promoting, or promoting anyway only if the reopened issue is minor and unrelated to the build's other changes.
- **Waiting:** say how many fixes are unverified and how old the build is. Reporters verify when they next open that build; a day or two is normal. Offer to nudge by posting a note to the reporter (`post_update` with `notify_reporter: true`) on the waiting reports.
- **Unreachable fixes:** list them so the owner can check those manually.

### Step 3 -- Recommend

Give one clear recommendation: which build to promote (usually the newest `ready` beta), or what has to happen first. Newer builds contain older fixes, so the newest `ready` build is the one to ship. Don't promote an older one just because it's greener.

### Step 4 -- The owner promotes

The owner submits/releases that build in App Store Connect (TestFlight builds keep their build number when promoted), publishes the release, or deploys. Wait for them to confirm it's done. Don't mark anything released first.

### Step 5 -- Record the promotion

```bash
npx feedbackkit-cli promote --build <n> [--product <key>]
```

(or **Mark as released** on the dashboard's Releases tab). This moves the release to the production channel and adds a "released to production" entry to every fixed report's timeline. Production users who reported those bugs are asked "is it fixed?" once they update, because the build number is the same.

## No releases yet

If nothing is announced yet, the build pipeline isn't calling FeedbackKit. Set it up with the `setup-release-loop` skill. To announce one build by hand, from the repo at the commit the build was made from:

```bash
npx feedbackkit-cli release --build <n> --dry-run   # what would ship, and why others are skipped
npx feedbackkit-cli release --build <n>             # record it (add --channel production if it went straight to users)
```

## Verification

- `npx feedbackkit-cli releases` shows the promoted build as `production`.
- A fixed report's timeline (`npx feedbackkit-cli timeline <id>`) ends with "Released to production".
