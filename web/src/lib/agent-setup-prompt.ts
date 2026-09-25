export type TargetPlatform = "ios" | "macos" | "multiplatform" | "watchos" | "web";

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

5. Close the loop (recommended): once a fix ships, ask the person who reported it to confirm on their device:
   \`\`\`swift
   FeedbackKit.enableFixVerification {
       UIApplication.shared.connectedScenes
           .compactMap { $0 as? UIWindowScene }
           .flatMap { $0.windows }
           .first { $0.isKeyWindow }?
           .rootViewController
   }
   \`\`\`
   After each TestFlight/App Store upload, run \`npx feedbackkit-cli release --build <CFBundleVersion>\` from the repo — e.g. at the end of the release script — so merged fixes are marked shipped in that build.

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

5. Close the loop (recommended): \`FeedbackKit.enableFixVerification { NSApplication.shared.keyWindow }\` asks reporters to confirm a fix once it ships; run \`npx feedbackkit-cli release --build <CFBundleVersion>\` after each release build.

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

5. Close the loop (recommended): add \`.feedbackFixVerification()\` to the root view so the watch asks reporters to confirm a fix once it ships; run \`npx feedbackkit-cli release --build <CFBundleVersion>\` after each release build.

Please inspect the existing codebase, add the package dependency, configure FeedbackKit in the app entry point, wire up the quick note sheet, and verify that the watchOS app builds cleanly.`;

    case "web":
      return `Please integrate the FeedbackKit web SDK ${projectContext}into this web app.

1. Install the package (npm: \`feedbackkit-web\`):
   \`\`\`bash
   npm install feedbackkit-web
   \`\`\`
   (No bundler? Use the script tag instead:
   \`<script src="https://cdn.jsdelivr.net/npm/feedbackkit-web/dist/feedbackkit.iife.js"></script>\`,
   which exposes \`window.FeedbackKit\`.)

2. Configure FeedbackKit once, as early as possible on the client (so console errors from startup are captured too):
   \`\`\`ts
   import { FeedbackKit } from "feedbackkit-web";

   FeedbackKit.configure({
     projectKey: "${projectKey}",
     endpoint: "${endpointUrl}",
     appVersion: "1.0.0", // optional: your app's version/build
   });
   \`\`\`
   - Vite/CRA/plain SPA: the client entry file (e.g. src/main.tsx).
   - Next.js (App Router): a \`"use client"\` component rendered from the root layout, calling configure in a \`useEffect\` — the SDK touches \`window\`/\`document\`, so it must never run during server rendering.
   - Nuxt/SvelteKit/others: a client-only plugin / \`onMount\`.

3. Add a trigger so users can send feedback:
   - Option A: floating button — \`FeedbackKit.showFloatingTriggerButton()\`
   - Option B: your own button/menu item — \`FeedbackKit.presentAndSubmit()\`
   - Option C: keyboard shortcut (⌘⇧F / Ctrl+Shift+F) — \`FeedbackKit.enableKeyboardShortcut()\`

4. Screen tracking (recommended): set \`FeedbackKit.currentScreen = "Checkout"\` on route changes (from the router's navigation hook) so reports name the page; it falls back to \`location.pathname\`.

5. Optional branding: \`FeedbackKit.theme = { primaryColorHex: "#RRGGBB" }\` using the app's brand color.

6. Close the loop (recommended): call \`FeedbackKit.enableFixVerification()\` after \`configure\` so reporters are asked "is it fixed?" once a fix ships, and pass \`appBuild\` (your build/deploy id) to \`configure\` if the app has one. Run \`npx feedbackkit-cli release --build <build id>\` from the repo as a post-deploy step so merged fixes are marked shipped.

Please inspect the project, identify the framework and its client entry point, install the package, configure FeedbackKit client-side only, wire up a trigger that fits the existing UI, and verify the app builds and the feedback dialog opens.`;
  }
}
