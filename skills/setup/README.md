# FeedbackKit Setup Skills

This category contains [Agent Skills](https://github.com/vercel-labs/skills) that guide AI coding agents (Claude Code, Cursor, Antigravity, Codex, etc.) to set up and configure FeedbackKit across Apple platforms (iOS, macOS, watchOS) and the web, and configure the MCP server.

## Skills in this Category

| Skill | Description |
|---|---|
| [`setup-ios-sdk`](setup-ios-sdk/SKILL.md) | Integrate FeedbackKit into an iOS app (SwiftUI or UIKit) with package setup, triggers, and screen tracking. |
| [`setup-macos-sdk`](setup-macos-sdk/SKILL.md) | Integrate FeedbackKit into a macOS app (SwiftUI or AppKit) with window triggers, menu items, and screen tracking. |
| [`setup-watchos-sdk`](setup-watchos-sdk/SKILL.md) | Integrate FeedbackKit into a watchOS app using `FeedbackQuickNoteView`. |
| [`setup-web-sdk`](setup-web-sdk/SKILL.md) | Integrate the FeedbackKit web SDK (`feedbackkit-web`) into a website or web app (React, Next.js, Vue, plain HTML). |
| [`setup-mcp-server`](setup-mcp-server/SKILL.md) | Configure the FeedbackKit CLI and MCP server for Claude Code, Cursor, Antigravity, and Codex. |

## Prerequisites

- **Xcode 14+** installed with Swift 5.7+ toolchain.
- For hosted dashboard sync: A FeedbackKit project key and endpoint URL from your dashboard.
- For local development: FeedbackKit local development stack running via `./scripts/start-web.sh`.
- For MCP server: Node.js 18+ and an active FeedbackKit dashboard account.
