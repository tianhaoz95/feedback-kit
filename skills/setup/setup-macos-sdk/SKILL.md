---
name: setup-macos-sdk
description: Integrate FeedbackKit SDK into a macOS desktop app (SwiftUI or AppKit) — adds package dependency, configures project credentials, sets up floating button or menu item triggers, and configures screen tracking.
---

# setup-macos-sdk

Integrates the FeedbackKit SDK into a macOS desktop application (SwiftUI or AppKit). The agent adds the Swift package, initializes credentials at application startup, wires up macOS triggers (floating button or menu item), and configures screen tracking.

## When to Use

- Use when adding FeedbackKit feedback reporting to a macOS desktop application.
- Trigger phrases: "add feedbackkit to macos", "setup feedbackkit in mac app", "install feedbackkit macos", "add feedback to appkit app".

## Prerequisites

- macOS 12.0+ deployment target.
- Xcode 14+ / Swift 5.7+ toolchain.
- A FeedbackKit project key and endpoint URL (optional if only handling local reports).

## Step-by-Step Instructions

### Step 1 -- Add Swift Package Dependency

#### XcodeGen (`project.yml`)
```yaml
packages:
  FeedbackKit:
    url: https://github.com/tianhaoz95/feedback-kit
    from: 1.0.0
targets:
  YourMacAppTarget:
    dependencies:
      - package: FeedbackKit
```
Regenerate Xcode project if using XcodeGen:
```bash
xcodegen generate
```

#### Swift Package (`Package.swift`)
```swift
dependencies: [
    .package(url: "https://github.com/tianhaoz95/feedback-kit", from: "1.0.0")
],
targets: [
    .target(
        name: "YourMacAppTarget",
        dependencies: [
            .product(name: "FeedbackKit", package: "feedback-kit")
        ]
    )
]
```

### Step 2 -- Configure FeedbackKit at Launch

#### SwiftUI (`@main App`)
```swift
import SwiftUI
import FeedbackKit

@main
struct MyMacApp: App {
    init() {
        FeedbackKit.configure(.init(
            endpointURL: URL(string: "https://<your-project-ref>.supabase.co/functions/v1/ingest-feedback")!,
            projectKey: "<your-project-key>"
        ))
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .commands {
            // Optional: Help menu feedback item
            CommandGroup(replacing: .help) {
                Button("Report a Problem…") {
                    FeedbackKit.presentAndSubmit(from: NSApplication.shared.keyWindow)
                }
                .keyboardShortcut("r", modifiers: [.command, .shift])
            }
        }
    }
}
```

#### AppKit (`NSApplicationDelegate`)
```swift
import AppKit
import FeedbackKit

@main
class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        FeedbackKit.configure(.init(
            endpointURL: URL(string: "https://<your-project-ref>.supabase.co/functions/v1/ingest-feedback")!,
            projectKey: "<your-project-key>"
        ))
    }
}
```

### Step 3 -- Install Feedback Triggers on macOS

macOS apps do not have shake sensors. The recommended triggers are floating buttons and menu items:

#### Option A: Floating Trigger Button (Recommended)
Places a draggable button over the main window content:
```swift
FeedbackKit.showFloatingTriggerButton {
    NSApplication.shared.keyWindow
}
```

#### Option B: Menu Bar Item
Add a menu item in SwiftUI commands or an AppKit `NSMenuItem` action:
```swift
FeedbackKit.presentAndSubmit(from: NSApplication.shared.keyWindow)
```

#### Option C: Custom Button or Settings Action
```swift
// Present sheet and automatically submit to dashboard:
FeedbackKit.presentAndSubmit(from: NSApplication.shared.keyWindow)

// Or present sheet and process report manually:
FeedbackKit.present(from: NSApplication.shared.keyWindow) { report in
    guard let report else { return }
    print("Report submitted: \(report.id)")
}
```

### Step 4 -- Configure Screen Tracking

Because macOS does not have a single mobile view-controller stack, set `FeedbackKit.currentScreen` when the user navigates:

```swift
.onAppear {
    FeedbackKit.currentScreen = "Preferences"
}
```

### Step 5 -- Close the Loop: "Is It Fixed?" (Recommended)

When a fix for something reported from this Mac ships in the build it's running, show the reporter their original screenshot and ask "is it fixed?" — as a sheet on the key window. "Still broken" re-runs the capture flow; questions from the developer or agent appear the same way.

```swift
FeedbackKit.enableFixVerification {
    NSApplication.shared.keyWindow
}
// Optional: attach who reported what.
FeedbackKit.user = FeedbackUser(email: currentUser.email)
```

**Build numbers must be real and increasing.** The device compares its own `CFBundleVersion` with the build a fix shipped in, so:
- `CFBundleVersion` has to be a number that increases every build (a UTC timestamp like `202609261015` is simplest).
- The number the release pipeline announces has to be the one actually in the binary. With XcodeGen, set `CFBundleVersion: "$(CURRENT_PROJECT_VERSION)"` and `CFBundleShortVersionString: "$(MARKETING_VERSION)"` under `info.properties`. Otherwise XcodeGen hardcodes `1` / `1.0` and command-line overrides never reach the app.
- For App Store / TestFlight exports, set `manageAppVersionAndBuildNumber` to `false` in `ExportOptions.plist`, or App Store Connect renumbers the build.

The repo/CI side (announcing builds, linking commits, the beta pipeline) is the `setup-release-loop` skill.

### Step 6 -- Verify the Build

Verify that the macOS app compiles cleanly:
```bash
swift build
# or
xcodebuild build -scheme YourMacScheme
```

## Non-Obvious Pitfalls

- **Fix verification never appears**: check the running app's `CFBundleVersion` is the number the release announced (Step 5). A DMG built with a hardcoded `1` is always "older" than any fix.
- **Liquid Glass sidebars**: on macOS 26 a `NavigationSplitView` sidebar inside Liquid Glass renders blank in the screenshot (it's unreachable without Screen Recording permission, which the SDK deliberately doesn't request). The rest of the window, including the toolbar, is captured.

- **Sheet Presentation**: On macOS, FeedbackKit presents as a sheet attached to the target `NSWindow` rather than taking over the entire screen. Ensure `NSApplication.shared.keyWindow` or a specific window reference is non-nil when presenting.
- **No Shake Sensor**: `FeedbackKit.enableShakeToReport` is iOS-only and does not exist on macOS. Use `showFloatingTriggerButton` or menu commands instead.
- **No Screen Recording Permission Needed**: The SDK uses `NSView.cacheDisplay(in:to:)` to render the window's content hierarchy, which does not require macOS Screen Recording permissions.
- **Trackpad Gestures**: Scaling and rotating annotations on macOS uses two-finger trackpad pinch and rotation (`NSMagnificationGestureRecognizer` and `NSRotationGestureRecognizer`).
