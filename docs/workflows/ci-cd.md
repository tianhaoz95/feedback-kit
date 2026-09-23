# CI/CD & Automation

FeedbackKit automates testing, packaging, and deployments through GitHub Actions and Cloudflare.

---

## Active CI/CD Workflows

```
.github/workflows/
├── deploy-docs.yml      # Deploys VitePress contributor docs to GitHub Pages
├── deploy-functions.yml # Deploys Supabase Edge Functions on push to main
├── release-cli.yml      # Publishes feedbackkit-cli to npm with provenance
├── release-skills.yml   # Publishes feedback-kit-skills to npm with provenance
├── release-testflight.yml # Builds & uploads iOS/watchOS demo to TestFlight
└── release-mac.yml      # Builds, notarizes, and attaches signed macOS DMG
```

---

## 1. Developer Documentation (GitHub Pages)

- **Workflow**: `.github/workflows/deploy-docs.yml`
- **Trigger**: Pushes to `main` touching `docs/**`
- **Output**: Built by VitePress to `docs/.vitepress/dist` and published via `actions/deploy-pages` to `https://tianhaoz95.github.io/feedback-kit/`.

---

## 2. Web Dashboard (Cloudflare)

- **Trigger**: Automatic on push to `main` via Cloudflare Git integration.
- **Config**: Root `wrangler.jsonc` specifies `directory: "./web/dist"` with SPA fallback.
- **Hosted At**: `https://feedback-kit.tianhaozhou95.workers.dev`

---

## 3. Supabase Edge Functions

- **Workflow**: `.github/workflows/deploy-functions.yml`
- **Trigger**: Pushes to `main` touching `supabase/functions/**`
- **Secret**: `SUPABASE_ACCESS_TOKEN`

---

## 4. npm Package Releases

Both CLI and Skills packages are published with cryptographic OpenID Connect (OIDC) provenance:

- **`feedbackkit-cli`**: Triggered by git tags matching `v*` (e.g. `v0.1.0`).
- **`feedback-kit-skills`**: Triggered by tag or manual dispatch.

---

## 5. Apple Platform Releases

- **iOS & watchOS**: `.github/workflows/release-testflight.yml` uses an App Store Connect API Key to archive and upload IPA builds.
- **macOS Desktop**: `.github/workflows/release-mac.yml` signs the macOS application with Developer ID, submits to Apple's Notary service, staples the ticket, and packages a signed DMG attached to GitHub Releases.
