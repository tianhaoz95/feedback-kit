# Testing Matrix

FeedbackKit contains multiple test suites spanning Swift, TypeScript, and Agent Skills.

---

## Testing Matrix Overview

| Component | Target Platform | Test Runner | Command |
|---|---|---|---|
| **Swift SDK** | macOS (native) | Swift Testing / XCTest | `swift test` |
| **Swift SDK** | iOS Simulator | `xcodebuild` | `xcodebuild test -scheme FeedbackKit -destination '...'` |
| **Swift SDK** | watchOS Simulator | `xcodebuild` | `xcodebuild test -scheme FeedbackKit -destination '...'` |
| **Web Dashboard** | Node / Browser | Node test runner | `cd web && npm test` |
| **CLI & MCP** | Node.js | Node test runner | `cd cli && npm test` |
| **Agent Skills** | Specification | Node script | `npm run validate` |

---

## 1. Swift SDK Unit Tests (`Tests/FeedbackKitTests/`)

The SDK tests cover data serialization, hex color encoding, and drawing geometry.

### Native macOS (Fastest)
```bash
swift test

# Filter for a single test
swift test --filter FeedbackReportTests/testHexColorRoundTrip
```

### Simulator Tests (iOS & watchOS)
Simulator testing validates platform-specific implementations:

```bash
# Find available simulator
xcrun simctl list devices available

# iOS destination
xcodebuild test -scheme FeedbackKit -destination 'platform=iOS Simulator,name=iPhone 16'

# watchOS destination
xcodebuild test -scheme FeedbackKit -destination 'platform=watchOS Simulator,name=Apple Watch Series 10 (46mm)'
```

---

## 2. Web Dashboard Unit Tests (`web/`)

Tests prompt template merging, placeholder replacement, and repository URL parsing:

```bash
cd web
npm test
```

---

## 3. CLI & MCP Tests (`cli/`)

Tests project-scoped descriptions and MCP server tool registration:

```bash
cd cli
npm test
```

---

## 4. Agent Skills Validation

Validates YAML frontmatter across all skills in `skills/`:

```bash
npm run validate
```
