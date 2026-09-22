## Description

<!-- Provide a brief, concise summary of the changes made in this pull request and why they are necessary. -->

## Related Issue

<!-- If applicable, link to the issue(s) resolved or referenced by this PR. E.g., Fixes #123, Closes #456 -->

## Type of Change

<!-- Please check all options that apply: -->

- [ ] 🐛 Bug fix (non-breaking fix for an issue)
- [ ] ✨ New feature (non-breaking addition of functionality)
- [ ] 💥 Breaking change (fix or feature causing existing functionality to break or change)
- [ ] 📝 Documentation update
- [ ] 🎨 Code refactor / clean-up (no behavior change)
- [ ] ⚡ Performance improvement
- [ ] 🔧 Build / CI / Tooling / Dependency update

## Affected Components

<!-- Please check all components touched by this PR: -->

- [ ] Swift SDK (`Sources/FeedbackKit`)
  - [ ] iOS
  - [ ] macOS
  - [ ] watchOS
- [ ] SDK Tests (`Tests/FeedbackKitTests`)
- [ ] Demo Application (`DemoApp/`)
- [ ] Web Dashboard (`web/`)
- [ ] Supabase Backend / Migrations / Edge Functions (`supabase/`)
- [ ] CLI & MCP Server (`cli/`)
- [ ] Agent Skills (`skills/`)
- [ ] Scripts & CI Workflows (`scripts/`, `.github/`)

## Testing & Verification

<!-- Describe the steps taken to verify these changes. Indicate which test suites were run and any manual verification performed. -->

- [ ] Swift SDK builds and tests pass natively on macOS (`swift test`)
- [ ] iOS / watchOS simulator tests pass (`xcodebuild test -scheme FeedbackKit -destination ...`)
- [ ] Web dashboard builds and passes linter (`cd web && npm run lint && npm run build`)
- [ ] CLI builds, passes tests, and passes typecheck (`cd cli && npm run test && npm run lint`)
- [ ] Agent Skills frontmatter validation passes (`npm run validate`)
- [ ] Demo app verified manually in simulator or natively

## PR Checklist

- [ ] My code conforms to the project's architectural guidelines in [`DESIGN.md`](DESIGN.md) and [`CONTRIBUTING.md`](CONTRIBUTING.md).
- [ ] I have performed a self-review of my own code.
- [ ] I have added or updated tests covering the modified functionality.
- [ ] I have updated relevant documentation (inline comments, markdown docs) where needed.
- [ ] I have not committed any generated Xcode project files (`.xcodeproj`), `.env` secrets, or temporary artifacts.
- [ ] All automated CI checks pass.
