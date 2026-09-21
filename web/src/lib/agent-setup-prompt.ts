export type TargetPlatform = "ios" | "macos" | "multiplatform" | "watchos";

export interface AgentSetupPromptOptions {
  platform: TargetPlatform;
  projectKey: string;
  endpointUrl: string;
  projectName?: string;
}

export function generateAgentSetupPrompt({
  platform,
  projectKey,
  endpointUrl,
  projectName,
}: AgentSetupPromptOptions): string {
  const projectContext = projectName ? `for "${projectName}" ` : "";

  switch (platform) {
    case "ios":
      return `Please integrate the FeedbackKit SDK ${projectContext}into this iOS app project.

1. Add the Swift Package dependency:
   - Package URL: https://github.com/tianhaoz95/feedback-kit
   - Branch: main (or latest release)
   - Add product "FeedbackKit" to your app target.

2. Configure FeedbackKit at app launch with this project's endpoint and key:
   \`\`\`swift
   import FeedbackKit

   FeedbackKit.configure(.init(
       endpointURL: URL(string: "${endpointUrl}")!,
       projectKey: "${projectKey}"
   ))
   \`\`\`
   - For SwiftUI apps: Place this inside your @main App struct's init() method.
   - For UIKit apps: Place this inside application(_:didFinishLaunchingWithOptions:) in AppDelegate.swift.

3. Install a feedback trigger so users can submit feedback:
   - Option A: Shake to report (recommended for iOS):
     \`\`\`swift
     FeedbackKit.enableShakeToReport {
         UIApplication.shared.connectedScenes
             .compactMap { $0 as? UIWindowScene }
             .flatMap { $0.windows }
             .first { $0.isKeyWindow }?
             .rootViewController
     }
     \`\`\`
   - Option B: Draggable floating trigger button:
     \`\`\`swift
     FeedbackKit.showFloatingTriggerButton {
         UIApplication.shared.connectedScenes
             .compactMap { $0 as? UIWindowScene }
             .flatMap { $0.windows }
             .first { $0.isKeyWindow }?
             .rootViewController
     }
     \`\`\`
   - Option C: Manual presentation from a button or settings action:
     \`\`\`swift
     FeedbackKit.presentAndSubmit(from: viewController)
     \`\`\`

4. Screen tracking (optional but recommended): Set FeedbackKit.currentScreen = "ScreenName" when navigating so reports record which screen they originated from.

Please inspect the existing codebase, identify whether this is a SwiftUI or UIKit app, add the package dependency, place the configuration and trigger in the proper files, and ensure the app builds and runs cleanly.`;

    case "macos":
      return `Please integrate the FeedbackKit SDK ${projectContext}into this macOS app project.

1. Add the Swift Package dependency:
   - Package URL: https://github.com/tianhaoz95/feedback-kit
   - Branch: main (or latest release)
   - Add product "FeedbackKit" to your app target.

2. Configure FeedbackKit at app launch with this project's endpoint and key:
   \`\`\`swift
   import FeedbackKit

   FeedbackKit.configure(.init(
       endpointURL: URL(string: "${endpointUrl}")!,
       projectKey: "${projectKey}"
   ))
   \`\`\`
   - For SwiftUI apps: Place this inside your @main App struct's init() method.
   - For AppKit apps: Place this inside applicationDidFinishLaunching(_:) in NSApplicationDelegate.

3. Install a feedback trigger:
   - Option A: Draggable floating trigger button (recommended for macOS):
     \`\`\`swift
     FeedbackKit.showFloatingTriggerButton {
         NSApplication.shared.keyWindow
     }
     \`\`\`
   - Option B: Menu bar item action (e.g. Help -> Report a Problem...):
     \`\`\`swift
     FeedbackKit.presentAndSubmit(from: NSApplication.shared.keyWindow)
     \`\`\`

4. Screen tracking: macOS does not auto-detect screens, so update FeedbackKit.currentScreen = "ScreenName" as users navigate.

Please inspect the existing codebase, identify the entry point, add the package dependency, place the configuration and trigger in the proper place, and ensure the app builds cleanly.`;

    case "multiplatform":
      return `Please integrate the FeedbackKit SDK ${projectContext}into this Apple platform app (iOS & macOS).

1. Add the Swift Package dependency:
   - Package URL: https://github.com/tianhaoz95/feedback-kit
   - Branch: main (or latest release)
   - Add product "FeedbackKit" to your targets.

2. Configure FeedbackKit at app startup:
   \`\`\`swift
   import FeedbackKit

   FeedbackKit.configure(.init(
       endpointURL: URL(string: "${endpointUrl}")!,
       projectKey: "${projectKey}"
   ))
   \`\`\`
   Place this in your app's startup entry point (@main App.init(), AppDelegate, or NSApplicationDelegate).

3. Install feedback triggers:
   \`\`\`swift
   #if os(iOS)
   FeedbackKit.enableShakeToReport {
       UIApplication.shared.connectedScenes
           .compactMap { $0 as? UIWindowScene }
           .flatMap { $0.windows }
           .first { $0.isKeyWindow }?
           .rootViewController
   }
   FeedbackKit.showFloatingTriggerButton {
       UIApplication.shared.connectedScenes
           .compactMap { $0 as? UIWindowScene }
           .flatMap { $0.windows }
           .first { $0.isKeyWindow }?
           .rootViewController
   }
   #elseif os(macOS)
   FeedbackKit.showFloatingTriggerButton {
       NSApplication.shared.keyWindow
   }
   #endif
   \`\`\`

4. Screen tracking: Keep FeedbackKit.currentScreen = "ScreenName" updated during navigation to include screen context with feedback reports.

Please inspect the project structure, locate the entry points for each platform, add the dependency and configuration in the proper places, wire up the triggers, and verify that the project builds cleanly.`;

    case "watchos":
      return `Please integrate the FeedbackKit SDK ${projectContext}into this watchOS app project.

1. Add the Swift Package dependency:
   - Package URL: https://github.com/tianhaoz95/feedback-kit
   - Branch: main (or latest release)
   - Add product "FeedbackKit" to your watchOS target.

2. Configure FeedbackKit at app launch:
   \`\`\`swift
   import FeedbackKit

   FeedbackKit.configure(.init(
       endpointURL: URL(string: "${endpointUrl}")!,
       projectKey: "${projectKey}"
   ))
   \`\`\`
   Place this in your @main App struct's init() method.

3. Embed the FeedbackQuickNoteView in a sheet or navigation destination:
   \`\`\`swift
   import SwiftUI
   import FeedbackKit

   .sheet(isPresented: $showingFeedback) {
       FeedbackQuickNoteView { report in
           guard let report else { return }
           // Submits the quick note report to the configured dashboard
       }
   }
   \`\`\`

4. Screen tracking: Set FeedbackKit.currentScreen = "ScreenName" as the user navigates so reports identify the active watch screen.

Please inspect the existing codebase, add the package dependency, configure FeedbackKit in the app entry point, wire up the quick note sheet, and verify that the watchOS app builds cleanly.`;
  }
}
