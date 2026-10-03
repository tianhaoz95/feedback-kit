# feedbackkit-react-native

In-app feedback for React Native apps: the user captures a screenshot, marks
it up, describes the problem, and you get a structured `FeedbackReport`.
Optionally it's delivered straight to the hosted
[FeedbackKit](https://github.com/tianhaoz95/feedback-kit) dashboard.

This package is a thin TurboModule. Capture, the annotation editor, and the
transport are the native FeedbackKit SDKs (Swift on iOS, Kotlin on Android).
That means:

- The flow is identical to FeedbackKit in a native app.
- Reports follow the native JSON contract (`osName` is `iOS` or `Android`), so
  the dashboard, CLI and agent prompts handle them unchanged.

Requires the New Architecture (React Native 0.76+), iOS 15.1+, Android `minSdk` 24+.

## Install

```sh
npm install feedbackkit-react-native
```

**iOS.** The Swift SDK isn't on the CocoaPods trunk yet, so add it to `ios/Podfile`
inside your app target, then run `pod install`:

```ruby
pod 'FeedbackKit', :git => 'https://github.com/tianhaoz95/feedback-kit.git', :tag => 'v1.0.62'
```

"Take Photo" in the attach menu appears only if `Info.plist` has
`NSCameraUsageDescription`.

**Android.** Nothing to set up. The SDK ships inside the package and registers
its editor activity through manifest merging.

## Use

```tsx
import { FeedbackKit } from 'feedbackkit-react-native';

// Optional: deliver reports to the hosted dashboard.
FeedbackKit.configure({
  endpointUrl: 'https://<project>.supabase.co/functions/v1/ingest-feedback',
  projectKey: 'pk_live_...',
});

// Triggers (native UI):
FeedbackKit.showFloatingTriggerButton();
FeedbackKit.enableShakeToReport();
FeedbackKit.enableFixVerification(); // "is it fixed?" once a fix ships

const unsubscribe = FeedbackKit.onSubmissionResult((result) => {
  // { status: 'success', report } | { status: 'failure', error }
});

// Label reports with the current screen, e.g. from React Navigation:
<NavigationContainer onStateChange={() => FeedbackKit.setCurrentScreen(navigationRef.getCurrentRoute()?.name ?? null)} />

// From your own button:
const report = await FeedbackKit.present();          // you deliver it (PNGs are base64)
const result = await FeedbackKit.presentAndSubmit(); // sends it to the dashboard
```

Also: `setTheme({ primaryColorHex, secondaryColorHex })`, `setUser({ id, email, name })`,
`setDefaultProductKey(key)`, `reporterId`, `presentFixUpdatesIfNeeded()`.

## Demo app

`example/` is the same Home / Cart / Settings sample as the native demos:

```sh
corepack yarn               # from react-native/
corepack yarn example ios   # or: corepack yarn example android
```

Inside this repository the module builds against the SDKs in the repo: the
example's Podfile points `FeedbackKit` at the repo root, and
`android/build.gradle` compiles `../android/feedbackkit`. That way SDK changes
can be tested here right away. `npm pack`/`publish` runs
`scripts/vendor-native-sdks.sh` to bundle the Android SDK into the package.

In dev builds the example sets `globalThis.FeedbackKit`, so scripts can drive
it through the Hermes debugger, since simulators can't be tapped from the
command line.
