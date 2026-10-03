# Agent Skills Catalog (`skills/`)

FeedbackKit publishes an Agent Skills module compliant with the [`vercel-labs/skills`](https://github.com/vercel-labs/skills) open standard from this repository: install with `npx skills add tianhaoz95/feedback-kit` (the skills CLI takes a GitHub `owner/repo`; the [`feedback-kit-skills`](https://www.npmjs.com/package/feedback-kit-skills) npm package is a mirror, not an install source).

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
4. **`setup-web-sdk`**: Integrates the web SDK (`feedbackkit-web`) into websites and SPAs.
5. **`setup-android-sdk`**, **`setup-flutter-sdk`**, **`setup-react-native-sdk`**: Integrate the native Android SDK, the Flutter plugin and the React Native module.
6. **`setup-mcp-server`**: Automates MCP server setup in agent configuration files (`claude.json`, `.cursor/mcp.json`).
7. **`setup-release-loop`**: Wires a repository's releases into the closed loop — GitHub linking, agent hand-off, CI release token, build announcements, build-number fixes, beta-on-push (with templates).
8. **`fix-feedback`** (workflow): An agent fixes a report end to end and links it with a `FeedbackKit:` commit trailer.
9. **`promote-release`** (workflow): Reads release readiness (`feedbackkit releases` / MCP `list_releases`) and records promotions.

The SDK setup skills (1–5) each include a "close the loop" step enabling `enableFixVerification`.

---

## Usage with Skills CLI

Developers can install these skills using `npx skills`:

```bash
# List available skills
npx skills add tianhaoz95/feedback-kit --list

# Install iOS setup skill
npx skills add tianhaoz95/feedback-kit --skill setup-ios-sdk --yes
```

That installs from `main`. The npm package also has a `feedback-kit-skills`
command (`bin/feedback-kit-skills.mjs`), which runs `skills add` on the
package's bundled copy, so it installs that release's skills instead:

```bash
npx feedback-kit-skills --skill setup-ios-sdk --yes   # takes the same options as `skills add`
```

It then rewrites its entries in the project's `skills-lock.json` from npx's
cache path to `tianhaoz95/feedback-kit` (the entry `skills add` writes for a
GitHub install, same `computedHash`), so the lock file can be committed and
`npx skills update` works. `npm i feedback-kit-skills` on its own only puts
the files in `node_modules`, where no agent looks.

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
