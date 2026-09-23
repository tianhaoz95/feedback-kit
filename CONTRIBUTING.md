# Contributing to FeedbackKit

Thank you for your interest in contributing to FeedbackKit! Whether you are reporting an issue, proposing new features, improving documentation, or submitting code changes, your help is warmly welcomed.

Please review this guide before getting started. It outlines our repository structure, development workflows, testing instructions, and architectural conventions.

---

## Code of Conduct

All contributors and participants in the FeedbackKit project are expected to uphold the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). Please read it to understand the standards of behavior we expect within our community.

If you encounter unacceptable behavior, please report it to [info@hejitechllc.com](mailto:info@hejitechllc.com).

---

## Repository Architecture Overview

FeedbackKit is structured as a monorepo containing several interconnected components that share a single data model:

| Directory | Component | Technology |
|---|---|---|
| [`Sources/FeedbackKit/`](Sources/FeedbackKit/) | Cross-platform SDK (iOS, macOS, watchOS) | Swift (Swift Package Manager) |
| [`Tests/FeedbackKitTests/`](Tests/FeedbackKitTests/) | SDK unit and integration tests | XCTest / Swift Testing |
| [`DemoApp/`](DemoApp/) | Multi-platform sample applications | SwiftUI / UIKit / AppKit, XcodeGen (`project.yml`) |
| [`web/`](web/) | Web dashboard for managing feedback & generating agent prompts | Vite + React + TypeScript + Tailwind CSS (Cloudflare) |
| [`docs/`](docs/) | Contributor developer documentation | VitePress (GitHub Pages) |
| [`supabase/`](supabase/) | Database migrations, storage policies, and Edge Functions | PostgreSQL, Deno / TypeScript |
| [`cli/`](cli/) | CLI and Model Context Protocol (MCP) server | Node.js, TypeScript (`feedbackkit-cli`) |
| [`skills/`](skills/) | Agent Skills catalog for AI coding assistants | Markdown / YAML (`vercel-labs/skills`) |
| [`scripts/`](scripts/) | Automation scripts for setup, testing, and releases | Shell / Python / Node.js |

