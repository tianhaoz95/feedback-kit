# Developer Portal (iOS + macOS)

The native companion to the web dashboard: triage feedback, inspect screenshots and annotations, follow each report's fix loop, and hand reports to a coding agent. One XcodeGen project (`project.yml` → `FeedbackPortal.xcodeproj`, generated and gitignored) with two apps:

| Target | Platform | Entry | Run | Release |
|---|---|---|---|---|
| `FeedbackPortal` | iOS 17+ | `Sources/App/FeedbackPortalApp.swift` | `./scripts/run-portal-ios.sh` | TestFlight — `testflight-portal.yml` on every unified `vX.Y.Z` release; locally `./scripts/release_portal_testflight.sh` |
| `FeedbackPortalMac` ("FeedbackKit Portal") | macOS 14+ | `SourcesMac/FeedbackPortalMacApp.swift` | `./scripts/run-portal-macos.sh` | Notarized DMG attached to the GitHub Release — `release-portal-macos.yml` on every unified `vX.Y.Z` release (or `./scripts/cut_release.sh X.Y.Z --mac-portal` for `portal-mac-vX.Y.Z` alone); locally `./scripts/release_portal_macos.sh --version X.Y.Z` |

Tests (`Tests/PortalTests.swift`) run against both: schemes `FeedbackPortal` (iOS simulator) and `FeedbackPortalMac` (`xcodebuild test -scheme FeedbackPortalMac -destination 'platform=macOS'`).

## How the Mac app shares the iOS code

- **Everything in `Sources/` compiles for both platforms**, except the two iOS-only files the Mac target excludes in `project.yml` (`App/FeedbackPortalApp.swift`, `App/UIApplication+TopMost.swift`).
- **`Sources/Platform/PortalPlatform+macOS.swift`** gives the handful of UIKit / iOS-only SwiftUI names the views use (`UIColor.secondarySystemBackground`, haptics, `UIPasteboard`, `.navigationBarTitleDisplayMode`, `.topBarTrailing`, …) a macOS meaning, so the views don't fork. A new iOS-only API in a shared view either gets a macOS meaning there or an `#if os(iOS)` at the call site (e.g. `toolbarBackground(for: .navigationBar)`, which *exists but is unavailable* on macOS and can't be shimmed).
- **`SourcesMac/`** is only the desktop shell: the window with a sidebar (`MacRootView`), menu commands, and the Settings window (⌘,). Where layout genuinely differs, the shared view branches with `#if os(macOS)` — the inbox shows list and detail side by side with native `List(selection:)` (click / ↑↓) instead of pushing the detail.
- The Mac target keeps the **module name `FeedbackPortal`** so the shared tests' `@testable import FeedbackPortal` works on both.
- It links FeedbackKit's **native AppKit implementation**, not Mac Catalyst — deliberately, see below.

## Teams and notifications

- **Organizations:** `AppState.currentOrganization` scopes the project list (and so the inbox). Switch or create one from the Projects toolbar menu or **Team**, which also lists members, changes roles, creates invite links (handed to the share sheet and accepted in the web dashboard), and leaves.
- **Activity:** the notification list (a tab on iOS, a sidebar section on the Mac). Tapping one opens the report in its own organization.
- **Push (iOS only):** `Sources/App/PortalPushNotifications.swift`. The iOS target has the `aps-environment` entitlement. Permission is asked from a card in Activity, the APNs token is registered with `register_push_device` on every launch while signed in and removed on sign-out, and Debug builds register as `sandbox`. Pushes only arrive once the backend is configured (root README, "Turning on push notifications"). The Mac app polls every minute and badges the Dock instead.

## Dogfooding: the Portal validates FeedbackKit on itself

Both apps report problems *with the Portal* through FeedbackKit (`Sources/App/PortalDogfood.swift`) into the FeedbackKit team's own hosted project — the same project the web dashboard reports into — under their own product keys (`developer-portal-ios`, `developer-portal-macos`), with the signed-in developer attached as `FeedbackKit.user`:

- **iOS:** shake to report (toggle in Settings).
- **macOS:** Help › **Report a Problem…** (⇧⌘R), the sidebar's *Report a Problem…* button, or an optional floating button (Settings).
- **Both:** `enableFixVerification` — when a fix for your report ships in the build you're running, the Portal asks "is it fixed?".

So the team triages those reports *in the Portal*, hands them to a coding agent (MCP `get_prompt` / GitHub dispatch), and ships the fix with the release script — which runs `feedbackkit release` when `FEEDBACKKIT_PROJECT_ID` is set, closing the loop back to whoever reported it. Using the Mac Portal this way is also how the macOS SDK gets exercised on a real, complex SwiftUI app: it's what surfaced that the SDK's screenshot missed the window toolbar (fixed — it now captures the window frame) and that macOS 26 Liquid Glass sidebars can't be captured without Screen Recording permission (documented in `ScreenshotCapture.swift`).
