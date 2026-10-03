export type TargetPlatform =
  | "ios"
  | "macos"
  | "multiplatform"
  | "watchos"
  | "android"
  | "flutter"
  | "react-native"
  | "web";

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

    case "android":
      return `Please integrate the FeedbackKit Android SDK ${projectContext}into this Android app project.

1. Add the dependency (served by JitPack from the GitHub release tag):
   - In settings.gradle(.kts), add the JitPack repository to dependencyResolutionManagement.repositories:
     \`\`\`kotlin
     maven { url = uri("https://jitpack.io") }
     \`\`\`
   - In the app module's build.gradle(.kts):
     \`\`\`kotlin
     implementation("com.github.tianhaoz95.feedback-kit:feedbackkit:v<latest release>")
     \`\`\`
     Use the newest vX.Y.Z tag from https://github.com/tianhaoz95/feedback-kit/releases. minSdk must be 24 or higher.

2. Configure FeedbackKit in Application.onCreate() (create an Application subclass and register it in AndroidManifest.xml if the app has none):
   \`\`\`kotlin
   import com.feedbackkit.FeedbackKit
   import com.feedbackkit.FeedbackKitConfiguration

   FeedbackKit.configure(FeedbackKitConfiguration(
       endpointUrl = "${endpointUrl}",
       projectKey = "${projectKey}",
   ))
   \`\`\`
   No other setup is needed: the SDK registers its editor activity through manifest merging and tracks the foreground activity itself.

3. Install a feedback trigger:
   - Option A: shake to report — \`FeedbackKit.enableShakeToReport()\`
   - Option B: draggable floating button on every activity — \`FeedbackKit.showFloatingTriggerButton()\`
   - Option C: from an existing button or menu item — \`FeedbackKit.presentAndSubmitIfConfigured()\`

4. Screen tracking: set \`FeedbackKit.currentScreen = "Checkout"\` as the user navigates (from a NavController destination listener, a Compose route change, or each screen). Without it, reports only name the activity class.

5. Optional branding: \`FeedbackKit.theme = FeedbackTheme(primaryColorHex = "#RRGGBB", secondaryColorHex = "#RRGGBB")\`.

6. Close the loop (recommended): call \`FeedbackKit.enableFixVerification()\` after configure so reporters are asked "is it fixed?" once a fix ships in the build they're running (it compares versionCode), and run \`npx feedbackkit-cli release --build <versionCode>\` after each release build.

Please inspect the project, find the Application class (or add one), add the dependency and configuration, wire up a trigger, set currentScreen from the app's navigation, and verify that the app builds.`;

    case "flutter":
      return `Please integrate FeedbackKit ${projectContext}into this Flutter app. The feedbackkit_flutter plugin runs the native FeedbackKit iOS and Android SDKs.

1. Add the plugin to pubspec.yaml (from GitHub until it's on pub.dev):
   \`\`\`yaml
   dependencies:
     feedbackkit_flutter:
       git:
         url: https://github.com/tianhaoz95/feedback-kit
         path: flutter/feedbackkit_flutter
   \`\`\`
   Then run \`flutter pub get\`. Requirements: Android minSdk 24 (android/app/build.gradle(.kts)), iOS 15.0+.

2. Configure FeedbackKit in main() before runApp:
   \`\`\`dart
   import 'package:feedbackkit_flutter/feedbackkit_flutter.dart';

   Future<void> main() async {
     WidgetsFlutterBinding.ensureInitialized();
     await FeedbackKit.configure(const FeedbackKitConfiguration(
       endpointUrl: '${endpointUrl}',
       projectKey: '${projectKey}',
     ));
     await FeedbackKit.showFloatingTriggerButton();
     await FeedbackKit.enableShakeToReport();
     runApp(const MyApp());
   }
   \`\`\`

3. Screen tracking: add \`FeedbackKitNavigatorObserver()\` to MaterialApp's navigatorObservers (it uses route names), or call \`FeedbackKit.setCurrentScreen('Checkout')\` where the app changes screens without named routes (tabs, go_router redirects).

4. Optional: \`FeedbackKit.presentAndSubmitIfConfigured()\` from an existing "Report a problem" button, \`FeedbackKit.setTheme(const FeedbackTheme(primaryColorHex: '#RRGGBB', secondaryColorHex: '#RRGGBB'))\` for branding, and \`FeedbackKit.onSubmissionResult = (result) { ... }\` to show a confirmation.

5. Close the loop (recommended): call \`FeedbackKit.enableFixVerification()\` after configure, and run \`npx feedbackkit-cli release --build <build number>\` after each release build (the build number in pubspec's version, after the +).

Please inspect the project, add the dependency, configure FeedbackKit in main(), wire up triggers and screen tracking, and verify that the app builds for both Android and iOS.`;

    case "react-native":
      return `Please integrate FeedbackKit ${projectContext}into this React Native app. The feedbackkit-react-native module runs the native FeedbackKit iOS and Android SDKs. It needs the New Architecture (React Native 0.76+).

1. Install the package:
   \`\`\`bash
   npm install feedbackkit-react-native
   \`\`\`
   - iOS: add the native SDK to ios/Podfile inside the app target, then run \`pod install\`:
     \`\`\`ruby
     pod 'FeedbackKit', :git => 'https://github.com/tianhaoz95/feedback-kit.git', :tag => 'v<same version as the npm package>'
     \`\`\`
   - Android: nothing else (minSdk 24+).
   - Expo: use a development build (prebuild); Expo Go can't load native modules.

2. Configure FeedbackKit once at startup (e.g. in index.js or the root component's module scope):
   \`\`\`ts
   import { FeedbackKit } from 'feedbackkit-react-native';

   FeedbackKit.configure({
     endpointUrl: '${endpointUrl}',
     projectKey: '${projectKey}',
   });
   FeedbackKit.showFloatingTriggerButton();
   FeedbackKit.enableShakeToReport();
   \`\`\`

3. Screen tracking: call \`FeedbackKit.setCurrentScreen(name)\` on navigation changes, e.g. from React Navigation's NavigationContainer onStateChange with navigationRef.getCurrentRoute()?.name.

4. Optional: \`FeedbackKit.presentAndSubmitIfConfigured()\` from an existing "Report a problem" button, \`FeedbackKit.setTheme({ primaryColorHex: '#RRGGBB', secondaryColorHex: '#RRGGBB' })\`, and \`FeedbackKit.onSubmissionResult(listener)\` (returns an unsubscribe function) for a confirmation toast.

5. Close the loop (recommended): call \`FeedbackKit.enableFixVerification()\` after configure, and run \`npx feedbackkit-cli release --build <build number>\` after each release build.

Please inspect the project, install the package and the iOS pod, configure FeedbackKit at startup, wire up triggers and screen tracking, and verify that the app builds on iOS and Android.`;

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
