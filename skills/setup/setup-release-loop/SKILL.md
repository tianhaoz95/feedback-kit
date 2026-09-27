---
name: setup-release-loop
description: Wire a repository's release pipeline into FeedbackKit's closed loop, after asking how the team delivers fixes — batch (fixes merge and ship together in a beta, then the owner promotes it) or branch previews (each fix is checked on a preview build of its pull request before merging, gated by a FeedbackKit status check). Connects GitHub, creates a CI release token, announces builds so reporters get asked "is it fixed?", fixes build numbering, and installs the beta or preview workflow for the chosen mode.
---

# setup-release-loop

The app side of FeedbackKit's loop (`enableFixVerification` in the SDK setup skills) asks a reporter "is it fixed?" — but only once FeedbackKit knows **which build contains the fix**. This skill wires up the repository side, in one of two delivery modes the user chooses (Step 0):

```
Batch
  fix commit on main (FeedbackKit: <id>) ──▶ "merged"
  beta build N ──▶ feedbackkit release --build N --channel beta ──▶ "shipped in N"
  reporter (or team) confirms on the beta ──▶ verified / reopened
  owner promotes a verified beta ──▶ feedbackkit promote --build N

Branch previews
  pull request (FeedbackKit: <id> in the description) ──▶ "PR open"
  preview build N of the PR ──▶ feedbackkit release --build N --channel preview --pr <n> ──▶ "shipped in N"
  tester / QA / reporter confirms on the preview ──▶ verified ──▶ the PR's "FeedbackKit" check passes ──▶ merge
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

### Step 0 -- Ask how the team delivers fixes (before changing anything)

Do not create or edit anything until the user has chosen a mode and agreed to the plan. Explain both modes in detail first, in your own words but covering every point below, then ask. Use your question tool if you have one (e.g. `AskUserQuestion` in Claude Code); otherwise ask in chat and wait for the answer.

**Batch** (the default, suits small or solo teams):
- Coding agents may commit fixes straight to the main branch (or open PRs someone merges). A fix counts as done-for-now once it's merged.
- A beta build of main ships every merged fix in it together, on every push or on a schedule (e.g. every 4 hours). The beta goes to TestFlight / a prerelease / a staging deploy.
- Reporters who chose "Notify me when it's fixed" confirm on the beta; for the rest the team uses *Mark verified* in the dashboard.
- The owner promotes a beta to production when the Releases tab says its fixes are verified.
- What this skill installs: a `beta.yml` workflow that tests, builds, uploads and announces each beta.
- Trade-off: fixes are verified after they're on main, so main can briefly contain a fix that turns out not to work (the report reopens and goes back to the agent).

**Branch previews** (suits larger teams with testers or QA, or a main branch that must stay releasable):
- Coding agents always open a pull request and never push to main. Their prompts say so once the mode is set.
- CI builds a preview of each PR — a TestFlight build for internal testers, or a preview deploy of the website — and announces it with `--channel preview --pr <n>`.
- A tester, QA, the team (*Mark verified*), or the reporter if they can install the preview, checks the fix on the preview.
- A "FeedbackKit" status check on the PR stays pending until every report it fixes is verified, and fails while one is reopened. Branch protection can require it, so nothing merges unverified.
- What this skill installs: a `preview.yml` workflow on pull requests, the GitHub App permission for commit statuses, and (with the user's OK) the required status check on the main branch.
- Trade-off: each fix needs a preview build and someone to check it, and the app's public users usually can't install previews, so the check before merging is typically done by the team, not the original reporter.

Then ask:
1. **Which mode?** Batch or Branch previews.
2. For **Batch**: a beta on **every push to main**, or **on a schedule** (ask how often, e.g. every 4 hours)?
3. For **Branch previews**: where do previews go — **TestFlight internal testers**, a **web preview deploy** (which host?), or both — and should the "FeedbackKit" check be **required** on the main branch?

**Present the plan and get a yes before continuing:** list the files you'll add or change, the secrets and GitHub settings you'll touch, and the dashboard setting you'll change. Then set the mode on the project (the same as Settings → Delivery in the dashboard):

```bash
npx feedbackkit-cli delivery batch  --project <project-id>    # or: delivery branch
```

Follow the steps below; the ones marked *(Batch)* or *(Branch)* apply only to that mode.

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
3. **Coding agent loop:** set dispatch labels (e.g. `claude` for claude-code-action's `label_trigger`, whose workflow needs `allowed_bots: feedbackkit-app` because FeedbackKit's app adds the label) and/or a trigger comment, or tick *Assign to GitHub Copilot*. New GitHub issues get them, and a reporter's "still broken" re-applies them. To run the agent on a Mac that can build the app, use the `setup-agent-runner` skill.

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

**Deploys CI doesn't run.** A site deployed by the host's own Git integration (Cloudflare Workers/Pages Builds, Netlify, Vercel) has no release job to put the script in, so check for one explicitly (`wrangler.toml`/`wrangler.jsonc`, `netlify.toml`, `vercel.json`, a host check run on recent commits) — otherwise its fixes stay "merged" forever. Copy `templates/announce-deploy.yml.template` to `.github/workflows/announce-deploy.yml`: on each push it waits for the host's check run on that commit to succeed, then announces. Fill in the check run name (`gh api repos/<owner>/<repo>/commits/<sha>/check-runs --jq '.check_runs[].name'`), and use the same build id the web SDK reports as `appBuild` (usually the short SHA). Hosts that post GitHub *deployments* instead of check runs (Vercel) can trigger on `deployment_status` with `github.event.deployment_status.state == 'success'`. If one site serves several products, announce once per `--product`.

Other CI (fastlane, Xcode Cloud, Bitrise): the same script works anywhere with git, Node and the token in the environment. In fastlane, call it with `sh("../scripts/feedbackkit_announce.sh", build_number.to_s, "--channel", "beta")` after `upload_to_testflight`.

### Step 6a -- (Batch) A beta on every push, or on a schedule

Copy `templates/beta.yml.template` to `.github/workflows/beta.yml`, replace `__APP_SCHEME__` / `__APP_SOURCE_DIR__`, and swap its example upload step for the project's real one:
- `on: push` to `main`, with `paths:` limited to app code — or, for a rolling batch, replace `push` with `schedule: - cron: "0 */4 * * *"` (the cadence the user chose) and keep `workflow_dispatch` for an on-demand beta.
- A **test job that gates everything**: no beta without green tests.
- A build job per app that uploads (TestFlight, prerelease, preview deploy) and then runs the announce script with `--channel beta`.
- `concurrency` with `cancel-in-progress: true`, so a newer push supersedes a beta still building.

If the repo already has a release workflow, prefer calling it from `beta.yml` via `workflow_call` over duplicating the build steps. If release workflows trigger on `release: published`, make them skip prerelease tags you create for betas.

### Step 6b -- (Branch) A preview of every pull request, and the merge check

1. Copy `templates/preview.yml.template` to `.github/workflows/preview.yml`, replace `__APP_SOURCE_DIR__`, and fill in the build-and-upload step for where the user said previews go:
   - **TestFlight internal testers:** the same archive/upload as a beta, with a timestamp build number; testers in an *internal* group get every build without review.
   - **Web preview deploys:** if the host deploys previews itself (Vercel, Netlify, Cloudflare), announce after its preview deployment succeeds instead — like `templates/announce-deploy.yml.template`, but triggered by the PR and passing `--channel preview --pr <n>`, with the build id the web SDK reports on the preview.
   The announce step is `feedbackkit release --build <n> --channel preview --pr ${{ github.event.pull_request.number }}`. It ships every report linked to that PR.
2. The FeedbackKit GitHub App needs **Commit statuses: Read and write** to post the check. Whoever owns the App changes it (GitHub → Settings → Developer settings → GitHub Apps → the FeedbackKit App → Permissions → Repository permissions → Commit statuses), and each installation then accepts the new permission. Tell the user; you can't do this for them.
3. If the user wants the check **required**: GitHub → the repo → Settings → Branches → the main branch's rule → *Require status checks to pass* → add **FeedbackKit**. With `gh`, only when a protection rule already exists:
   ```bash
   gh api -X POST repos/OWNER/REPO/branches/main/protection/required_status_checks/contexts -f 'contexts[]=FeedbackKit'
   ```
   The check first appears on a PR after its first event in branch mode; GitHub only offers checks it has seen, so open or update a PR before adding it in the UI.

### Step 7 -- Tell the owner how it runs day to day

**(Branch)** Merge a PR once its FeedbackKit check is green (every linked report verified on a preview). Production builds come from main as usual; announcing them is still useful for the Releases tab, but the reports are already verified.

**(Batch)** Production stays a human decision. The owner:
1. Checks readiness: the dashboard's **Releases** tab, or `npx feedbackkit-cli releases` (verdicts: ready / waiting / blocked by a reopened fix).
2. Promotes the build in App Store Connect (or publishes the release / deploys).
3. Records it: **Mark as released** in the dashboard, or `npx feedbackkit-cli promote --build <n>`.

The `promote-release` skill walks through this.

## Verification

- `npx feedbackkit-cli delivery` prints the mode the user chose.
- **(Branch)** On the next PR an agent opens for a report, the PR shows a pending **FeedbackKit** check; after the preview build, `npx feedbackkit-cli releases` lists a *Preview · PR #n* release; after the report is verified, the check turns green.

0. `gh secret list` shows `FEEDBACKKIT_RELEASE_TOKEN`. Without it the announce script prints "Skipping FeedbackKit announcement" and exits 0 — the pipeline stays green and nothing ships.

1. `npx feedbackkit-cli release --build 1 --dry-run` in the repo prints the merged fixes it would ship (and why others are skipped), without writing anything.
2. After the next real build, `npx feedbackkit-cli releases` lists it; a report whose fix it contained shows **Shipped** in the dashboard.
3. On a device running that build, the reporter's app shows the "is it fixed?" card. If not, compare the app's `CFBundleVersion` with the announced build (Step 3).

## Non-Obvious Pitfalls

- **(Branch) No check on the PR:** the project is still in batch mode (`feedbackkit delivery`), the PR has no linked report (its description lacks `FeedbackKit: <id>`), or the GitHub App lacks *Commit statuses* permission.
- **(Branch) Fork PRs** don't receive repository secrets, so their previews can't be announced with the release token.

- **Wrong build number in the binary** is the #1 reason reporters are never asked (Step 3). Check the installed app's `CFBundleVersion`, not the one in the script.
- **Shallow checkouts:** `fetch-depth: 1` makes every fix commit "not found locally", so nothing ships. Use `fetch-depth: 0`.
- **The token is per project.** A repo with apps in two FeedbackKit projects needs two tokens (and two secrets).
- **Only merged fixes ship.** A report is "merged" once its fix commit reaches the default branch (trailer or `Fixes #n`), its PR merges, or someone runs `feedbackkit link <id> --commit <sha>`.
- **Web builds:** a git SHA as `appBuild` doesn't order, so a fix counts as live as soon as the deploy is announced. That's correct for sites replaced on deploy, but announce *after* the deploy finishes, not before — for host-deployed sites, that's what waiting on the host's check run is for (Step 5).
- **A missing token is silent** by design (the script never fails a release), so a misconfigured pipeline looks exactly like one with nothing to ship. Check the job log for "Skipping FeedbackKit announcement".
