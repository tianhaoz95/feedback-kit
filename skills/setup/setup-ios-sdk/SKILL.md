---
name: setup-ios-sdk
description: Integrate FeedbackKit SDK into an iOS project (SwiftUI or UIKit) — adds package dependency, configures project key/endpoint at app launch, sets up shake or floating triggers, and adds screen tracking.
---

# setup-ios-sdk

Integrates the FeedbackKit SDK into an iOS application (SwiftUI or UIKit). The agent inspects the project structure, adds the Swift Package dependency, initializes the SDK with project credentials, wires up user triggers (shake-to-report or floating button), and adds screen tracking.

## When to Use

- Use when integrating FeedbackKit into a new or existing iOS project.
- Trigger phrases: "add feedbackkit to ios", "setup feedbackkit in swiftui", "install feedbackkit", "add feedback reporting to ios app", "configure feedbackkit".

## Prerequisites

- iOS 15.0+ deployment target.
- Xcode 14+ / Swift 5.7+ toolchain.
- A FeedbackKit project key and endpoint URL (if sending to the dashboard; optional for standalone local capture).

## Step-by-Step Instructions

### Step 1 -- Detect Project Type and Architecture

Inspect the repository root and project files to determine:
1. **Project Definition**: Is it defined by an Xcode project (`.xcodeproj`), an XcodeGen specification (`project.yml`), or a Swift Package (`Package.swift`)?
2. **UI Framework & Lifecycle**: Is the app using SwiftUI (`@main struct App: App`) or UIKit (`AppDelegate` / `SceneDelegate`)?

### Step 2 -- Add Swift Package Dependency

#### XcodeGen (`project.yml`)
If the project uses XcodeGen, add the dependency to `project.yml` under `packages` and target `dependencies`:
```yaml
packages:
  FeedbackKit:
    url: https://github.com/tianhaoz95/feedback-kit
    from: 1.0.0
targets:
  YourAppTarget:
    dependencies:
      - package: FeedbackKit
```
Then regenerate the Xcode project:
```bash
xcodegen generate
```

#### Swift Package (`Package.swift`)
If the target is a Swift package:
```swift
dependencies: [
    .package(url: "https://github.com/tianhaoz95/feedback-kit", from: "1.0.0")
],
targets: [
    .target(
        name: "YourAppTarget",
        dependencies: [
            .product(name: "FeedbackKit", package: "feedback-kit")
        ]
    )
]
```

#### Xcode Project (`.xcodeproj`)
Add the package dependency using Xcode or by referencing the package URL:
- Repository URL: `https://github.com/tianhaoz95/feedback-kit`
- Version rule: Up to Next Major from `1.0.0` (or branch `main`)
- Add product `FeedbackKit` to your main iOS app target.

### Step 3 -- Configure FeedbackKit at App Launch

Initialize `FeedbackKit.configure` at the earliest point in the application lifecycle.

#### SwiftUI (`@main App`)
Place inside your `App` struct's `init()` method:
```swift
import SwiftUI
import FeedbackKit

@main
struct MyApp: App {
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

#### UIKit (`AppDelegate.swift`)
Place in `application(_:didFinishLaunchingWithOptions:)`:
```swift
import UIKit
import FeedbackKit

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        FeedbackKit.configure(.init(
            endpointURL: URL(string: "https://<your-project-ref>.supabase.co/functions/v1/ingest-feedback")!,
            projectKey: "<your-project-key>"
        ))
        return true
    }
}
```

### Step 4 -- Install User Feedback Triggers

FeedbackKit provides multiple trigger options. Install one or more based on user needs:

#### Option A: Shake to Report (Recommended for iOS)
Triggers the capture and annotation UI whenever the user physically shakes the device or triggers a shake in the Simulator (`Device > Shake Gesture` / `⌃⌘Z`):

```swift
FeedbackKit.enableShakeToReport {
    UIApplication.shared.connectedScenes
        .compactMap { $0 as? UIWindowScene }
        .flatMap { $0.windows }
        .first { $0.isKeyWindow }?
        .rootViewController
}
```

#### Option B: Draggable Floating Trigger Button
Places a persistent, draggable floating button over the UI:

```swift
FeedbackKit.showFloatingTriggerButton {
    UIApplication.shared.connectedScenes
        .compactMap { $0 as? UIWindowScene }
        .flatMap { $0.windows }
        .first { $0.isKeyWindow }?
        .rootViewController
}
```

#### Option C: Programmatic Presentation from UI
Call directly from a button, menu item, or help screen:

```swift
// Present and automatically submit to the configured dashboard:
FeedbackKit.presentAndSubmit(from: viewController)

// Or present and handle the FeedbackReport manually:
FeedbackKit.present(from: viewController) { report in
    guard let report else { return } // User canceled
    print("Report description: \(report.userDescription)")
}
```

### Step 5 -- Track Screens (Recommended)

Keep `FeedbackKit.currentScreen` updated during navigation so reports capture the active screen name:

#### SwiftUI
```swift
struct CheckoutView: View {
    var body: some View {
        VStack {
            // view content
        }
        .onAppear {
            FeedbackKit.currentScreen = "Checkout"
        }
    }
}
```

#### UIKit
```swift
override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    FeedbackKit.currentScreen = "Checkout"
}
```

### Step 6 -- Optional Theming

Customize the accent colors to match the app branding (hex color strings):
```swift
FeedbackKit.theme = .init(
    primaryColorHex: "#0A84FF",
    secondaryColorHex: "#64D2FF"
)
```

### Step 7 -- Verify the Build

Build the project to verify clean compilation:
```bash
xcodebuild build -scheme YourScheme -destination 'generic/platform=iOS Simulator'
```

## Non-Obvious Pitfalls

- **Key Window Resolution**: In iOS 15+, `UIApplication.shared.keyWindow` is deprecated. Use the multi-scene resolution pattern shown in Step 4 (`connectedScenes -> UIWindowScene -> windows -> isKeyWindow`).
- **Simulator Shake Testing**: To test shake-to-report in the iOS Simulator, select `Features > Shake Gesture` or press `Ctrl + Cmd + Z`.
- **Window-Level Capture**: FeedbackKit captures screenshot at the window level (`UIWindow`), rendering both UIKit and SwiftUI hierarchies without needing view-controller-specific hooks.
- **Optional Screenshot**: `FeedbackReport.screenshotRawPNG` and `FeedbackReport.screenshotAnnotatedPNG` are `Data?` (nullable) because users can toggle the screenshot off in the composer UI. Always handle optionality when processing reports manually.
