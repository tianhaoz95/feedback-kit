// Reference documentation exposed through both the CLI (`feedbackkit docs`)
// and the MCP server (`get_docs` tool), so a coding agent can look up "how
// do I add this to an iOS app" (or the dashboard/CLI/MCP itself) without
// leaving the terminal/chat. Content is a condensed, hand-kept-in-sync copy
// of web/src/pages/docs/*.tsx — same facts, plain markdown instead of JSX,
// since that's the right format for this format's actual consumer (an
// agent's context window, not a styled page). Verify against the real
// source (Sources/FeedbackKit/FeedbackKit.swift, CLAUDE.md, DESIGN.md)
// before trusting either copy blindly if the two ever seem to disagree.

export interface DocTopic {
  slug: string;
  title: string;
  summary: string;
  content: string;
}

export const DOCS_TOPICS: DocTopic[] = [
  {
    slug: "overview",
    title: "Overview",
    summary: "What FeedbackKit is and how its four pieces fit together.",
    content: `# FeedbackKit overview

FeedbackKit is an iOS/macOS/watchOS SDK — plus a web SDK for websites (see the \`web-sdk\` topic) — for capturing in-app feedback, plus three optional ways to consume it: a hosted dashboard, a CLI, and an MCP server for coding agents. Each piece works without the others.

## The four pieces

1. **SDK** (\`Sources/FeedbackKit\`, one Swift Package) — captures a screenshot, lets the user annotate it and describe a problem, hands the developer a structured \`FeedbackReport\`. iOS and macOS get the full annotate flow; watchOS gets a stripped-down text-only flow (see the \`sdk\` doc topic).
2. **Web dashboard** (optional) — receives reports, organizes them by project, turns them into coding-agent prompts via an editable template.
3. **CLI** — reads feedback/prompts from a terminal, authenticated as a real dashboard user.
4. **MCP server** (\`feedbackkit mcp\`) — lets a coding agent fetch a report's generated prompt directly, no copy/paste.
5. **Agent Skills** (\`skills/\`) — packages recipes for AI coding agents to automate SDK setup and MCP integration (\`npx skills add tianhaoz95/feedback-kit\`).

## The shortest path to a working report (iOS)

\`\`\`swift
FeedbackKit.enableShakeToReport {
    UIApplication.shared.topMostViewController
}
\`\`\`

That's it — no dashboard, no account. Shaking the device opens the capture/annotate/describe flow and hands you a \`FeedbackReport\` in a completion handler. See the \`sdk\` topic for the full API, including macOS and watchOS.

## How the pieces fit together

Everything shares one contract. The SDK produces a \`FeedbackReport\` (screenshot, annotations, description, device info). If configured with a dashboard project's endpoint, that report is POSTed to Supabase and stored per-project with row-level security. The dashboard turns a stored report into a coding-agent prompt via a plain, editable \`{{placeholder}}\` template. The CLI and MCP server are just another client of that same database, authenticated as a real dashboard user — a coding agent can fetch that prompt directly instead of a human copying it out of a browser tab.

## What gets collected

A report includes a raw and an annotated screenshot (iOS/macOS only, and optional there too — a toggle in the annotate UI lets the user exclude it for a pure-description report; watchOS never captures one, using a placeholder card instead, see the \`sdk\` topic), the annotation shapes drawn on it, the free-text description, and device/app context (OS, device model, app version, locale, and — if set — the current screen name). Nothing beyond what's visible on screen at capture time and those fields.

## Getting help

FeedbackKit is open source: https://github.com/tianhaoz95/feedback-kit`,
  },
  {
    slug: "sdk",
    title: "SDK (iOS, macOS, watchOS)",
    summary: "How to add FeedbackKit to an iOS, macOS, or watchOS app — install, trigger, submit.",
    content: `# SDK — iOS, macOS, watchOS

One Swift Package. On iOS and macOS it captures a screenshot, lets the user annotate it, and hands your app a structured report — a toggle in the composer (next to the send button) lets the user exclude the screenshot entirely for a pure-description report. watchOS gets a deliberately smaller version: no screenshot, no annotation tools, just a text description and device/app context.

## Requirements

- iOS 15.0+, macOS 12.0+, or watchOS 8.0+
- Swift 5.9 (swift-tools-version in the package)
- No external dependencies

## Install

In Xcode: **File → Add Package Dependencies**, then paste:

\`\`\`
https://github.com/tianhaoz95/feedback-kit
\`\`\`

Or in your own \`Package.swift\`:

\`\`\`swift
.package(url: "https://github.com/tianhaoz95/feedback-kit", branch: "main")
\`\`\`

Same package for all three platforms — Xcode/SwiftPM picks the right build.

## Basic usage — iOS

One call is everything else is built on: \`FeedbackKit.present(from:completion:)\`. It captures the current screen, presents the annotate/describe flow, and calls your completion handler with the finished report (or \`nil\` if the user cancelled). Delivery is entirely up to you.

\`\`\`swift
import FeedbackKit

FeedbackKit.present(from: self) { report in
    guard let report else { return } // user cancelled
    print("Got feedback: \\(report.text)")
    // Send \`report\` wherever you like — your own backend, or FeedbackSubmitter
    // (below) if you're using the dashboard.
}
\`\`\`

### Triggers (iOS)

\`enableShakeToReport\` and \`showFloatingTriggerButton\` are convenience wrappers around \`present(from:)\` — call it directly if you already have your own trigger.

\`\`\`swift
// Somewhere in app startup:
FeedbackKit.enableShakeToReport {
    UIApplication.shared.topMostViewController
}
// and/or:
FeedbackKit.showFloatingTriggerButton {
    UIApplication.shared.topMostViewController
}
\`\`\`

Shake detection swizzles \`UIWindow.motionEnded\` — the standard technique for this — so it works without subclassing your app's window.

## Basic usage — macOS

Same call, but takes an \`NSWindow?\` and presents as a sheet (or a standalone window if you pass \`nil\`):

\`\`\`swift
import FeedbackKit

FeedbackKit.present(from: view.window) { report in
    guard let report else { return }
    print("Got feedback: \\(report.text)")
}
\`\`\`

### Triggers (macOS)

There's no \`enableShakeToReport\` on macOS — no motion sensor, no real equivalent gesture. \`showFloatingTriggerButton\` is the recommended default trigger:

\`\`\`swift
FeedbackKit.showFloatingTriggerButton {
    NSApplication.shared.keyWindow
}
\`\`\`

## Basic usage — watchOS

No \`present(from:)\` on watchOS — watch apps are SwiftUI-only, with no \`UIWindow\`/\`NSWindow\` to present modally over. Embed \`FeedbackQuickNoteView\` (a plain SwiftUI view: a text field plus Send/Cancel) in your own presentation instead:

\`\`\`swift
import SwiftUI
import FeedbackKit

FeedbackKit.configure(.init(endpointURL: myEndpoint, projectKey: "pk_live_..."))
FeedbackKit.currentScreen = "Checkout"

.sheet(isPresented: $showingFeedback) {
    FeedbackQuickNoteView { report in
        guard let report else { return }
        FeedbackSubmitter.submit(report, configuration: myConfiguration) { _ in }
    }
}
\`\`\`

A watchOS report's screenshot fields hold a small generated placeholder card, not a real screenshot (no window-level capture API exists on watchOS, and the screen's too small for annotation tools regardless). The actual content is \`text\` plus \`environment\` (device model, watchOS version, app version, locale) — the same \`FeedbackEnvironment\` every platform produces, which dashboard prompt templates already surface.

## Tracking the current screen

FeedbackKit has no fully reliable way to know "what screen is this." On iOS it uses a layered approach: a developer-set string (recommended) with best-effort auto-detection of the top UIKit view controller as a fallback (can't see SwiftUI-only screens). On macOS and watchOS there's no fallback at all:

\`\`\`swift
// As the user navigates:
FeedbackKit.currentScreen = "Checkout"
\`\`\`

## Annotation tools (iOS/macOS only)

Four tools — freehand, rectangle, arrow, text — plus a drag tool for repositioning a shape (two-finger pinch to scale, two-finger twist to rotate; the same gestures on a Mac trackpad). Every shape is stored as normalized (0...1) points, so annotations render correctly at any screenshot resolution. Scaling/rotating an existing annotation is trackpad-only on macOS — no plain-mouse equivalent for a two-finger gesture.

## Making the screenshot optional (iOS/macOS only)

A "Screenshot" switch in the composer's second row, next to the send button (on by default), lets the user exclude it entirely — useful for a report that's pure description, with nothing worth screenshotting. Turning it off dims the screenshot/annotation area and toolbar and disables drawing, rather than hiding them — the screen stays visible for context, it's just not editable or included anymore; \`FeedbackReport.screenshotRawPNG\`, \`screenshotAnnotatedPNG\`, and \`annotations\` all come back nil/empty in that case (see the field table below). This is purely a submission-time choice — the SDK still captures the screenshot up front (window-level capture is what lets it show the annotate UI at all), it just discards it rather than including it in the report if the switch is off.

## Theming

\`FeedbackKit.theme\` customizes the feedback screen's accent colors to match your app's branding instead of the system default (\`.systemBlue\` on iOS/watchOS, \`.controlAccentColor\` on macOS):

\`\`\`swift
FeedbackKit.theme = .init(primaryColorHex: "#7C3AED", secondaryColorHex: "#F97316")
\`\`\`

Primary drives the flow's main call-to-action controls — the send button, the selected annotation tool, and the screenshot toggle's on-tint. Secondary drives less prominent controls — Cancel and the attach button. Leave \`theme\` unset (the default) to keep the system accent color exactly as before. \`NSSwitch\` has no tint API at all, so the screenshot toggle's on-tint is iOS-only. Set it any time before \`present(from:)\`/\`presentAndSubmit(from:)\` — or before presenting \`FeedbackQuickNoteView\` on watchOS, which reads it directly.

## Sending to the hosted dashboard (optional)

Skip this if you're handling delivery yourself via the completion handler. To have the SDK also submit to the dashboard, configure it once with the endpoint URL and project key from your dashboard project page, then use \`presentAndSubmit\` instead of \`present\` (iOS/macOS) or call \`FeedbackSubmitter.submit\` directly (watchOS):

\`\`\`swift
FeedbackKit.configure(
    .init(
        endpointURL: URL(string: "https://<your-project>.supabase.co/functions/v1/ingest-feedback")!,
        projectKey: "pk_live_..."
    )
)

FeedbackKit.presentAndSubmit(from: self) { result in
    switch result {
    case .success(let report):
        print("Submitted \\(report.id)")
    case .failure(let error):
        print("Failed to submit: \\(error)")
    }
}
\`\`\`

The project key is a routing key, not a secret — it can only ever *create* feedback for that project, never read anything, so it's safe to ship in an app binary.

## What's in a FeedbackReport

| Field | What it is |
|---|---|
| id / createdAt | A generated identifier and timestamp. |
| text | The user's free-text description. |
| screenshotRawPNG / screenshotAnnotatedPNG | Both PNGs, or both nil (iOS/macOS: real capture, unless the user toggles the screenshot off; watchOS: always nil — it never captures one, see the placeholder-card note above). |
| annotations | Each shape's kind, normalized points, color, scale/rotation. Empty on watchOS, and whenever the screenshot was toggled off. |
| environment | OS name/version, device model, app version/build, bundle id, locale, screen size/scale, current screen name. |
| attachment | An optional extra file (iOS/macOS only). |`,
  },
  {
    slug: "web-sdk",
    title: "Web SDK",
    summary: "Add FeedbackKit to a website (npm `feedbackkit-web` or a script tag): triggers, screen names, logs, allowed origins.",
    content: `# Web SDK (\`feedbackkit-web\`)

The browser counterpart of the Swift SDK: capture the visible viewport, let the user annotate it (freehand, rectangle, arrow, text, move) and describe the problem, and get the same \`FeedbackReport\` shape — plus the page URL and recent console errors / failed network requests. Framework-agnostic (plain DOM inside a Shadow DOM), one dependency (\`modern-screenshot\`, lazy-loaded on first capture).

## Install

\`\`\`bash
npm install feedbackkit-web
\`\`\`

Or without a bundler: \`<script src="https://cdn.jsdelivr.net/npm/feedbackkit-web/dist/feedbackkit.iife.js"></script>\` exposes \`window.FeedbackKit\`.

## Local-only use

\`\`\`ts
import { FeedbackKit } from "feedbackkit-web";
const report = await FeedbackKit.present(); // null if cancelled; nothing is sent anywhere
\`\`\`

## Sending to the dashboard

\`\`\`ts
FeedbackKit.configure({
  projectKey: "pk_...",
  endpoint: "https://<ref>.supabase.co/functions/v1/ingest-feedback", // optional, defaults to the hosted dashboard
  appVersion: "2.4.0", // optional
});
await FeedbackKit.presentAndSubmit(); // progress, retry on error, thank-you state built in
\`\`\`

Configure from client-only code (it touches \`window\`/\`document\`): in Next.js, a \`"use client"\` component's \`useEffect\`.

## Triggers

- \`FeedbackKit.showFloatingTriggerButton({ position?, label?, compact? })\`
- \`FeedbackKit.enableKeyboardShortcut({ key? })\` — ⌘⇧F / Ctrl+Shift+F by default (the web's stand-in for shake-to-report)
- Your own button calling \`FeedbackKit.presentAndSubmit()\`

## Other API

- \`FeedbackKit.currentScreen = "Checkout"\` — set on route changes; falls back to \`location.pathname\`.
- \`FeedbackKit.theme = { primaryColorHex, secondaryColorHex }\`
- \`FeedbackKit.captureOptions = { mode: "dom" | "display", maxPixelRatio }\` — \`"display"\` uses the Screen Capture API (pixel-exact, but prompts every time; falls back to DOM rendering).
- \`captureLogs\` in \`configure\` — default on: console warn/error, uncaught errors, unhandled rejections, failed/4xx/5xx fetch+XHR (method, URL, status only — never bodies; tokens and sensitive URL params redacted). \`false\` disables; users can untick logs per report.
- \`FeedbackKit.submit(report)\`, \`FeedbackKit.captureScreenshot()\`, \`FeedbackKit.destroy()\`, and the annotation renderer (\`drawAnnotations\`).

## What's different from native reports

\`environment\` has every native field (\`osName\` = real OS, \`deviceModel\` = browser + major version, \`screenWidthPoints\`/\`screenHeightPoints\` = viewport, \`screenScale\` = devicePixelRatio, \`bundleIdentifier\` = host) plus \`platform: "web"\`, \`pageUrl\`, \`userAgent\`, \`browserName\`, \`browserVersion\`. Reports also carry \`logs\` ({level, message, timestamp}). Prompt templates get \`{{platform}}\`, \`{{page_url}}\`, \`{{browser}}\`, \`{{console_logs}}\`; if a template uses none of the web ones, a "Web context" section is appended automatically.

## Capture limits

DOM rendering can't read cross-origin iframes, images without CORS headers, or WebGL canvases without \`preserveDrawingBuffer\` — they come out blank. Use \`mode: "display"\` if that matters.

## Allowed origins

The project key is visible in page source. In the dashboard, Settings → Allowed web origins restricts which sites (\`https://app.example.com\`, \`https://*.example.com\`) may submit; empty = any. Native apps (no \`Origin\` header) are never affected. Submissions are also rate-limited per project.`,
  },
  {
    slug: "dashboard",
    title: "Web dashboard",
    summary: "Sign-in, projects, prompt templates, teams, and self-hosting.",
    content: `# Web dashboard

An optional hosted dashboard: receive feedback the SDK submits, organize it by project, and turn it into a ready-to-paste prompt for a coding agent.

## Sign in

GitHub OAuth only — no email/password. Signing in for the first time creates your account and an organization automatically.

## Create a project

From **Projects**, create one and open it. Every project gets a unique \`project_key\` and an ingestion endpoint URL, presented with both a ready-to-use prompt for your AI coding agent and a Swift snippet for manual setup (see the \`sdk\` doc topic). Every project also gets a default prompt template automatically.

## Review feedback

Each report shows the annotated screenshot (omitted if the reporter toggled it off before submitting — see the \`sdk\` topic), description, environment details, and any attachment. Status: \`new\`, \`in_progress\`, \`resolved\`, or \`wont_fix\`.

## Prompt templates

The dashboard's actual differentiator: a plain-text, per-project template with \`{{placeholder}}\` substitution — not a templating language, just find-and-replace.

\`\`\`
Fix the bug shown in the attached screenshot, on the {{screen_name}} screen.

User's report: {{feedback_text}}

Device: {{device_model}}, {{os_name}} {{os_version}}
App version: {{app_version}} ({{app_build}})
Screenshot: {{screenshot_url}}
\`\`\`

| Placeholder | Fills in with |
|---|---|
| \`{{feedback_text}}\` | The user's description. |
| \`{{screen_name}}\` | The screen the report was filed from. |
| \`{{os_name}}\` / \`{{os_version}}\` | e.g. iOS 18.2. |
| \`{{device_model}}\` | e.g. iPhone16,1. |
| \`{{app_version}}\` / \`{{app_build}}\` | Your app's version/build. |
| \`{{locale}}\` | The device's locale. |
| \`{{screenshot_url}}\` | A time-limited signed URL to the annotated screenshot, or "(screenshot unavailable)" if the reporter left it out. |
| \`{{attachment_url}}\` | A signed URL to the attachment, if included. |
| \`{{products}}\` | Formatted list of affected products and their descriptions. |

Edit the project's default template anytime in the project's Settings tab — it applies to every new report. A single report can also get its own edited override without touching the shared template. A "Copy for coding agent" button copies the rendered result.

## Teams

An organization can have multiple members sharing its projects — row-level security enforces that one organization can never see another's data. No organization switcher yet (assumes one membership per user).

## CLI access

The "CLI access" page (dashboard header) lists CLIs/MCP servers logged in as you, with a way to revoke one — see the \`cli\` doc topic.

## Self-hosting

The dashboard is a static site (Vite + React) backed by Supabase (Postgres, Auth, Storage, one Edge Function) — clone the repo and point it at your own Supabase project. See the repo's README.md.`,
  },
  {
    slug: "cli",
    title: "CLI",
    summary: "Install, log in, and the full feedbackkit command list.",
    content: `# CLI

A command-line client for the dashboard — read feedback and generated prompts from a terminal, authenticated as your own account.

## Install

Install globally from npm:

\`\`\`bash
npm install -g feedbackkit-cli
\`\`\`

This puts \`feedbackkit\` and \`feedbackkit-cli\` on your \`PATH\`. Or run directly without installing via \`npx\`:

\`\`\`bash
npx feedbackkit-cli <command>
\`\`\`

Or build from source:

\`\`\`bash
git clone https://github.com/tianhaoz95/feedback-kit
cd feedback-kit/cli
npm install
npm run build
npm link   # puts \`feedbackkit\` on your PATH
\`\`\`

## Installing from GitHub Packages

FeedbackKit CLI is also published to the GitHub npm package registry as \`@tianhaoz95/feedbackkit-cli\`. Unlike the public npm registry, GitHub Packages requires authentication to download packages even when they are public.

You will need a GitHub Personal Access Token (PAT) with the \`read:packages\` scope (or a fine-grained token with read permission for Packages).

Configure npm for the \`@tianhaoz95\` scope and install:

\`\`\`bash
# Configure npm:
npm config set @tianhaoz95:registry https://npm.pkg.github.com
npm config set //npm.pkg.github.com/:_authToken YOUR_GITHUB_PAT

# Install globally:
npm install -g @tianhaoz95/feedbackkit-cli

# Or run directly via npx:
npx @tianhaoz95/feedbackkit-cli login
\`\`\`

Alternatively, add the scope and auth token directly to your \`~/.npmrc\`:

\`\`\`ini
@tianhaoz95:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_PAT
\`\`\`

## Log in

\`\`\`bash
feedbackkit login
\`\`\`

Opens your browser to authorize the CLI (signing in with GitHub first if needed). It hands the CLI your real dashboard session — not a separate token you generate and paste — so it can only see what your account can see.

Point it at a local dashboard during development:

\`\`\`bash
feedbackkit login --dashboard-url http://localhost:3000
\`\`\`

## Commands

| Command | What it does |
|---|---|
| \`feedbackkit login [--dashboard-url <url>]\` | Sign in via your browser. |
| \`feedbackkit logout\` | Remove locally stored credentials. |
| \`feedbackkit whoami\` | Show the signed-in user. |
| \`feedbackkit projects\` | List projects you're a member of. |
| \`feedbackkit list [--project <id>] [--status <status>]\` | List feedback reports, optionally filtered. |
| \`feedbackkit prompt <feedbackId>\` | Print the generated coding-agent prompt for one report. |
| \`feedbackkit docs [topic]\` | Print this documentation (no topic = list topics). |
| \`feedbackkit mcp [--project <id>]\` | Run an MCP server over stdio, optionally scoped to one project — see the \`mcp\` doc topic. |

\`--status\` accepts \`new\`, \`in_progress\`, \`resolved\`, or \`wont_fix\`.

## Managing access

Credentials live at \`~/.feedbackkit/credentials.json\` (owner-only permissions). See connected CLIs, and revoke one, from the dashboard's CLI access page (see the \`dashboard\` doc topic). Revoking is cooperative — the CLI checks its own status before doing work and clears its local credentials if revoked, rather than an instant kill of the underlying session.`,
  },
  {
    slug: "mcp",
    title: "MCP & coding agents",
    summary: "Connect Claude Code, Codex, Antigravity (or another MCP-compatible agent) to fetch feedback directly.",
    content: `# MCP & coding agents

\`feedbackkit mcp\` runs an MCP (Model Context Protocol) server over stdio, so a coding agent can fetch a bug report and its generated prompt directly — the copy/paste step removed entirely. It uses the same stored credentials as the CLI, so log in first (see the \`cli\` doc topic).

## Claude Code

Register it as a local stdio server:

\`\`\`bash
claude mcp add feedbackkit -- feedbackkit mcp
\`\`\`

Or without a global install:

\`\`\`bash
claude mcp add feedbackkit -- npx -y feedbackkit-cli mcp
\`\`\`

Or scope it to just this project (checked into version control) with an optional project ID, or to yourself across all projects:

\`\`\`bash
claude mcp add --scope project feedbackkit -- feedbackkit mcp --project <project-id>
claude mcp add --scope user feedbackkit -- feedbackkit mcp
\`\`\`

Manage registered servers with \`claude mcp list\`, \`claude mcp remove feedbackkit\`, or the in-session \`/mcp\` command.

## Codex

Register via the Codex CLI:

\`\`\`bash
codex mcp add feedbackkit -- feedbackkit mcp
\`\`\`

Or without a global install:

\`\`\`bash
codex mcp add feedbackkit -- npx -y feedbackkit-cli mcp
\`\`\`

Or configure manually in \`~/.codex/config.toml\` (user-wide) or \`.codex/config.toml\` (project-specific):

\`\`\`toml
[mcp_servers.feedbackkit]
command = "feedbackkit"
args = ["mcp"]
\`\`\`

To scope Codex to a specific project, pass \`--project <project-id>\`:

\`\`\`toml
# In .codex/config.toml (scoped to this project):
[mcp_servers.feedbackkit]
command = "feedbackkit"
args = ["mcp", "--project", "<project-id>"]
\`\`\`

Or with \`npx\` if not installed globally:

\`\`\`toml
[mcp_servers.feedbackkit]
command = "npx"
args = ["-y", "feedbackkit-cli", "mcp"]
\`\`\`

Manage registered servers with \`codex mcp list\`, \`codex mcp remove feedbackkit\`, or via Settings > MCP Settings.

## Antigravity

Add FeedbackKit to your \`mcp_config.json\` — either globally in \`~/.gemini/config/mcp_config.json\` or project-scoped in \`.agents/mcp_config.json\`:

\`\`\`json
{
  "mcpServers": {
    "feedbackkit": {
      "command": "feedbackkit",
      "args": ["mcp"]
    }
  }
}
\`\`\`

To scope Antigravity to a specific project, pass \`--project <project-id>\`:

\`\`\`json
// In .agents/mcp_config.json (scoped to this project):
{
  "mcpServers": {
    "feedbackkit": {
      "command": "feedbackkit",
      "args": ["mcp", "--project", "<project-id>"]
    }
  }
}
\`\`\`

Or with \`npx\` if not installed globally:

\`\`\`json
{
  "mcpServers": {
    "feedbackkit": {
      "command": "npx",
      "args": ["-y", "feedbackkit-cli", "mcp"]
    }
  }
}
\`\`\`

In the Antigravity IDE, you can also open the agent panel, click the menu (...), and select MCP Servers > Manage MCP Servers to view raw config or verify connected tools.

## Other agents

Most other MCP-compatible tools accept a similar JSON config, typically in an \`mcp.json\`-style file:

\`\`\`json
{
  "mcpServers": {
    "feedbackkit": {
      "type": "stdio",
      "command": "feedbackkit",
      "args": ["mcp"]
    }
  }
}
\`\`\`

To scope to a specific project, pass \`--project <project-id>\`:

\`\`\`json
// In mcp.json (scoped to this project):
{
  "mcpServers": {
    "feedbackkit": {
      "type": "stdio",
      "command": "feedbackkit",
      "args": ["mcp", "--project", "<project-id>"]
    }
  }
}
\`\`\`

Or with \`npx\` if not installed globally:

\`\`\`json
{
  "mcpServers": {
    "feedbackkit": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "feedbackkit-cli", "mcp"]
    }
  }
}
\`\`\`

The exact file location and surrounding config shape varies by tool — check that tool's own MCP documentation for where this block goes.

## Scoping to a single project

By default, the MCP server can access all projects your account has permissions for. If you are developing a specific repository or app and want to prevent the agent from pulling from other projects or wasting context tokens on them, you can scope the server to a specific project ID via \`--project <id>\` (or \`--project-id <id>\`):

### Claude Code

\`\`\`bash
claude mcp add --scope project feedbackkit -- feedbackkit mcp --project <project-id>
\`\`\`

### Codex

\`\`\`toml
# In .codex/config.toml (scoped to this project):
[mcp_servers.feedbackkit]
command = "feedbackkit"
args = ["mcp", "--project", "<project-id>"]
\`\`\`

### Antigravity

\`\`\`json
// In .agents/mcp_config.json (scoped to this project):
{
  "mcpServers": {
    "feedbackkit": {
      "command": "feedbackkit",
      "args": ["mcp", "--project", "<project-id>"]
    }
  }
}
\`\`\`

### Cursor, Windsurf, Claude Desktop & Other Agents

\`\`\`json
// In mcp.json (scoped to this project):
{
  "mcpServers": {
    "feedbackkit": {
      "type": "stdio",
      "command": "feedbackkit",
      "args": ["mcp", "--project", "<project-id>"]
    }
  }
}
\`\`\`

### Environment Variable Alternative

Any agent that supports environment variables can also pass the project ID via \`FEEDBACKKIT_PROJECT_ID\`:

\`\`\`json
{
  "mcpServers": {
    "feedbackkit": {
      "command": "feedbackkit",
      "args": ["mcp"],
      "env": {
        "FEEDBACKKIT_PROJECT_ID": "<project-id>"
      }
    }
  }
}
\`\`\`

When scoped to a project:
- \`list_projects\` only lists that project.
- \`list_feedback\` automatically defaults to that project and rejects queries for other projects.
- \`get_feedback\` and \`get_prompt\` only return items belonging to that project.
- \`update_feedback_status\` only updates items belonging to that project.

## Tools it exposes

| Tool | What it does |
|---|---|
| \`list_projects\` | List projects the logged-in user is a member of (or the scoped project). |
| \`list_feedback\` | List feedback, optionally filtered by \`project_id\`/\`status\` (scoped project enforced). |
| \`get_feedback\` | Full detail for one report, including a signed screenshot URL (null if the reporter left the screenshot out). |
| \`get_prompt\` | The generated (or developer-edited) coding-agent prompt for one report — the whole point. |
| \`update_feedback_status\` | Mark a report's status, e.g. \`resolved\` after fixing it. |
| \`get_docs\` | Fetch FeedbackKit's own documentation — e.g. "how do I add this to an iOS app." No argument lists topics; pass \`topic\` for one topic's full content. |

Everything except \`update_feedback_status\` is read-only by design: the goal is removing copy/paste, not letting an agent triage a feedback inbox unsupervised.

## Example prompts

Once connected, just ask your agent to use it:

> Look at feedback report <id> in FeedbackKit and fix it.

> How do I add FeedbackKit to my iOS app? Check its own docs.

The agent calls \`get_prompt\` for the first, \`get_docs\` for the second — real, current documentation and templates rather than a guess from training data.`,
  },
  {
    slug: "skills",
    title: "Agent Skills",
    summary: "Agent Skills for AI coding agents to automate SDK setup, triggers, and MCP configuration.",
    content: `# Agent Skills for FeedbackKit

FeedbackKit packages Agent Skills compliant with the vercel-labs/skills open standard (npx skills add). AI coding agents (Claude Code, Cursor, Antigravity, Codex) use these skills to autonomously inspect a project, add package dependencies, configure credentials, wire UI triggers, and set up MCP.

## Available skills

- \`setup-ios-sdk\` — Integrates FeedbackKit into an iOS project (SwiftUI or UIKit, XcodeGen or Xcode project). Adds package dependency, initializes credentials at app launch, sets up shake or floating triggers, and configures screen tracking.
- \`setup-macos-sdk\` — Integrates FeedbackKit into a macOS desktop app (SwiftUI or AppKit). Configures credentials, sets up floating button or menu item triggers, and configures screen tracking.
- \`setup-watchos-sdk\` — Integrates FeedbackKit into a watchOS app using \`FeedbackQuickNoteView\` embedded in a SwiftUI sheet for text and context feedback.
- \`setup-mcp-server\` — Configures the FeedbackKit CLI and MCP server for Claude Code, Cursor, Antigravity, or Codex.

## Installing skills

Install into your project or agent environment via \`feedback-kit-skills\`:

\`\`\`bash
# List discoverable skills:
npx skills add feedback-kit-skills --list

# Interactively choose skills to install:
npx skills add feedback-kit-skills

# Install a specific skill directly:
npx skills add feedback-kit-skills --skill setup-ios-sdk --yes
npx skills add feedback-kit-skills --skill setup-macos-sdk --yes
npx skills add feedback-kit-skills --skill setup-watchos-sdk --yes
npx skills add feedback-kit-skills --skill setup-mcp-server --yes

# Or via GitHub repository shorthand:
npx skills add tianhaoz95/feedback-kit --skill setup-ios-sdk --yes
\`\`\`

## Using with AI Coding Agents

Once a skill is installed, simply ask your agent:

> Please add FeedbackKit to this iOS app, configure it with my project key and endpoint URL, and enable shake to report.

The agent reads the skill instructions, inspects the codebase, adds the package, configures the entry point, and verifies the build with xcodebuild.

## Authoring and Contributing Skills

In this repository:
- \`npm run new\` — Interactively scaffold a new skill with @clack/prompts
- \`npm run validate\` — Verify frontmatter across all skills
- \`npm run list\` — List all discoverable skills via npx skills`,
  },
];

export function listDocTopics(): Array<Pick<DocTopic, "slug" | "title" | "summary">> {
  return DOCS_TOPICS.map(({ slug, title, summary }) => ({ slug, title, summary }));
}

export function getDocTopic(slug: string): DocTopic | undefined {
  return DOCS_TOPICS.find((topic) => topic.slug === slug);
}
