---
name: setup-watchos-sdk
description: Integrate FeedbackKit SDK into a watchOS app using FeedbackQuickNoteView — adds package dependency, configures project credentials, presents quick note modal, and tracks watch screen state.
---

# setup-watchos-sdk

Integrates the FeedbackKit SDK into a watchOS application. Because Apple Watch screens are too small for freehand screenshot annotation, FeedbackKit provides `FeedbackQuickNoteView` — a streamlined text and context reporting interface embedded directly in SwiftUI.

## When to Use

- Use when adding in-app feedback to a standalone or companion watchOS app.
- Trigger phrases: "add feedbackkit to watchos", "setup feedbackkit in apple watch app", "install feedbackkit watchos", "apple watch feedback reporting".

## Prerequisites

- watchOS 8.0+ deployment target (9.0+ for standalone watch apps).
- SwiftUI-based watchOS project.
- A FeedbackKit project key and endpoint URL (optional if consuming reports locally).

## Step-by-Step Instructions

### Step 1 -- Add Swift Package Dependency

#### XcodeGen (`project.yml`)
```yaml
packages:
  FeedbackKit:
    url: https://github.com/tianhaoz95/feedback-kit
    from: 1.0.0
targets:
  YourWatchAppTarget:
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
        name: "YourWatchAppTarget",
        dependencies: [
            .product(name: "FeedbackKit", package: "feedback-kit")
        ]
    )
]
```

### Step 2 -- Configure FeedbackKit at Launch

Initialize FeedbackKit inside your watchOS `@main App` struct's `init()`:

```swift
import SwiftUI
import FeedbackKit

@main
struct MyWatchApp: App {
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
    }
}
```

### Step 3 -- Present `FeedbackQuickNoteView`

watchOS does not support modal window overlays or shake triggers. Embed `FeedbackQuickNoteView` inside a SwiftUI `.sheet`:

```swift
import SwiftUI
import FeedbackKit

struct ContentView: View {
    @State private var showingFeedback = false

    var body: some View {
        List {
            Section("Settings") {
                Button {
                    showingFeedback = true
                } label: {
                    Label("Send Feedback", systemImage: "bubble.left.and.exclamationmark")
                }
            }
        }
        .sheet(isPresented: $showingFeedback) {
            FeedbackQuickNoteView { report in
                guard let report else {
                    // User canceled
                    return
                }
                print("Submitted watch feedback: \(report.userDescription)")
            }
        }
    }
}
```

### Step 4 -- Configure Screen Tracking

Set `FeedbackKit.currentScreen` on active watch views:

```swift
.onAppear {
    FeedbackKit.currentScreen = "HeartRateMonitor"
}
```

### Step 5 -- Verify the Build

Verify the watchOS target compiles cleanly:
```bash
xcodebuild build -scheme YourWatchScheme -destination 'generic/platform=watchOS Simulator'
```

## Non-Obvious Pitfalls

- **No Window Overlay or Shake**: `FeedbackKit.present(from:)`, `FeedbackKit.enableShakeToReport`, and `FeedbackKit.showFloatingTriggerButton` are not available on watchOS (there is no `UIWindow` or shake responder). Use `FeedbackQuickNoteView` directly in a SwiftUI sheet or view hierarchy.
- **Placeholder Screenshot**: Since watchOS does not offer a public window-capture API, FeedbackKit automatically generates a lightweight, labeled placeholder card for `FeedbackReport.screenshotRawPNG` so that database fields and downstream prompt generators receive valid images.
- **Dictation and Scribble**: `FeedbackQuickNoteView` uses standard SwiftUI text fields, enabling watchOS voice dictation, scribble, and QWERTY keyboards automatically.
