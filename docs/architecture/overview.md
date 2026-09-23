# System Architecture & Monorepo Overview

FeedbackKit is built around a single unifying data contract implemented across three distinct tiers:

```
 ┌──────────────────────┐        FeedbackReport         ┌──────────────────────┐
 │   iOS / macOS SDK    │ ─────────────────────────────▶│  Developer Callback  │
 │ (Sources/FeedbackKit)│       (completion handler)     │  Print / custom API  │
 └──────────┬───────────┘                                └──────────────────────┘
            │ optional: FeedbackKit.configure(...) + presentAndSubmit
            ▼
 ┌──────────────────────┐   POST /functions/v1/ingest-feedback (project_key)
 │ Supabase Edge Function│ ◀────────────────────────────────────────────────────
 │   ingest-feedback     │
 └──────────┬────────────┘
            │ service-role writes (bypasses RLS)
            ▼
 ┌──────────────────────┐   RLS-scoped reads/writes      ┌──────────────────────┐
 │ Postgres + Storage   │ ◀─────────────────────────────▶│ Cloudflare Dashboard │
 │ (organizations,      │                                │ (feedback-kit web)   │
 │  projects, feedback) │                                └──────────────────────┘
 └──────────┬───────────┘                                           │
            ▲                                                       │
            │ RLS-scoped reads via user JWT                         │ OAuth Handshake
            └───────────────────────────────────┐                   ▼
                                     ┌─────────────────────┐
                                     │  CLI & MCP Server   │
                                     │  (feedbackkit-cli)  │
                                     └─────────────────────┘
```

---

## The Three Core Pillars

### 1. Swift SDK (`Sources/FeedbackKit`)
A drop-in library for Apple platforms that captures the screen, allows user markup, records system diagnostics, and hands the host app a structured `FeedbackReport`.
- **Zero Required Backend**: The SDK can run completely standalone without Supabase or the dashboard.
- **Window-Level Capture**: Bypasses view controller hierarchies and works uniformly across UIKit, SwiftUI, and AppKit.
- **Platform Implementations**: iOS and macOS share core drawing math while maintaining native UI implementations. watchOS provides a streamlined quick-note view.

### 2. Cloudflare Dashboard (`web/` + `supabase/`)
A serverless dashboard where developers manage feedback items, inspect annotated screenshots, triage bugs, and generate prompts tailored for AI coding agents.
- **Hosted on Cloudflare**: Runs on Cloudflare Workers Static Assets for rapid global edge delivery.
- **Multi-tenant Postgres**: Enforces organization and project boundaries with Postgres Row Level Security (RLS).
- **Public Ingestion Endpoint**: Edge Function accepts reports with an anonymous `project_key`.

### 3. CLI & MCP Server (`cli/`)
A command-line tool and Model Context Protocol (MCP) server that brings feedback reports and prompt templates directly into developer environments (Claude Code, Cursor, Antigravity, Codex).
- **Real User Auth**: Authenticates through the web dashboard, inheriting the user's Supabase session and RLS permissions.
- **Eliminates Manual Copying**: AI agents can query `list_feedback`, `get_feedback`, and `get_prompt` via standard MCP tool calls.

---

## Architectural Invariants

1. **SDK Decoupling**: The Swift SDK never assumes the hosted dashboard exists. Host apps can provide custom submission closures.
2. **Normalized Coordinates**: All annotation coordinates are normalized `0.0...1.0` floats, never device-specific pixel values.
3. **Decoupled Wire Format**: Swift's public API is idiomatic camelCase, while the HTTP ingestion wire format is snake_case JSON.
4. **Database-Enforced Security**: Multi-tenancy is enforced by Postgres RLS policies, never by application-level client filters.
5. **No Screen Recording Permissions**: Screenshot capture uses `drawHierarchy` (iOS) and `cacheDisplay` (macOS), which do not trigger macOS Screen Recording permission dialogs.
