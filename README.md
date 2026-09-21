# FeedbackKit

An iOS + macOS + watchOS SDK for capturing in-app user feedback (screenshot +
annotations + description + device/app/screen info on iOS/macOS; text +
context only on watchOS), plus an optional Supabase-backed dashboard for
collecting it and turning it into prompts for a coding agent.

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

## Deploying the web dashboard to GitHub Pages

`.github/workflows/deploy-web.yml` builds `web/` and deploys it to GitHub
Pages via GitHub Actions (`actions/deploy-pages` — no `gh-pages` branch)
on every push to `main` that touches `web/`. One-time setup:

1. **Settings → Pages → Source: "GitHub Actions"** on the repo (not "Deploy
   from a branch").
2. **Settings → Secrets and variables → Actions → Variables**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

   These are the anon/publishable key and project URL — safe to expose in a
   client bundle, so repo **variables** (not secrets) are the right place for
   them, same as `web/.env.local`.

The workflow assumes the site is served from `https://<user>.github.io/feedback-kit/`
(a project page, not a `<user>.github.io` user/org page) — see the `base` in
`web/vite.config.ts` and `basename` in `web/src/main.tsx` if that ever
changes. It also copies `dist/index.html` to `dist/404.html` after building
so direct loads/refreshes of deep links (e.g. `/projects/abc`) still resolve
client-side, since GitHub Pages has no server-side rewrites.

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

**Edge Functions** (`ingest-feedback`, plus `create-checkout-session` /
`create-portal-session` / `stripe-webhook` for billing — see below) are
deployed manually:

```bash
supabase login              # once per machine — interactive browser OAuth
./scripts/deploy-functions.sh                # deploy every function
./scripts/deploy-functions.sh ingest-feedback   # or just one
```

This isn't automated because, unlike the database sync above, there's no
project-scoped credential for it — `supabase functions deploy` needs a
Supabase personal access token, which grants Management API access to
every project on the account, not just this one. Not worth storing an
account-wide secret in CI for a function that changes rarely.

### Turning on real billing

FeedbackKit is free today — every organization is permanently on the free
plan (`organization_billing`, `supabase/migrations/0009_billing.sql`) until
a real Stripe account exists. The dashboard's Billing page and the three
billing Edge Functions are already built and deployed; they just detect the
missing Stripe credentials and say so (`{"error": "billing_not_configured"}`)
instead of doing anything. To make it real:

1. Create the Stripe product/price for the paid plan, and a webhook
   endpoint pointed at
   `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`
   subscribed to at least `checkout.session.completed`,
   `customer.subscription.updated`, and `customer.subscription.deleted`.
2. Set the secrets the functions read (`supabase/functions/_shared/stripe.ts`):
   ```bash
   supabase secrets set STRIPE_SECRET_KEY=sk_live_... STRIPE_WEBHOOK_SECRET=whsec_... STRIPE_PRICE_ID_PRO=price_...
   ```
3. Nothing else — no schema change, no dashboard code change. The next
   request to any billing function picks up the new secrets immediately.

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

## Releasing the macOS demo app to GitHub Releases

Cut a release using the release cutter script (or push a `mac-demo-vX.Y.Z` tag):

```bash
./scripts/cut_release.sh mac-demo-v1.0.0 --notes "macOS demo app release"
```

This publishes the GitHub release and runs `.github/workflows/release-macos-demo.yml`
on GitHub, which builds `FeedbackKitDemoMac`, signs it with a **Developer ID
Application** certificate, notarizes the result with Apple, and attaches a
signed, stapled DMG to the release — no TestFlight, no App Store review,
just a DMG anyone can download and run without a Gatekeeper warning.
Unlike TestFlight signing (an "Apple Development" identity Xcode manages
automatically), Developer ID distribution needs a real exported `.p12` in CI,
so this workflow imports one into a throwaway keychain rather than relying on
`-allowProvisioningUpdates`. You can also trigger it by hand from the Actions tab
(`workflow_dispatch`) — check "Pipeline validation (no-upload)" there to validate
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
| `Sources/FeedbackKit/` | The iOS SDK (Swift Package) |
| `Tests/FeedbackKitTests/` | SDK unit tests |
| `DemoApp/` | Sample apps exercising the SDK on iOS, macOS, and watchOS (one XcodeGen project, three targets) |
| `web/` | Static SPA dashboard (Vite + React), deployable to any static host |
| `supabase/` | Postgres migrations, storage policies, the ingestion Edge Function, billing (Stripe) Edge Functions |
| `cli/` | `feedbackkit` CLI + MCP server (Node/TypeScript) |
| `scripts/` | `setup.sh`, `run-ios.sh`, `run-macos.sh`, `run-watchos.sh`, `start-web.sh`, `deploy-functions.sh`, `cut_release.sh`, `generate_mac_icon.py`, `release_testflight.sh`, `release-mac.sh`, `release_macos_demo.sh` |
