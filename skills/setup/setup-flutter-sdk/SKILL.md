---
name: setup-flutter-sdk
description: Integrate FeedbackKit into a Flutter app with the feedbackkit_flutter plugin, which runs the native FeedbackKit iOS and Android SDKs — adds the dependency, configures the project key in main(), adds triggers, wires route names as screen names, and enables "is it fixed?" verification.
---

# setup-flutter-sdk

Integrates FeedbackKit into a Flutter app through `feedbackkit_flutter`. The plugin is a thin bridge: the capture, annotation editor and submission are the native FeedbackKit SDKs on iOS and Android, so reports look exactly like native ones.

## When to Use

- Use when adding in-app feedback or bug reporting with annotated screenshots to a Flutter app.
- Trigger phrases: "add feedbackkit to my flutter app", "setup feedbackkit flutter", "flutter bug report button".

## Prerequisites

- Flutter 3.24+. Android `minSdk 24`, iOS 15.0+.
- A FeedbackKit project key and endpoint URL from the dashboard's **SDK setup** tab. Optional if the app only handles reports locally via `FeedbackKit.present()`.

## Step-by-Step Instructions

### Step 1 -- Add the plugin

Until it's on pub.dev, depend on it from GitHub (pin `ref:` to a release tag if the project pins dependencies):

```yaml
dependencies:
  feedbackkit_flutter:
    git:
      url: https://github.com/tianhaoz95/feedback-kit
      path: flutter/feedbackkit_flutter
```

Then:

- Run `flutter pub get`.
- Make sure `android/app/build.gradle(.kts)` has `minSdk = 24` or higher. Replace `flutter.minSdkVersion` if that's lower.
- Make sure the iOS deployment target is 15.0 or higher.
- iOS with Swift Package Manager (Flutter's default) needs nothing else.
- If the app builds iOS plugins with CocoaPods (an `ios/Podfile` exists and SwiftPM is disabled), add this inside the Runner target:

  ```ruby
  pod 'FeedbackKit', :git => 'https://github.com/tianhaoz95/feedback-kit.git'
  ```

### Step 2 -- Configure in `main()`

```dart
import 'package:feedbackkit_flutter/feedbackkit_flutter.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await FeedbackKit.configure(const FeedbackKitConfiguration(
    endpointUrl: '<endpoint from the dashboard>',
    projectKey: '<project key>',
  ));
  await FeedbackKit.showFloatingTriggerButton();
  await FeedbackKit.enableShakeToReport();
  await FeedbackKit.enableFixVerification();
  runApp(const MyApp());
}
```

### Step 3 -- Track the current screen

- With named routes (`Navigator`, `MaterialApp.routes`, `onGenerateRoute`): add the observer:
  ```dart
  MaterialApp(navigatorObservers: [FeedbackKitNavigatorObserver()], …)
  ```
- With go_router: pass `observers: [FeedbackKitNavigatorObserver()]` to `GoRouter`, and give routes a `name`.
- With tabs or other non-route navigation: call `FeedbackKit.setCurrentScreen('Cart')` when the visible screen changes.

### Step 4 -- Optional: own button, branding, user, confirmation

```dart
ElevatedButton(onPressed: FeedbackKit.presentAndSubmitIfConfigured, child: const Text('Report a problem'));
await FeedbackKit.setTheme(const FeedbackTheme(primaryColorHex: '#RRGGBB', secondaryColorHex: '#RRGGBB'));
await FeedbackKit.setUser(FeedbackUser(id: user.id, email: user.email));
FeedbackKit.onSubmissionResult = (result) {
  if (result is FeedbackSubmissionSuccess) { /* show a snackbar */ }
};
```

### Step 5 -- Close the loop

`enableFixVerification()` asks the reporter "is it fixed?" once a fix ships in the build they're running. It compares the build number (the `+N` in pubspec's `version`, i.e. iOS `CFBundleVersion` / Android `versionCode`). Announce each release build:

```bash
npx feedbackkit-cli release --build <build number>
```

### Step 6 -- Verify

Run on both platforms (`flutter run -d <android device>` and an iOS simulator). Tap the floating button, draw, describe and send. The report appears in the dashboard with an **iOS** or **Android** badge.
