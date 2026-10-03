# FeedbackKit

| Product | Tests | Release / deploy |
| --- | --- | --- |
| Swift SDK (iOS, macOS, watchOS) | [![SDK CI](https://github.com/tianhaoz95/feedback-kit/actions/workflows/sdk-ci.yml/badge.svg)](https://github.com/tianhaoz95/feedback-kit/actions/workflows/sdk-ci.yml) | — |
| Android SDK | [![Android SDK CI](https://github.com/tianhaoz95/feedback-kit/actions/workflows/android-ci.yml/badge.svg)](https://github.com/tianhaoz95/feedback-kit/actions/workflows/android-ci.yml) | JitPack (built from release tags) |
| Flutter plugin | [![Flutter Plugin CI](https://github.com/tianhaoz95/feedback-kit/actions/workflows/flutter-ci.yml/badge.svg)](https://github.com/tianhaoz95/feedback-kit/actions/workflows/flutter-ci.yml) | — |
| React Native module | [![React Native Module CI](https://github.com/tianhaoz95/feedback-kit/actions/workflows/react-native-ci.yml/badge.svg)](https://github.com/tianhaoz95/feedback-kit/actions/workflows/react-native-ci.yml) | [![Publish React Native Module](https://github.com/tianhaoz95/feedback-kit/actions/workflows/publish-react-native.yml/badge.svg)](https://github.com/tianhaoz95/feedback-kit/actions/workflows/publish-react-native.yml) |
| Developer Portal (iOS, macOS) | [![Portal CI](https://github.com/tianhaoz95/feedback-kit/actions/workflows/portal-ci.yml/badge.svg)](https://github.com/tianhaoz95/feedback-kit/actions/workflows/portal-ci.yml) | [![Beta](https://github.com/tianhaoz95/feedback-kit/actions/workflows/beta.yml/badge.svg)](https://github.com/tianhaoz95/feedback-kit/actions/workflows/beta.yml) [![Release Portal to TestFlight](https://github.com/tianhaoz95/feedback-kit/actions/workflows/testflight-portal.yml/badge.svg)](https://github.com/tianhaoz95/feedback-kit/actions/workflows/testflight-portal.yml) [![Release macOS Portal](https://github.com/tianhaoz95/feedback-kit/actions/workflows/release-portal-macos.yml/badge.svg)](https://github.com/tianhaoz95/feedback-kit/actions/workflows/release-portal-macos.yml) |
| Demo apps | — | [![Release to TestFlight](https://github.com/tianhaoz95/feedback-kit/actions/workflows/testflight.yml/badge.svg)](https://github.com/tianhaoz95/feedback-kit/actions/workflows/testflight.yml) [![Release macOS Demo](https://github.com/tianhaoz95/feedback-kit/actions/workflows/release-macos-demo.yml/badge.svg)](https://github.com/tianhaoz95/feedback-kit/actions/workflows/release-macos-demo.yml) |
| Web SDK and dashboard | [![Web SDK CI](https://github.com/tianhaoz95/feedback-kit/actions/workflows/web-sdk-ci.yml/badge.svg)](https://github.com/tianhaoz95/feedback-kit/actions/workflows/web-sdk-ci.yml) | [![Publish Web SDK Package](https://github.com/tianhaoz95/feedback-kit/actions/workflows/publish-web-sdk.yml/badge.svg)](https://github.com/tianhaoz95/feedback-kit/actions/workflows/publish-web-sdk.yml) [![Announce web deploy](https://github.com/tianhaoz95/feedback-kit/actions/workflows/announce-web.yml/badge.svg)](https://github.com/tianhaoz95/feedback-kit/actions/workflows/announce-web.yml) |
| CLI + MCP server | [![CLI CI](https://github.com/tianhaoz95/feedback-kit/actions/workflows/cli-ci.yml/badge.svg)](https://github.com/tianhaoz95/feedback-kit/actions/workflows/cli-ci.yml) | [![Publish CLI Package](https://github.com/tianhaoz95/feedback-kit/actions/workflows/publish-cli.yml/badge.svg)](https://github.com/tianhaoz95/feedback-kit/actions/workflows/publish-cli.yml) |
| Backend (Supabase) and Agent Skills | [![Backend CI](https://github.com/tianhaoz95/feedback-kit/actions/workflows/backend-ci.yml/badge.svg)](https://github.com/tianhaoz95/feedback-kit/actions/workflows/backend-ci.yml) | [![Deploy Supabase Functions](https://github.com/tianhaoz95/feedback-kit/actions/workflows/deploy-functions.yml/badge.svg)](https://github.com/tianhaoz95/feedback-kit/actions/workflows/deploy-functions.yml) [![Publish Skills Package](https://github.com/tianhaoz95/feedback-kit/actions/workflows/publish-skills.yml/badge.svg)](https://github.com/tianhaoz95/feedback-kit/actions/workflows/publish-skills.yml) |
| Developer docs | — | [![Deploy developer docs](https://github.com/tianhaoz95/feedback-kit/actions/workflows/deploy-docs.yml/badge.svg)](https://github.com/tianhaoz95/feedback-kit/actions/workflows/deploy-docs.yml) |

An iOS + macOS + watchOS SDK for capturing in-app user feedback (screenshot +
annotations + description + device/app/screen info on iOS/macOS; text +
context only on watchOS), a web SDK that does the same for websites (plus
the page URL and recent console errors / failed requests), and an optional
Supabase-backed dashboard for collecting it with your team and turning it
into prompts for a coding agent. A native Android SDK brings the same flow to
Android, and Flutter and React Native wrappers run the native iOS and Android
SDKs under the hood.

> 📖 **Developer Documentation & Contributor Guide**: [https://tianhaoz95.github.io/feedback-kit/](https://tianhaoz95.github.io/feedback-kit/)  
> 🚀 **Live Web Dashboard**: [https://feedback-kit.hejitech.workers.dev](https://feedback-kit.hejitech.workers.dev)

See [DESIGN.md](DESIGN.md) for how it's put together and why.

## Quickstart

Prerequisites: Xcode, Homebrew, Node.js — all standard on a dev Mac. The one
thing you may need to install yourself is **Docker Desktop**
(https://www.docker.com/products/docker-desktop/), needed only for running
Supabase locally.

```bash
./scripts/setup.sh      # installs xcodegen + Supabase CLI, npm install for web/
```

### Run the iOS demo app

```bash
./scripts/run-ios.sh
```

Builds and launches `DemoApp` (a small sample app with FeedbackKit wired up —
shake-to-report, a floating trigger button, and manual "Report a Problem"
buttons on both a SwiftUI and a UIKit screen) in the iOS Simulator.

### Run the macOS demo app

```bash
./scripts/run-macos.sh
```

Builds and launches natively — no simulator needed. Exercises the floating
trigger button, a Help-menu "Report a Problem…" item (⌘⇧R, the menu-item
trigger style the SDK's docs show), and manual "Report a Problem" buttons on
a sidebar Home/Cart pair sharing the same `CartStore` the iOS demo uses.
`FeedbackKit.present(from: window)` and `FeedbackKit.showFloatingTriggerButton { ... }`
are the macOS equivalents of the iOS calls above, minus a shake trigger (no
motion sensor on a Mac).

You can also build/test just the SDK itself, without the demo app:

```bash
swift build
swift test
```

### Run the watchOS demo app

```bash
./scripts/run-watchos.sh
```

A standalone watch app (no iOS companion needed) built and launched on a
watch simulator. watchOS is a deliberately stripped-down flow — no
screenshot, no annotation tools, just a text description plus device/app
context — via `FeedbackQuickNoteView`, a plain SwiftUI view embedded in a
`.sheet`. See [DESIGN.md](DESIGN.md) for why.

To test just the SDK itself on a watch simulator instead:

```bash
# Find a watch simulator id: xcrun simctl list devices available
xcodebuild test -scheme FeedbackKit -destination 'id=<WATCH_SIMULATOR_UDID>'
```

### Add feedback to a website (web SDK)

```bash
npm install feedbackkit-web
```

```ts
import { FeedbackKit } from "feedbackkit-web";

FeedbackKit.configure({ projectKey: "pk_..." });
FeedbackKit.showFloatingTriggerButton();
```

The same capture → annotate → describe flow as the native SDKs, in any
framework (or a plain `<script>` tag). Source lives in [`web-sdk/`](web-sdk/README.md);
the dashboard itself dogfoods it from source for its own "Feedback" button.
Develop and test it with:

```bash
cd web-sdk
npm install
npm test           # unit tests
npm run test:e2e   # the full flow in real Chromium, Firefox and WebKit
```

### Android, Flutter and React Native

- **Android** (`android/`): a native Kotlin SDK (`android/feedbackkit`) with the
  same flow and report as the iOS SDK, plus a demo app (`android/demo`) with a
  Jetpack Compose Home screen, a classic-View Cart screen and Settings.

  ```bash
  ./scripts/run-android.sh                          # builds, installs, launches on a device/emulator
  cd android && ./gradlew :feedbackkit:testDebugUnitTest
  ```

- **Flutter** (`flutter/feedbackkit_flutter`): a plugin over the native SDKs,
  with the demo app in `example/`.

  ```bash
  cd flutter/feedbackkit_flutter && flutter test
  cd example && flutter run
  ```

- **React Native** (`react-native/`, npm `feedbackkit-react-native`): a New
  Architecture TurboModule over the native SDKs, with the demo app in
  `example/`.

  ```bash
  cd react-native && corepack yarn && corepack yarn test
  corepack yarn example ios        # or: corepack yarn example android
  ```

Inside this repo all three build against the SDK sources here, so a Swift or
Android SDK change can be tried in every app at once. See
[`/docs/mobile-sdks`](https://feedback-kit.hejitech.workers.dev/docs/mobile-sdks)
for the install snippets apps use.

### Run the web dashboard

Needs Docker Desktop running first (see above).

```bash
./scripts/start-web.sh
```

Starts a local Supabase stack (Postgres, Auth, Storage, Edge Functions —
with this project's schema and the `ingest-feedback` function already
applied), points the dashboard at it, and starts it at http://localhost:3000.
Supabase Studio (to poke at the database/storage directly) is at
http://127.0.0.1:54323.

Sign up on the dashboard, create a project, and copy the Swift snippet shown
on the project page into `DemoApp/DemoApp/FeedbackKitDemoApp.swift` (it's
already there, commented out) to see feedback submitted from the simulator
show up live.

### Use the CLI / MCP server

Install globally from npm (or run directly with `npx feedbackkit-cli`):

```bash
npm install -g feedbackkit-cli
feedbackkit login   # sign in via browser
feedbackkit list
```

Or connect it to your local dev stack:

```bash
feedbackkit login --dashboard-url http://localhost:3000
```

Lets a coding agent fetch a feedback report's generated prompt directly
(`feedbackkit mcp`) instead of a human copying it out of the dashboard —
see [cli/README.md](cli/README.md) for the full command/tool list and how
its browser-based login works.

### Agent Skills

FeedbackKit provides a catalog of [Agent Skills](https://github.com/vercel-labs/skills) compatible with
Claude Code, Cursor, Antigravity, Gemini CLI, and other AI coding assistants to automate SDK setup and MCP integration.

## Skills Catalog

| Category | Skill | Description |
|---|---|---|
| [`setup/`](skills/setup/README.md) | [`setup-ios-sdk`](skills/setup/setup-ios-sdk/SKILL.md) | Integrate FeedbackKit SDK into an iOS project (SwiftUI or UIKit). |
| [`setup/`](skills/setup/README.md) | [`setup-macos-sdk`](skills/setup/setup-macos-sdk/SKILL.md) | Integrate FeedbackKit SDK into a macOS desktop app (SwiftUI or AppKit). |
| [`setup/`](skills/setup/README.md) | [`setup-watchos-sdk`](skills/setup/setup-watchos-sdk/SKILL.md) | Integrate FeedbackKit SDK into a watchOS app using FeedbackQuickNoteView. |
| [`setup/`](skills/setup/README.md) | [`setup-web-sdk`](skills/setup/setup-web-sdk/SKILL.md) | Integrate the FeedbackKit web SDK into a website or web app. |
| [`setup/`](skills/setup/README.md) | [`setup-android-sdk`](skills/setup/setup-android-sdk/SKILL.md) | Integrate the native FeedbackKit Android SDK into an Android app (Compose or Views) with JitPack setup, triggers, and screen tracking. |
| [`setup/`](skills/setup/README.md) | [`setup-flutter-sdk`](skills/setup/setup-flutter-sdk/SKILL.md) | Integrate FeedbackKit into a Flutter app with `feedbackkit_flutter`, which runs the native iOS and Android SDKs. |
| [`setup/`](skills/setup/README.md) | [`setup-react-native-sdk`](skills/setup/setup-react-native-sdk/SKILL.md) | Integrate FeedbackKit into a React Native app with `feedbackkit-react-native`, which runs the native iOS and Android SDKs. |
| [`setup/`](skills/setup/README.md) | [`setup-mcp-server`](skills/setup/setup-mcp-server/SKILL.md) | Configure FeedbackKit CLI and MCP server for AI coding agents. |
| [`workflow/`](skills/workflow/README.md) | [`fix-feedback`](skills/workflow/fix-feedback/SKILL.md) | Fix a reported bug end to end and ship the fix back to the reporter's device for verification. |
| [`setup/`](skills/setup/README.md) | [`setup-release-loop`](skills/setup/setup-release-loop/SKILL.md) | Asks batch or branch previews, then wires the repo's releases into the loop: GitHub linking, agent hand-off, release token, build announcements (including host-deployed sites like Cloudflare/Netlify/Vercel), and a beta or per-PR preview workflow. |
| [`setup/`](skills/setup/README.md) | [`setup-agent-runner`](skills/setup/setup-agent-runner/SKILL.md) | Run a coding agent automatically on reports: Claude Code or Antigravity on your own Mac (self-hosted runner), Antigravity on GitHub-hosted runners with a Gemini API key, or `feedbackkit watch`. |
| [`workflow/`](skills/workflow/README.md) | [`promote-release`](skills/workflow/promote-release/SKILL.md) | Decide which beta is ready for production from reporters' verifications, and record the promotion. |

#### Layout

```
skills/
  <category>/
    <skill-name>/
      SKILL.md        # required: frontmatter (name, description) + agent instructions
      templates/      # optional: code/config template files (.template)
```

#### Commands

```bash
npm run new            # Interactively scaffold a new skill with @clack/prompts
npm run validate       # Validate all SKILL.md frontmatter
npm run list           # List all discoverable skills via npx skills
```

You can also pass arguments directly to scaffold non-interactively:
```bash
npm run new -- <category>/<skill-name> "one-line description"
```

#### Installing into an Agent

From within your agent CLI or another project's working directory, install from this repository (`npx skills` takes a GitHub `owner/repo`, not an npm package name):
```bash
npx skills add tianhaoz95/feedback-kit
```

To install a specific skill directly:
```bash
npx skills add tianhaoz95/feedback-kit --skill setup-ios-sdk --yes
```

## Web Dashboard & Cloudflare Deployment

The hosted web dashboard is deployed on **Cloudflare Workers Static Assets** at [`https://feedback-kit.hejitech.workers.dev`](https://feedback-kit.hejitech.workers.dev) via Git integration (see `wrangler.jsonc`).

## Developer Documentation on GitHub Pages

The contributor developer documentation is hosted on GitHub Pages at [`https://tianhaoz95.github.io/feedback-kit/`](https://tianhaoz95.github.io/feedback-kit/).

`.github/workflows/deploy-docs.yml` builds `docs/` (powered by VitePress) and deploys it to GitHub Pages via GitHub Actions (`actions/deploy-pages`) on every push to `main` that touches `docs/**`. One-time setup:

1. **Settings → Pages → Source: "GitHub Actions"** on the repository.
2. The workflow automatically builds the documentation and deploys the static output to GitHub Pages.

## Deploying Supabase (migrations + edge functions)

**Migrations** deploy automatically via Supabase's own native GitHub
integration (Dashboard → Project Settings → Integrations → GitHub), not a
custom Actions workflow — it applies `supabase/migrations/` to the
production database whenever `main` changes. This is deliberately preferred
over a custom workflow: it's a GitHub App connection Supabase manages and
scopes to this repo/project itself, so no Postgres password or access token
needs to live in this repo's GitHub Secrets at all. One-time setup, on that
integration page:

- GitHub repository: this repo
- Working directory: `.` (repo root, since `supabase/` lives directly there)
- Deploy to production: on, with production branch `main`

**Edge Functions** (`ingest-feedback`, `create-github-issue`, `github-webhook`,
plus billing functions `create-checkout-session` / `create-portal-session` /
`stripe-webhook`) are automatically deployed to production via GitHub Actions
(`.github/workflows/deploy-functions.yml`) on every push to `main` touching
`supabase/functions/**`.

They can also be deployed manually from the command line:

```bash
./scripts/deploy-functions.sh                # deploy every function
./scripts/deploy-functions.sh ingest-feedback   # or just one
```

Requires `SUPABASE_ACCESS_TOKEN` set in your environment or running `supabase login` once per machine.


### Turning on real billing

FeedbackKit is free today — every organization is permanently on the free
plan (`organization_billing`, `supabase/migrations/0009_billing.sql`) until
a real Stripe account exists. The dashboard's Billing page and the three
billing Edge Functions are already built and deployed; they just detect the
missing Stripe credentials and say so (`{"error": "billing_not_configured"}`)
instead of doing anything. To make it real:

1. Create the Stripe product with two **flat recurring prices** for the
   Indie plan — monthly and yearly, matching `web/src/lib/pricing.ts`
   ($9/month, $79/year; checkout sends quantity 1 and accepts promotion
   codes, so a founding-member coupon is just a Stripe coupon + code) — and
   a webhook endpoint pointed at
   `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`
   subscribed to at least `checkout.session.completed`,
   `customer.subscription.updated`, and `customer.subscription.deleted`.
2. Set the secrets the functions read (`supabase/functions/_shared/stripe.ts`):
   ```bash
   supabase secrets set STRIPE_SECRET_KEY=sk_live_... STRIPE_WEBHOOK_SECRET=whsec_... \
     STRIPE_PRICE_ID_INDIE_MONTHLY=price_... STRIPE_PRICE_ID_INDIE_ANNUAL=price_...
   ```
   A subscription on any other price (a larger team's custom deal, created
   by hand in Stripe with `organization_id` in the subscription metadata)
   puts the organization on the unlimited `team` plan.
3. Nothing else — no schema change, no dashboard code change. The next
   request to any billing function picks up the new secrets immediately.

### Turning on push notifications for the iOS Portal

In-app notifications (the dashboard's bell, the Portal's Activity tab) work
out of the box. Push to the iOS Developer Portal is wired up but dormant
until you give it an APNs key, the same pattern as billing:

1. Apple Developer → Certificates, Identifiers & Profiles → **Keys** →
   create a key with *Apple Push Notifications service (APNs)* and download
   the `.p8`. (The Portal's App ID gets the Push capability automatically
   the next time automatic signing runs.)
2. Set the Edge Function secrets (pick any long random string for the
   webhook secret):
   ```bash
   supabase secrets set APNS_KEY_ID=XXXXXXXXXX APNS_TEAM_ID=68CTFST8W2 \
     APNS_PRIVATE_KEY="$(cat AuthKey_XXXXXXXXXX.p8)" PUSH_WEBHOOK_SECRET=<random>
   ```
3. In the hosted project's SQL editor, tell the database where the function
   is and the same secret (`supabase/migrations/0017_notifications.sql`):
   ```sql
   select vault.create_secret('https://<project-ref>.supabase.co/functions/v1', 'feedbackkit_functions_url');
   select vault.create_secret('<random>', 'feedbackkit_push_secret');
   ```

From then on every notification row is also pushed to the recipient's
signed-in iPhones and iPads (users control which kinds on the dashboard's
Notifications page). Remove either Vault secret to switch it off again.

### Product analytics

The dashboard records first-party usage events (`supabase/migrations/0020_analytics.sql`,
`web/src/lib/analytics.ts`): no third-party tracker, readable only with the
service role key. For the activation funnel (organizations → project → first
report → agent → linked fix → announced build → reporter-verified fix), active
users, top events and top pages, run:

```bash
node scripts/analytics_report.mjs        # last 30 days; pass a number for another window
```

It uses `SUPABASE_SERVICE_ROLE_KEY` if set, otherwise your `supabase login`.

### Branch delivery: the PR's "FeedbackKit" check

Projects set to **Branch previews** (Settings → Delivery) get a "FeedbackKit"
commit status on each pull request that fixes a report. The FeedbackKit GitHub
App needs **Commit statuses: Read and write** (GitHub → Settings → Developer
settings → GitHub Apps → the app → Permissions); each installation then
accepts the change. Until then the status silently isn't posted.

### Turning on "Assign to GitHub Copilot"

Copilot's coding agent only accepts an issue assignment from a token acting
as a *user* with a Copilot seat, so each member connects their own GitHub
account through the FeedbackKit GitHub App's user authorization
(`supabase/migrations/0018_copilot_dispatch.sql`). It's dormant until the
app's OAuth credentials are set — `github-user-auth` answers 501 until then:

1. GitHub → Settings → Developer settings → GitHub Apps → the FeedbackKit
   app → **General**: add the callback URL
   `https://feedback-kit.hejitech.workers.dev/github/callback` (plus
   `http://localhost:5173/github/callback` for local dev), keep *Expire user
   authorization tokens* on, and generate a client secret.
2. **Permissions**: repository *Actions*, *Contents*, *Issues* and *Pull
   requests* read & write (a user token can only do what both the app and
   the user may).
3. `supabase secrets set GITHUB_APP_CLIENT_ID=<client id> GITHUB_APP_CLIENT_SECRET=<secret>`

Then a member ticks **Assign to GitHub Copilot** in project Settings →
Coding agent loop and connects their account; **Send to agent** assigns the
issue to Copilot as whoever presses it.

**Auth/MFA/pooler/storage config** (`supabase config push`) isn't automated
either, and for a sharper reason: unlike migrations or function code, it
syncs config.toml's *entire* declared state to the project on every push,
which risks silently overwriting live settings that were never meant to
match config.toml's (often local-dev-oriented) defaults — this happened
during development (see git history around the GitHub-auth config).
Always review `supabase config diff --project-ref <ref>` yourself before
`supabase config push --project-ref <ref>`.

## Releasing the demo app to TestFlight

```bash
APPLE_TEAM_ID=68CTFST8W2 ./scripts/release_testflight.sh
```

Archives `DemoApp` (Release configuration) and uploads it to App Store
Connect for TestFlight, directly from this Mac — no Fastlane, no manually
exported `.p12`. Signing is automatic via an App Store Connect API key
(`FA_ASC_KEY_ID` / `FA_ASC_ISSUER_ID` / `FA_KEY_LOCATION`, set in `~/.zshrc`
on this machine). `APPLE_TEAM_ID` is passed per invocation rather than
defaulting globally, since this machine has signing identities for more
than one Apple Developer Team — `68CTFST8W2` (HEJI TECHNOLOGY LLC) is the
team that owns the `com.feedbackkit.demo` app record in App Store Connect.
An app record with that bundle ID must already exist there before you run
this; the script doesn't create one.

## Betas on every push, production by the owner

Coding agents commit fixes straight to `main` with a `FeedbackKit: <id>`
commit trailer. Every push that touches the SDK or Portal runs
`.github/workflows/beta.yml`: tests, then a TestFlight build of the iOS
Portal and a rolling `beta-portal-mac` prerelease of the macOS Portal. With
the `FEEDBACKKIT_RELEASE_TOKEN` secret set (project Settings → Release
tokens, or `feedbackkit token create github-actions | gh secret set
FEEDBACKKIT_RELEASE_TOKEN`), each beta is announced, and the people who
reported the bugs it fixes are asked "is it fixed?" in that build. The
project's **Releases** tab shows which beta is ready to promote. You
promote it in App Store Connect, then mark it released there or run
`feedbackkit promote --build <n>`. See DESIGN.md §8.

## Cutting a release

Release the entire suite with a single command:

```bash
./scripts/cut_release.sh 1.0.0 --notes "Version 1.0.0 release"
```

This publishes the GitHub release (tag `v1.0.0`) and triggers all release pipelines in parallel:
1. **`.github/workflows/testflight.yml`**: Archives `FeedbackKitDemo` and uploads it to App Store Connect for TestFlight.
2. **`.github/workflows/testflight-portal.yml`**: Archives the iOS Developer Portal (`FeedbackPortal`) and uploads it to TestFlight.
3. **`.github/workflows/release-macos-demo.yml`**: Archives `FeedbackKitDemoMac`, signs it with a **Developer ID Application** certificate, notarizes with Apple, and attaches the notarized `FeedbackKitDemoMac-1.0.0.dmg` directly to the GitHub release.
4. **`.github/workflows/release-portal-macos.yml`**: Same for the macOS Developer Portal — attaches the notarized `FeedbackKit-Portal-1.0.0.dmg` to the same release.
5. **`.github/workflows/publish-cli.yml`**: Builds, tests, and publishes `feedbackkit-cli` to both the public npm registry (`feedbackkit-cli`) and GitHub Packages (`@tianhaoz95/feedbackkit-cli`).
6. **`.github/workflows/publish-skills.yml`**: Validates and publishes `feedback-kit-skills` to both the public npm registry (`feedback-kit-skills`) and GitHub Packages (`@tianhaoz95/feedback-kit-skills`).
7. **`.github/workflows/publish-web-sdk.yml`**: Publishes `feedbackkit-web` to npm and GitHub Packages.
8. **`.github/workflows/publish-react-native.yml`**: Publishes `feedbackkit-react-native` to npm. Its prepack step bundles the Android SDK.

The Android SDK has no pipeline: JitPack builds `android/feedbackkit` from the tag the first time someone requests it (`jitpack.yml`). The Flutter plugin isn't on pub.dev yet; apps depend on it from GitHub with a `git:` dependency. See `flutter/feedbackkit_flutter/README.md`.

To release just one component, add its flag — it gets its own prefixed tag, and only that component's pipeline runs:

| Flag | Tag | Pipeline |
|---|---|---|
| `--mac-demo` | `mac-demo-v1.0.0` | `release-macos-demo.yml` |
| `--mac-portal` | `portal-mac-v1.0.0` | `release-portal-macos.yml` |
| `--cli` | `cli-v1.0.0` | `publish-cli.yml` |
| `--skills` | `skills-v1.0.0` | `publish-skills.yml` |
| `--web-sdk` | `web-sdk-v1.0.0` | `publish-web-sdk.yml` |
| `--react-native` | `react-native-v1.0.0` | `publish-react-native.yml` |

Every release workflow follows this rule (a unified `vX.Y.Z` runs them all; a prefixed tag runs only its owner), so a new pipeline should skip every *other* prefix in its job's `if:` and be added to `scripts/cut_release.sh`.

Unlike TestFlight signing (an "Apple Development" identity Xcode manages
automatically), Developer ID distribution needs a real exported `.p12` in CI,
so `release-macos-demo.yml` and `release-portal-macos.yml` import one into a throwaway keychain rather than relying on
`-allowProvisioningUpdates`. You can also trigger either workflow by hand from the Actions tab
(`workflow_dispatch`) — for macOS, check "Pipeline validation (no-upload)" there to validate
the full build, sign, and notarization pipeline without touching a real release.

To verify your local credentials and tooling before releasing:

```bash
./scripts/release-mac.sh --check
```

To build, sign, and notarize locally instead (e.g. to debug a notarization
rejection without spending a CI run):

```bash
./scripts/release-mac.sh --version 1.0.0 --no-upload
```

Needs a "Developer ID Application" certificate already in your keychain
(Xcode > Settings > Accounts > Manage Certificates > +) and the same
`FA_ASC_KEY_ID`/`FA_ASC_ISSUER_ID`/`FA_KEY_LOCATION` App Store Connect API
key the TestFlight release above uses — notarization just needs *an* ASC
API key with access to the team, the same one works for both.

## Repo layout

| Path | What |
|---|---|
| `Sources/FeedbackKit/` | The iOS + macOS + watchOS SDK (Swift Package) |
| `Tests/FeedbackKitTests/` | SDK unit tests |
| `android/` | Native Android SDK (`feedbackkit`) and its demo app (`demo`), one Gradle project |
| `flutter/feedbackkit_flutter/` | Flutter plugin over the native iOS/Android SDKs, demo app in `example/` |
| `react-native/` | React Native module (npm `feedbackkit-react-native`) over the native SDKs, demo app in `example/` |
| `DemoApp/` | Sample apps exercising the SDK on iOS, macOS, and watchOS (one XcodeGen project, three targets) |
| `web/` | Static SPA dashboard (Vite + React), deployed to Cloudflare Workers Static Assets |
| `docs/` | Contributor developer documentation (VitePress), deployed to GitHub Pages |
| `supabase/` | Postgres migrations, storage policies, the ingestion Edge Function, billing (Stripe) Edge Functions |
| `cli/` | `feedbackkit` CLI + MCP server (Node/TypeScript) |
| `skills/` | Agent Skills catalog (`vercel-labs/skills`) for automated setup via AI coding agents |
| `scripts/` | `setup.sh`, `run-ios.sh`, `run-macos.sh`, `run-watchos.sh`, `run-android.sh`, `start-web.sh`, `deploy-functions.sh`, `cut_release.sh`, `generate_mac_icon.py`, `release_testflight.sh`, `release-mac.sh`, `release_macos_demo.sh`, `release_portal_macos.sh` |

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, architecture guidelines, testing instructions, and our contribution workflow. All contributors are expected to adhere to our [Code of Conduct](CODE_OF_CONDUCT.md). For security vulnerabilities, please refer to our [Security Policy](SECURITY.md).

## License

This project is licensed under the [PolyForm Perimeter License 1.0.1](LICENSE).

- **Permitted**: Self-hosting, internal use, contributing back, making modifications, and building larger/derivative works on top of the software.
- **Prohibited**: Using the software to market or provide a product or paid service that serves as a direct substitute or competitor to the software.

