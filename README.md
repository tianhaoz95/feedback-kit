# FeedbackKit

[![Release to TestFlight](https://github.com/tianhaoz95/feedback-kit/actions/workflows/testflight.yml/badge.svg)](https://github.com/tianhaoz95/feedback-kit/actions/workflows/testflight.yml)
[![Release macOS Demo](https://github.com/tianhaoz95/feedback-kit/actions/workflows/release-macos-demo.yml/badge.svg)](https://github.com/tianhaoz95/feedback-kit/actions/workflows/release-macos-demo.yml)
[![Publish CLI Package](https://github.com/tianhaoz95/feedback-kit/actions/workflows/publish-cli.yml/badge.svg)](https://github.com/tianhaoz95/feedback-kit/actions/workflows/publish-cli.yml)
[![Publish Skills Package](https://github.com/tianhaoz95/feedback-kit/actions/workflows/publish-skills.yml/badge.svg)](https://github.com/tianhaoz95/feedback-kit/actions/workflows/publish-skills.yml)
[![Deploy developer docs](https://github.com/tianhaoz95/feedback-kit/actions/workflows/deploy-docs.yml/badge.svg)](https://github.com/tianhaoz95/feedback-kit/actions/workflows/deploy-docs.yml)
[![Deploy Supabase Functions](https://github.com/tianhaoz95/feedback-kit/actions/workflows/deploy-functions.yml/badge.svg)](https://github.com/tianhaoz95/feedback-kit/actions/workflows/deploy-functions.yml)

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

### Agent Skills

FeedbackKit provides a catalog of [Agent Skills](https://github.com/vercel-labs/skills) compatible with
Claude Code, Cursor, Antigravity, Gemini CLI, and other AI coding assistants to automate SDK setup and MCP integration.

## Skills Catalog

| Category | Skill | Description |
|---|---|---|
| [`setup/`](skills/setup/README.md) | [`setup-ios-sdk`](skills/setup/setup-ios-sdk/SKILL.md) | Integrate FeedbackKit SDK into an iOS project (SwiftUI or UIKit). |
| [`setup/`](skills/setup/README.md) | [`setup-macos-sdk`](skills/setup/setup-macos-sdk/SKILL.md) | Integrate FeedbackKit SDK into a macOS desktop app (SwiftUI or AppKit). |
| [`setup/`](skills/setup/README.md) | [`setup-watchos-sdk`](skills/setup/setup-watchos-sdk/SKILL.md) | Integrate FeedbackKit SDK into a watchOS app using FeedbackQuickNoteView. |
| [`setup/`](skills/setup/README.md) | [`setup-mcp-server`](skills/setup/setup-mcp-server/SKILL.md) | Configure FeedbackKit CLI and MCP server for AI coding agents. |

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

From within your agent CLI or another project's working directory, install using the dedicated npm package name:
```bash
npx skills add feedback-kit-skills
```

To install a specific skill directly:
```bash
npx skills add feedback-kit-skills --skill setup-ios-sdk --yes
```

You can also install directly using the GitHub repository shorthand:
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

## Cutting a release

Release the entire suite with a single command:

```bash
./scripts/cut_release.sh 1.0.0 --notes "Version 1.0.0 release"
```

This publishes the GitHub release and triggers all release pipelines in parallel:
1. **`.github/workflows/testflight.yml`**: Archives `FeedbackKitDemo` and uploads it to App Store Connect for TestFlight.
2. **`.github/workflows/release-macos-demo.yml`**: Archives `FeedbackKitDemoMac`, signs it with a **Developer ID Application** certificate, notarizes with Apple, and attaches the notarized `FeedbackKitDemoMac-1.0.0.dmg` directly to the GitHub release.
3. **`.github/workflows/publish-cli.yml`**: Builds, tests, and publishes `feedbackkit-cli` to both the public npm registry (`feedbackkit-cli`) and GitHub Packages (`@tianhaoz95/feedbackkit-cli`).
4. **`.github/workflows/publish-skills.yml`**: Validates and publishes `feedback-kit-skills` to both the public npm registry (`feedback-kit-skills`) and GitHub Packages (`@tianhaoz95/feedback-kit-skills`).

Unlike TestFlight signing (an "Apple Development" identity Xcode manages
automatically), Developer ID distribution needs a real exported `.p12` in CI,
so `release-macos-demo.yml` imports one into a throwaway keychain rather than relying on
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
| `DemoApp/` | Sample apps exercising the SDK on iOS, macOS, and watchOS (one XcodeGen project, three targets) |
| `web/` | Static SPA dashboard (Vite + React), deployed to Cloudflare Workers Static Assets |
| `docs/` | Contributor developer documentation (VitePress), deployed to GitHub Pages |
| `supabase/` | Postgres migrations, storage policies, the ingestion Edge Function, billing (Stripe) Edge Functions |
| `cli/` | `feedbackkit` CLI + MCP server (Node/TypeScript) |
| `skills/` | Agent Skills catalog (`vercel-labs/skills`) for automated setup via AI coding agents |
| `scripts/` | `setup.sh`, `run-ios.sh`, `run-macos.sh`, `run-watchos.sh`, `start-web.sh`, `deploy-functions.sh`, `cut_release.sh`, `generate_mac_icon.py`, `release_testflight.sh`, `release-mac.sh`, `release_macos_demo.sh` |

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, architecture guidelines, testing instructions, and our contribution workflow. All contributors are expected to adhere to our [Code of Conduct](CODE_OF_CONDUCT.md). For security vulnerabilities, please refer to our [Security Policy](SECURITY.md).

## License

This project is licensed under the [PolyForm Perimeter License 1.0.1](LICENSE).

- **Permitted**: Self-hosting, internal use, contributing back, making modifications, and building larger/derivative works on top of the software.
- **Prohibited**: Using the software to market or provide a product or paid service that serves as a direct substitute or competitor to the software.

