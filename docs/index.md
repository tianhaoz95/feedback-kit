---
layout: home

hero:
  name: "FeedbackKit"
  text: "Contributor Docs"
  tagline: "Architecture, component guides, and development workflows for the FeedbackKit ecosystem"
  image:
    src: /logo.svg
    alt: FeedbackKit
  actions:
    - theme: brand
      text: Get Started →
      link: /getting-started
    - theme: alt
      text: Architecture
      link: /architecture/overview
    - theme: alt
      text: Live Dashboard ↗
      link: https://feedback-kit.hejitech.workers.dev/
      target: _blank

features:
  - icon: 📱
    title: Swift SDK
    details: Window-level screenshot capture, normalized vector annotation engine, and cross-platform drawing core using CGContext — iOS, macOS, and watchOS.
    link: /components/sdk
  - icon: ☁️
    title: Cloudflare Deployment
    details: Static React SPA on Cloudflare Workers Static Assets with SPA fallback routing, automated Git CI/CD, and global edge caching.
    link: /components/cloudflare
  - icon: 🤖
    title: CLI & MCP Server
    details: Node/TypeScript CLI and Model Context Protocol server connecting AI coding agents directly to structured feedback prompts.
    link: /components/cli-mcp
  - icon: 🗄️
    title: Supabase Backend
    details: Postgres migrations, Row-Level Security multi-tenancy, S3 storage, and Edge Functions for anonymous SDK ingestion and billing.
    link: /components/supabase
  - icon: 🧩
    title: Agent Skills
    details: First-class skills catalog following the vercel-labs/skills specification for automated SDK installation and MCP configuration.
    link: /components/agent-skills
  - icon: ⚙️
    title: CI/CD Pipelines
    details: GitHub Actions for docs deployment, TestFlight iOS/watchOS releases, macOS DMG notarization, and npm package provenance.
    link: /workflows/ci-cd
---

## Welcome Contributors

FeedbackKit bridges the gap between in-app user feedback and AI-assisted engineering workflows. When a user shakes their iPhone or clicks the feedback trigger on macOS, FeedbackKit captures their screen, lets them draw annotations, collects system diagnostics, and formats everything into a structured report ready for AI coding agents.

<div class="tip custom-block" style="padding-top: 8px">
  <p><strong>New here?</strong> Start with the <a href="/feedback-kit/getting-started">Developer Quickstart</a> to set up your local environment, or read the <a href="/feedback-kit/architecture/overview">System Architecture</a> to understand how the pieces fit together.</p>
</div>

- **Use the live dashboard** → [feedback-kit.hejitech.workers.dev](https://feedback-kit.hejitech.workers.dev/)
- **Contribute code** → [Developer Quickstart](/getting-started) and [Contributing Guidelines](/workflows/contributing)
- **Understand the design** → [System Architecture](/architecture/overview) and [Wire Format](/architecture/wire-format)