For interactive documentation, visit the [FeedbackKit Contributor Documentation](https://tianhaoz95.github.io/feedback-kit/).
Before making non-trivial architectural changes, please read [DESIGN.md](DESIGN.md) for full context on design decisions and trade-offs.

---

## Getting Started

### Prerequisites

To build and run all components of FeedbackKit locally, you will need:

- **macOS** with **Xcode** (and Xcode Command Line Tools)
- **Homebrew** (`brew`)
- **Node.js** (v18 or newer) and `npm`
- **Docker Desktop** (required for running the local Supabase stack)

### Initial Setup

Run the setup script from the root of the repository:

```bash
./scripts/setup.sh
```

This installs `xcodegen` and the `supabase` CLI via Homebrew, and installs npm dependencies for the web dashboard.

---

## Developing Each Component

### 1. Swift SDK (`Sources/FeedbackKit`)

The SDK supports iOS, macOS, and watchOS.

#### Building & Testing
The macOS slice builds and tests natively without needing the simulator or `xcodebuild`:

```bash
# Build the package
swift build

# Run tests
swift test

# Run a specific test
swift test --filter FeedbackReportTests/testHexColorRoundTrip
```

To test iOS or watchOS, use `xcodebuild` targeting a simulator destination:

```bash
# Find an available simulator ID
xcrun simctl list devices available

# Run tests on iOS or watchOS simulator
xcodebuild test -scheme FeedbackKit -destination 'id=<SIMULATOR_UDID>'
```

#### Platform Rules
- Every iOS file is wrapped in `#if os(iOS)`; macOS files are named with a `+macOS.swift` suffix and wrapped in `#if os(macOS)`; watchOS implementations are wrapped in `#if os(watchOS)`. SPM compiles all files in the target, so these conditional compilation checks are mandatory.
- [`AnnotationRenderer.swift`](Sources/FeedbackKit/Drawing/AnnotationRenderer.swift) and [`PlatformTypes.swift`](Sources/FeedbackKit/Support/PlatformTypes.swift) are shared cross-platform without platform-specific splits. Keep drawing operations in `CGContext` rather than UIKit- or AppKit-specific path classes.

---

### 2. Demo Applications (`DemoApp/`)

The demo app contains three targets generated from a single XcodeGen specification:
- `FeedbackKitDemo` (iOS)
- `FeedbackKitDemoMac` (macOS)
- `FeedbackKitDemoWatch` (watchOS)

#### Running the Demo Apps

```bash
./scripts/run-ios.sh      # Regenerates project, builds, and launches iOS Simulator
./scripts/run-macos.sh    # Builds and launches macOS demo app natively
./scripts/run-watchos.sh  # Builds and launches watchOS demo app in simulator
```

#### XcodeGen Rules
- **Do not commit `.xcodeproj` or generated files.** [`DemoApp/project.yml`](DemoApp/project.yml) is the sole source of truth. Make all build setting, target, and file reference changes in `project.yml`.
- Shared sample state (e.g., cart products) lives in [`DemoApp/DemoApp/Support/CartStore.swift`](DemoApp/DemoApp/Support/CartStore.swift), shared by both iOS and macOS targets.

---

### 3. Web Dashboard (`web/`)

The web dashboard is a static single-page application (SPA) built with Vite, React, and React Router.

#### Running & Testing

```bash
cd web

# Start development server
npm run dev

# Run ESLint
npm run lint

# Build and type-check
npm run build
```

To run the web dashboard against a local Supabase instance, run:

```bash
./scripts/start-web.sh
```

#### Architecture Notes
- This is a static client-side SPA. Tenancy and security are enforced directly by PostgreSQL Row Level Security (RLS) policies, not by server middleware.
- Authentication is GitHub OAuth only.

---

### 4. Supabase Backend (`supabase/`)

Local Supabase development requires Docker Desktop.

#### Common Commands

```bash
./scripts/start-web.sh        # Starts Supabase, generates web/.env.local, and launches web dev server
supabase status -o env        # View local URLs and API keys
supabase db reset             # Reset local DB and rerun migrations from scratch
supabase functions serve      # Test Edge Functions locally
```

#### Database Migrations
- Migrations are sequential numbered files in [`supabase/migrations/`](supabase/migrations/) (e.g., `0001_init.sql`, `0002_storage.sql`, etc.).
- **Never edit an already applied migration.** Always create a new numbered `.sql` migration file for schema, RLS, or trigger changes.

---

### 5. CLI & MCP Server (`cli/`)

The `feedbackkit` CLI and Model Context Protocol server is written in TypeScript.

#### Building & Testing

```bash
cd cli

# Install dependencies
npm install

# Build TypeScript
npm run build

# Run typecheck/lint
npm run lint

# Run unit tests
npm run test
```

---

### 6. Agent Skills (`skills/`)

Skills follow the [`vercel-labs/skills`](https://github.com/vercel-labs/skills) specification.

#### Commands

```bash
npm run new            # Interactively scaffold a new skill
npm run validate       # Validate SKILL.md frontmatter across all skills
npm run list           # List all discoverable skills
```

#### Rules for Skills
- Always run `npm run validate` after creating or modifying skills.
- The `name` in `SKILL.md` frontmatter must match the directory basename (`skills/<category>/<skill-name>/SKILL.md`).
- Update the skills table in [`README.md`](README.md) whenever a skill is added or modified.

---

## Key Architectural Guidelines

When contributing code, please keep these critical design principles in mind:

1. **Wire Format Decoupling**:
   - `FeedbackReport` (public Swift API) uses `camelCase`.
   - `IngestPayload` (wire format JSON) uses `snake_case`.
   - If you add or modify a field on `FeedbackReport`, update `IngestPayload`, the `ingest-feedback` Edge Function, and TypeScript types in [`web/src/lib/types.ts`](web/src/lib/types.ts).
2. **Normalized Coordinates**:
   - Annotation points are stored as normalized coordinates (`0.0 ... 1.0`), not raw screen pixels. This guarantees correct rendering across all resolutions and aspect ratios.
3. **Window-Level Capture**:
   - Screenshot capture operates at the window level (`ScreenshotCapture.captureKeyWindow`), ensuring full support for SwiftUI, UIKit, and mixed view hierarchies. Do not introduce view-controller-specific capture methods.
4. **Optional Screenshots**:
   - `screenshotRawPNG` and `screenshotAnnotatedPNG` are optional (`Data?`). Always handle cases where screenshots are absent (such as watchOS quick notes or when the user toggles screenshots off).
5. **RLS Multi-Tenancy**:
   - Multi-tenant data access is enforced at the database level via Supabase RLS. Do not implement ad-hoc manual permission checks that duplicate RLS guarantees.

---

## Contribution Workflow

### 1. Issues & Discussions
- For bug reports or feature requests, search existing issues first to avoid duplicates.
- **For security vulnerabilities**, do not open a public issue — please follow our responsible disclosure process in [SECURITY.md](SECURITY.md).
- For non-trivial features or breaking changes, please open an issue to discuss your proposal before submitting a pull request.

### 2. Branching & Commits
- Fork the repository and create a feature branch off `main`:
  ```bash
  git checkout -b feat/my-new-feature
  ```
- Write concise, conventional commit messages:
  - `feat:` for new features
  - `fix:` for bug fixes
  - `docs:` for documentation updates
  - `refactor:` for code refactoring
  - `test:` for adding or updating tests
  - `chore:` for tooling, dependencies, or maintenance

### 3. Pull Request Checklist
Before submitting your pull request, verify the following:

- [ ] Swift SDK compiles cleanly (`swift build`) and passes all tests (`swift test`).
- [ ] If modifying the web dashboard, linting and build pass (`cd web && npm run lint && npm run build`).
- [ ] If modifying the CLI/MCP server, tests and typecheck pass (`cd cli && npm run test && npm run lint`).
- [ ] If modifying Agent Skills, frontmatter validation passes (`npm run validate`).
- [ ] XcodeGen project configuration (`DemoApp/project.yml`) remains intact and generates without errors.
- [ ] Documentation (such as `README.md`, `DESIGN.md`, or docstrings) has been updated where appropriate.
- [ ] Commits are clear, organized, and follow conventional commit guidelines.

### 4. Review Process
- Once opened, automated GitHub Actions workflows will run linting, tests, and build checks.
- Maintainers will review your PR, provide feedback, and merge once all checks pass and changes are approved.

---

## License

By contributing to FeedbackKit, you agree that your contributions will be licensed under the project's [PolyForm Perimeter License 1.0.1](LICENSE).
