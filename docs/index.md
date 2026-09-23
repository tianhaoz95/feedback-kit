---
layout: home

hero:
  name: "FeedbackKit"
  text: "Developer & Contributor Docs"
  tagline: "Architecture, component guides, and development workflows for contributing to FeedbackKit"
  actions:
    - theme: brand
      text: Developer Quickstart
      link: /getting-started
    - theme: alt
      text: System Architecture
      link: /architecture/overview
    - theme: alt
      text: View Live Dashboard
      link: https://feedback-kit.hejitech.workers.dev

features:
  - title: Swift SDK (iOS, macOS, watchOS)
    details: Window-level capture, normalized vector annotation engine, pluggable triggers, and clean cross-platform drawing core with CGContext.
    link: /components/sdk
  - title: Web Dashboard on Cloudflare
    details: Static React 19 SPA running on Cloudflare Workers Static Assets with Supabase Auth, Row Level Security, and prompt generation.
    link: /components/cloudflare
  - title: CLI & MCP Server
    details: Node/TypeScript CLI (`feedbackkit-cli`) and Model Context Protocol server connecting AI coding agents directly to feedback.
    link: /components/cli-mcp
  - title: Supabase & Edge Functions
    details: Postgres migrations, Row-Level Security multi-tenancy, S3 storage buckets, and Edge Functions for anonymous SDK ingestion and billing.
    link: /components/supabase
  - title: Agent Skills
    details: First-class Agent Skills catalog following the vercel-labs/skills open standard for automated SDK installation and MCP configuration.
    link: /components/agent-skills
  - title: CI/CD & Automations
    details: GitHub Actions for GitHub Pages docs, TestFlight iOS/watchOS releases, macOS DMG notarization, and npm provenance.
    link: /workflows/ci-cd
---

## Welcome Contributors!

FeedbackKit bridges the gap between in-app user feedback and AI-assisted engineering workflows. When a user shakes their iPhone or clicks the feedback trigger on macOS, FeedbackKit captures their screen, lets them draw annotations, collects system diagnostics, and formats everything into a structured report ready for AI coding agents.

This documentation portal is hosted on GitHub Pages for open source contributors, maintainers, and integrators.

- If you want to use the live web dashboard, visit [feedback-kit.hejitech.workers.dev](https://feedback-kit.hejitech.workers.dev).
- If you want to contribute code or understand the system design, start with the [Developer Quickstart](/getting-started) and [System Architecture](/architecture/overview).
