---
name: setup-release-loop
description: Wire a repository's release pipeline into FeedbackKit's closed loop — connect GitHub so fix commits and PRs link to reports, hand new issues to a coding agent, create a release token for CI, announce every build (beta or production) so reporters get asked "is it fixed?", fix build numbering, and optionally ship a beta on every push to main.
---

# setup-release-loop

The app side of FeedbackKit's loop (`enableFixVerification` in the SDK setup skills) asks a reporter "is it fixed?" — but only once FeedbackKit knows **which build contains the fix**. This skill wires up the repository side:

```
fix commit on main (FeedbackKit: <id> trailer) ──▶ report "merged"
release pipeline builds N ──▶ feedbackkit release --build N ──▶ report "shipped in N"
reporter opens build ≥ N ──▶ "is it fixed?" ──▶ verified / reopened (back to the agent)
owner promotes a verified beta ──▶ feedbackkit promote --build N
```

## When to Use

- The app already sends reports to FeedbackKit and the team wants fixes to flow back to reporters.
- Setting up CI/CD (TestFlight, App Store, a DMG, a web deploy) for an app that uses FeedbackKit.
- Moving to "agents push to main, every push is a beta, the owner promotes to production".
- Trigger phrases: "close the loop", "announce builds to FeedbackKit", "set up the beta pipeline", "FeedbackKit release token", "reporters never get asked if it's fixed".

## Prerequisites

- The app integrates the FeedbackKit SDK with fix verification enabled (see `setup-ios-sdk` / `setup-macos-sdk` / `setup-watchos-sdk` / `setup-web-sdk`).
- The FeedbackKit CLI, logged in (`npx feedbackkit-cli login`), and the project id (`npx feedbackkit-cli projects`).
- For GitHub steps: the `gh` CLI, authenticated, with admin access to the repo.

## Step-by-Step Instructions

### Step 1 -- Inspect the release setup

