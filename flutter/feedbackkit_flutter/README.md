# feedbackkit_flutter

In-app feedback for Flutter apps: the user captures a screenshot, marks it up,
describes the problem, and you get a structured `FeedbackReport`. Optionally
it's delivered straight to the hosted [FeedbackKit](https://github.com/tianhaoz95/feedback-kit)
dashboard.

This plugin is a thin bridge. Capture, the annotation editor, and the
transport are the native FeedbackKit SDKs (Swift on iOS, Kotlin on Android).
That means:

- The flow looks and behaves exactly like FeedbackKit in a native app, with
  the same pen, rectangle, arrow, text and move tools, the composer menu, and
  products.
- Reports follow the same JSON contract as native reports (`osName` is `iOS` or
  `Android`), so the dashboard, CLI and coding-agent prompts handle them
  unchanged.
- Flutter's own rendering is captured, including Android's SurfaceView renderer.

## Install

```yaml
dependencies:
  feedbackkit_flutter: ^1.0.62
```

- **Android:** `minSdk 24` or higher. Nothing else to set up. The SDK registers its
  editor activity through manifest merging.
- **iOS:** iOS 15+. With Swift Package Manager (Flutter's default) the native
  SDK resolves automatically. If your app uses CocoaPods for plugins, add the
  SDK to `ios/Podfile`:

  ```ruby
  pod 'FeedbackKit', :git => 'https://github.com/tianhaoz95/feedback-kit.git', :tag => 'v1.0.62'
  ```

  "Take Photo" in the attach menu appears only if `Info.plist` has
  `NSCameraUsageDescription`.

## Use

```dart
import 'package:feedbackkit_flutter/feedbackkit_flutter.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Optional: deliver reports to the hosted dashboard.
  await FeedbackKit.configure(const FeedbackKitConfiguration(
    endpointUrl: 'https://<project>.supabase.co/functions/v1/ingest-feedback',
    projectKey: 'pk_live_...',
  ));

  // Triggers (native UI):
  await FeedbackKit.showFloatingTriggerButton();
  await FeedbackKit.enableShakeToReport();
  await FeedbackKit.enableFixVerification(); // "is it fixed?" once a fix ships

  FeedbackKit.onSubmissionResult = (result) { /* success or failure */ };

  runApp(MaterialApp(
    // Labels every report with the current route name.
    navigatorObservers: [FeedbackKitNavigatorObserver()],
    home: const HomePage(),
  ));
}

// From your own button:
final report = await FeedbackKit.present();              // you deliver it
final result = await FeedbackKit.presentAndSubmit();     // sends it to the dashboard
```

Other calls: `setTheme(FeedbackTheme(...))`, `setUser(FeedbackUser(...))`,
`setCurrentScreen(...)`, `setDefaultProductKey(...)`, `reporterId`,
`presentFixUpdatesIfNeeded()`.

## Demo app

`example/` is the same Home / Cart / Settings sample as the native demos:

```bash
cd example
flutter run            # pick an iOS simulator or Android emulator
```

Inside this repository the plugin builds against the SDK sources in the repo
(`../../Sources/FeedbackKit`, `../../android/feedbackkit`), so SDK changes are
testable here right away. Run `tool/vendor_native_sdks.sh` before
`flutter pub publish`.
