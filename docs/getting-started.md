# Developer Quickstart

This guide walks you through setting up your local machine to build, test, and contribute to all parts of FeedbackKit.

---

## Machine Prerequisites

- **Operating System**: macOS (Ventura 13.0 or Sonoma/Sequoia recommended)
- **Xcode**: 15.0+ with Command Line Tools (`xcode-select --install`)
- **Package Manager**: [Homebrew](https://brew.sh)
- **Node.js**: v18.0 or newer (v22+ recommended) and `npm`
- **Docker Desktop**: Required to run the local Supabase stack (`supabase start`)

---

## One-Time Repository Setup

Clone the repository and run the automated bootstrap script:

```bash
git clone https://github.com/tianhaoz95/feedback-kit.git
cd feedback-kit
./scripts/setup.sh
```

### What `setup.sh` does:
1. Installs [XcodeGen](https://github.com/yonaskolb/XcodeGen) via Homebrew (generates `.xcodeproj` files from `project.yml`).
2. Installs the [Supabase CLI](https://supabase.com/docs/guides/cli) via Homebrew.
3. Installs dependencies for the web dashboard (`web/package.json`).
4. Generates the initial Xcode project for the demo applications.

---

## Working on Components

### 1. Swift SDK (`Sources/FeedbackKit`)
Build and test natively on macOS without simulator overhead:

```bash
swift build
swift test

# Run a specific unit test
swift test --filter FeedbackReportTests/testHexColorRoundTrip
```

To test against an iOS or watchOS simulator:

```bash
# List available simulators
xcrun simctl list devices available

# Run tests on specific simulator destination
xcodebuild test -scheme FeedbackKit -destination 'id=<SIMULATOR_UDID>'
```

### 2. Demo Applications (`DemoApp/`)
Regenerate projects and launch in the simulator or on macOS:

```bash
./scripts/run-ios.sh      # Regenerates project, builds, launches iOS simulator
./scripts/run-macos.sh    # Builds and launches native macOS demo app
./scripts/run-watchos.sh  # Runs standalone watchOS demo on watch simulator
```

### 3. Web Dashboard (`web/`)
Run the React 19 / Vite dashboard locally:

```bash
cd web
npm install
npm run dev      # Starts dev server on http://localhost:3000
```

To run against the local Supabase instance:
```bash
./scripts/start-web.sh   # Starts local Supabase, writes web/.env.local, starts Vite
```

### 4. Contributor Documentation (`docs/`)
Run this documentation site locally:

```bash
cd docs
npm install
npm run dev      # Starts VitePress dev server on http://localhost:5173
```

### 5. CLI & MCP Server (`cli/`)
Build and test the CLI:

```bash
cd cli
npm install
npm run build
npm test
node dist/index.js --help
```

---

## Repository Directory Map

```
ios-feedback/
├── Sources/FeedbackKit/   # Swift Package (iOS, macOS, watchOS SDK)
├── Tests/FeedbackKitTests/# Unit and integration tests
├── DemoApp/               # Multi-platform demo applications (XcodeGen)
├── web/                   # Static Vite + React 19 dashboard (deployed to Cloudflare)
├── docs/                  # Contributor docs (VitePress, deployed to GitHub Pages)
├── supabase/              # Postgres migrations, storage & Edge Functions
├── cli/                   # Node/TypeScript CLI + MCP server (feedbackkit-cli)
├── skills/                # Agent Skills catalog (vercel-labs/skills)
└── scripts/               # Developer workflows & release automation
```
