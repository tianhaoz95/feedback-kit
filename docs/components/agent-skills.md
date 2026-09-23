# Agent Skills Catalog (`skills/`)

FeedbackKit publishes an Agent Skills module compliant with the [`vercel-labs/skills`](https://github.com/vercel-labs/skills) open standard via the [`feedback-kit-skills`](https://www.npmjs.com/package/feedback-kit-skills) npm package.

---

## What are Agent Skills?

Agent Skills provide AI coding assistants (such as Antigravity, Claude Code, Cursor, and Codex) with step-by-step executable instructions for automated tasks:
- Adding the Swift Package to an Xcode project
- Wiring up shake-to-report triggers
- Configuring the MCP server in Claude Code or Cursor

---

## Published Skills

1. **`setup-ios-sdk`**: Configures FeedbackKit in iOS targets (SPM dependency, trigger setup, branding).
2. **`setup-macos-sdk`**: Configures FeedbackKit in macOS AppKit/SwiftUI desktop apps with floating triggers.
3. **`setup-watchos-sdk`**: Integrates `FeedbackQuickNoteView` into watchOS apps.
4. **`setup-mcp-server`**: Automates MCP server setup in agent configuration files (`claude.json`, `.cursor/mcp.json`).

---

## Usage with Skills CLI

Developers can install these skills using `npx skills`:

```bash
# List available skills
npx skills add feedback-kit-skills --list

# Install iOS setup skill
npx skills add feedback-kit-skills --skill setup-ios-sdk --yes
```

---

## Authoring New Skills

Use the built-in scaffolder:

```bash
# Interactive mode
npm run new

# Non-interactive mode
npm run new -- setup/setup-tvos-sdk "Automate tvOS SDK integration"
```

### Validation Rules
Always validate frontmatter before committing:

```bash
npm run validate
```

- Every skill must have a valid `SKILL.md` with YAML frontmatter containing `name` and `description`.
- The `name` must exactly match the enclosing directory name.
- Multi-file skills can include templates in a `templates/` subdirectory.