Find how builds ship today before changing anything:
- **CI:** `.github/workflows/*.yml`, `fastlane/Fastfile`, `ci_scripts/` (Xcode Cloud), `bitrise.yml`, `.gitlab-ci.yml`, or a release script under `scripts/`.
- **Build numbers:** where `CFBundleVersion` / `CURRENT_PROJECT_VERSION` comes from (for XcodeGen, `project.yml` `info.properties`; for Xcode, the target's build settings; fastlane `increment_build_number`).
- **Upload:** App Store export options (`ExportOptions.plist`, fastlane `upload_to_testflight`), DMG/notarization, or the web deploy step.

Summarize what you found for the user in two or three lines, then continue.

### Step 2 -- Connect GitHub (fix linking + agent hand-off)

In the FeedbackKit dashboard → project **Settings**:
1. **GitHub Integration:** install the FeedbackKit GitHub App on the repo and connect it (`owner/repo`).
2. Make sure the App's webhook receives **`push`**, **`pull_request`** and **`issues`** events. On a self-hosted backend, the `github-webhook` function also needs `GITHUB_WEBHOOK_SECRET` set to the App's webhook secret (it rejects unsigned deliveries).
3. **Coding agent loop:** set dispatch labels (e.g. `claude` for claude-code-action's `label_trigger`) and/or a trigger comment. New GitHub issues get them, and a reporter's "still broken" re-applies them.

From then on, a commit on the default branch whose message ends with the trailer below links the fix automatically (a PR description with the same line works too):

```
FeedbackKit: <feedback id>
FeedbackKit-Summary: One plain-language sentence the reporter will see.
```

If the repo uses the `fix-feedback` agent skill, agents already write this trailer.

### Step 3 -- Make build numbers real and increasing

Fix verification compares the build on the reporter's device with the build the fix was announced in, so:
1. **Increasing and numeric:** use a UTC timestamp, `date -u +%Y%m%d%H%M`, as the build number in every pipeline (beta and production alike, so they order correctly).
2. **Actually in the binary:**
   - XcodeGen: add to each app target's `info.properties`:
     ```yaml
     CFBundleShortVersionString: "$(MARKETING_VERSION)"
     CFBundleVersion: "$(CURRENT_PROJECT_VERSION)"
     ```
     Without this XcodeGen writes a literal `1` / `1.0`, so `xcodebuild … CURRENT_PROJECT_VERSION=<n>` never reaches the app.
   - Xcode project: `CFBundleVersion` in Info.plist should be `$(CURRENT_PROJECT_VERSION)`.
   - fastlane: `increment_build_number(build_number: <timestamp>)`.
3. **Not renumbered on upload:** in App Store / TestFlight `ExportOptions.plist` add
   ```xml
   <key>manageAppVersionAndBuildNumber</key>
   <false/>
   ```
   (fastlane: `export_options: { manageAppVersionAndBuildNumber: false }`).

A TestFlight build promoted to the App Store keeps its number, so production users who reported the bug are asked too.

### Step 4 -- Create a release token for CI

CI has no FeedbackKit login; it uses a project release token. Tokens are hash-only and revocable, and can only list waiting fixes, record releases and promote builds. Create one and store it as a CI secret in one go:

```bash
npx feedbackkit-cli token create github-actions --project <project-id> | gh secret set FEEDBACKKIT_RELEASE_TOKEN
```

(Or project Settings → **Release tokens** in the dashboard, which shows the token once.) Self-hosted backend: also set `FEEDBACKKIT_API_URL` (the Supabase project URL) as a CI variable.

### Step 5 -- Announce every build

Copy `templates/feedbackkit_announce.sh.template` to `scripts/feedbackkit_announce.sh` (`chmod +x`), and call it at the **end** of each release job, after the upload succeeded:

```bash
./scripts/feedbackkit_announce.sh "$BUILD_NUMBER" --channel beta          # TestFlight / internal builds
./scripts/feedbackkit_announce.sh "$BUILD_NUMBER" --channel production    # a build that goes straight to users
# multi-app repos: add --product <key> (the product key reports are filed under)
```

It runs `feedbackkit release`, which marks every merged fix whose commit is an ancestor of `HEAD` as shipped in that build. It never fails the job: the build already shipped, and a missed announcement can be rerun by hand.

For GitHub Actions, the job also needs:
- `actions/checkout` with `fetch-depth: 0` (the ancestry check needs history),
- `env: FEEDBACKKIT_RELEASE_TOKEN: ${{ secrets.FEEDBACKKIT_RELEASE_TOKEN }}` on the step,
- Node available (`actions/setup-node`), since the script uses `npx feedbackkit-cli`.

Other CI (fastlane, Xcode Cloud, Bitrise): the same script works anywhere with git, Node and the token in the environment. In fastlane, call it with `sh("../scripts/feedbackkit_announce.sh", build_number.to_s, "--channel", "beta")` after `upload_to_testflight`.

### Step 6 -- Optional: a beta on every push to main

For the push-to-main workflow, copy `templates/beta.yml.template` to `.github/workflows/beta.yml`, replace `__APP_SCHEME__` / `__APP_SOURCE_DIR__`, and swap its example upload step for the project's real one:
- `on: push` to `main`, with `paths:` limited to app code.
- A **test job that gates everything**: no beta without green tests.
- A build job per app that uploads (TestFlight, prerelease, preview deploy) and then runs the announce script with `--channel beta`.
- `concurrency` with `cancel-in-progress: true`, so a newer push supersedes a beta still building.

If the repo already has a release workflow, prefer calling it from `beta.yml` via `workflow_call` over duplicating the build steps. If release workflows trigger on `release: published`, make them skip prerelease tags you create for betas.

### Step 7 -- Tell the owner how promotion works

Production stays a human decision. The owner:
1. Checks readiness: the dashboard's **Releases** tab, or `npx feedbackkit-cli releases` (verdicts: ready / waiting / blocked by a reopened fix).
2. Promotes the build in App Store Connect (or publishes the release / deploys).
3. Records it: **Mark as released** in the dashboard, or `npx feedbackkit-cli promote --build <n>`.

The `promote-release` skill walks through this.

## Verification

1. `npx feedbackkit-cli release --build 1 --dry-run` in the repo prints the merged fixes it would ship (and why others are skipped), without writing anything.
2. After the next real build, `npx feedbackkit-cli releases` lists it; a report whose fix it contained shows **Shipped** in the dashboard.
3. On a device running that build, the reporter's app shows the "is it fixed?" card. If not, compare the app's `CFBundleVersion` with the announced build (Step 3).

## Non-Obvious Pitfalls

- **Wrong build number in the binary** is the #1 reason reporters are never asked (Step 3). Check the installed app's `CFBundleVersion`, not the one in the script.
- **Shallow checkouts:** `fetch-depth: 1` makes every fix commit "not found locally", so nothing ships. Use `fetch-depth: 0`.
- **The token is per project.** A repo with apps in two FeedbackKit projects needs two tokens (and two secrets).
- **Only merged fixes ship.** A report is "merged" once its fix commit reaches the default branch (trailer or `Fixes #n`), its PR merges, or someone runs `feedbackkit link <id> --commit <sha>`.
- **Web builds:** a git SHA as `appBuild` doesn't order, so a fix counts as live as soon as the deploy is announced. That's correct for sites replaced on deploy, but announce *after* the deploy finishes, not before.
