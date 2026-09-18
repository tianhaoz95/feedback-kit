# FeedbackKit

An iOS SDK for capturing in-app user feedback (screenshot + annotations +
description + device/app/screen info), plus an optional Supabase-backed
dashboard for collecting it and turning it into prompts for a coding agent.

See [DESIGN.md](DESIGN.md) for how it's put together and why.

## Quickstart

Prerequisites: Xcode, Homebrew, Node.js — all standard on a dev Mac. The one
thing you may need to install yourself is **Docker Desktop**
(https://www.docker.com/products/docker-desktop/), needed only for running
Supabase locally.

```bash
./scripts/setup.sh      # installs xcodegen + Supabase CLI, npm install for web/
```

### Run the iOS demo app

```bash
./scripts/run-ios.sh
```

Builds and launches `DemoApp` (a small sample app with FeedbackKit wired up —
shake-to-report, a floating trigger button, and manual "Report a Problem"
buttons on both a SwiftUI and a UIKit screen) in the iOS Simulator.

### Run the web dashboard

Needs Docker Desktop running first (see above).

```bash
./scripts/start-web.sh
```

Starts a local Supabase stack (Postgres, Auth, Storage, Edge Functions —
with this project's schema and the `ingest-feedback` function already
applied), points the dashboard at it, and starts it at http://localhost:3000.
Supabase Studio (to poke at the database/storage directly) is at
http://127.0.0.1:54323.

Sign up on the dashboard, create a project, and copy the Swift snippet shown
on the project page into `DemoApp/DemoApp/FeedbackKitDemoApp.swift` (it's
already there, commented out) to see feedback submitted from the simulator
show up live.

## Repo layout

| Path | What |
|---|---|
| `Sources/FeedbackKit/` | The iOS SDK (Swift Package) |
| `Tests/FeedbackKitTests/` | SDK unit tests |
| `DemoApp/` | Sample app exercising the SDK (XcodeGen project) |
| `web/` | Next.js dashboard |
| `supabase/` | Postgres migrations, storage policies, the ingestion Edge Function |
| `scripts/` | `setup.sh`, `run-ios.sh`, `start-web.sh` |
