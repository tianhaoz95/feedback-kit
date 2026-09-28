# CI/CD & Automation

FeedbackKit tests every product on its own, ships betas on every push to `main` that touches the apps, and publishes everything else from GitHub Releases.

---

## Active workflows

```
.github/workflows/
├── sdk-ci.yml              # Swift SDK: swift test (macOS), iOS Simulator tests, watchOS build
├── portal-ci.yml           # Developer Portal tests (Mac target)
├── cli-ci.yml              # CLI + MCP server: lint and tests (Linux)
├── backend-ci.yml          # Edge Function type-check, migrations from scratch, skills validation
├── web-sdk-ci.yml          # Web SDK unit + 3-browser e2e; dashboard clean build
├── beta.yml                # Push to main: SDK + Portal CI as the gate, then Portal betas
├── testflight-portal.yml   # iOS Developer Portal → TestFlight
├── release-portal-macos.yml# macOS Developer Portal → notarized DMG (release or rolling beta)
├── testflight.yml          # Demo apps (iOS + watchOS) → TestFlight
├── release-macos-demo.yml  # macOS demo app → notarized DMG
├── publish-cli.yml         # feedbackkit-cli → npm (provenance) + GitHub Packages
├── publish-web-sdk.yml     # feedbackkit-web → npm (provenance) + GitHub Packages
├── publish-skills.yml      # feedback-kit-skills → npm + GitHub Packages
├── deploy-functions.yml    # Supabase Edge Functions on push to main
├── announce-web.yml        # Announces each Cloudflare web deploy as a FeedbackKit release
├── feedbackkit-agent-antigravity.yml # Antigravity on the self-hosted Mac runner, when an issue gets the "antigravity" label
└── deploy-docs.yml         # This VitePress site → GitHub Pages
```

---

## 1. Tests, one workflow per product

Each CI workflow runs on pull requests and on pushes to `main`, filtered to its own paths, so a failure names the product and a change to one product doesn't run the others' tests.

| Workflow | Runner | Paths | Runs |
|---|---|---|---|
| `sdk-ci.yml` | macOS | `Sources/`, `Tests/`, `Package.swift` | `swift test`; `xcodebuild test` on the first available iPhone simulator; a watchOS Simulator build |
| `portal-ci.yml` | macOS | `DeveloperApp/`, `Sources/`, `Package.swift` | `xcodegen generate` + `xcodebuild test` on the `FeedbackPortalMac` scheme |
| `cli-ci.yml` | Linux | `cli/` | `npm run lint`, `npm test` |
| `backend-ci.yml` | Linux | `supabase/`, `skills/` | `deno check --node-modules-dir=auto` on every function; `supabase db start` (applies every migration in order); `npm run validate` for skills |
| `web-sdk-ci.yml` | Linux | `web-sdk/`, `web/` | SDK lint/unit/build and the Playwright e2e in Chromium, Firefox and WebKit; dashboard lint/test/build from a clean checkout |

`sdk-ci.yml` and `portal-ci.yml` also have `workflow_call`, so `beta.yml` runs them as its gate. Their concurrency group includes `github.workflow`, so the gate call and the workflow's own run for the same push don't cancel each other.

---

## 2. Betas on every push to main

`beta.yml` runs on pushes touching the SDK or the Portal: `sdk-ci` and `portal-ci` must pass, then the iOS Portal goes to TestFlight and the macOS Portal to the rolling `beta-portal-mac` prerelease. Each release script ends with `scripts/feedbackkit_announce.sh`, which records the build with the `FEEDBACKKIT_RELEASE_TOKEN` secret so merged fixes move to Shipped (see [The Closed Loop](../architecture/closed-loop.md)).

---

## 3. Releases

`./scripts/cut_release.sh X.Y.Z` publishes a GitHub Release `vX.Y.Z`, which starts every release workflow: both Portals, both demo apps, and the CLI, web SDK and skills packages (versions come from the tag). Product-only tags exist too: `--cli`, `--web-sdk`, `--skills`, `--mac-demo`, `--mac-portal`. `publish-cli.yml` runs the CLI's lint and tests before publishing; `publish-web-sdk.yml` runs lint, unit tests, build and a Chromium e2e.

Apple releases archive with an App Store Connect API key (TestFlight) or sign with Developer ID, notarize, staple and attach a DMG (macOS). Build numbers are UTC timestamps, so fix verification can compare them.

---

## 4. Deploys

- **Web dashboard** — Cloudflare's Git integration builds `web/` on every push to `main` (`wrangler.jsonc`, SPA fallback) at `https://feedback-kit.hejitech.workers.dev`. `announce-web.yml` waits for Cloudflare's check run on the commit, then announces the short SHA as a production build for the `web-dashboard` and `website` products.
- **Edge Functions** — `deploy-functions.yml` on pushes touching `supabase/functions/**` (`SUPABASE_ACCESS_TOKEN`).
- **Migrations** — Supabase's own GitHub integration applies new files in `supabase/migrations/` to the hosted project.
- **These docs** — `deploy-docs.yml` on pushes touching `docs/**`.
