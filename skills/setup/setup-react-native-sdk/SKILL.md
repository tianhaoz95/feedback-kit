---
name: setup-react-native-sdk
description: Integrate FeedbackKit into a React Native app with feedbackkit-react-native, a TurboModule that runs the native FeedbackKit iOS and Android SDKs — installs the package and iOS pod, configures the project key, adds triggers, wires React Navigation screen names, and enables "is it fixed?" verification.
---

# setup-react-native-sdk

Integrates FeedbackKit into a React Native app through `feedbackkit-react-native`. The module is a thin bridge: the capture, annotation editor and submission are the native FeedbackKit SDKs on iOS and Android, so reports look exactly like native ones.

## When to Use

- Use when adding in-app feedback or bug reporting with annotated screenshots to a React Native app.
- Trigger phrases: "add feedbackkit to my react native app", "setup feedbackkit react native", "react native shake to report".

## Prerequisites

- React Native 0.76+ with the New Architecture (the default since 0.76).
- Android `minSdk 24`, iOS 15.1+.
- Expo apps need a development build (`npx expo prebuild` / EAS). Expo Go can't load native modules.
- A FeedbackKit project key and endpoint URL from the dashboard's **SDK setup** tab.

## Step-by-Step Instructions

### Step 1 -- Install the package and the iOS SDK

```bash
npm install feedbackkit-react-native   # or yarn add / pnpm add
```

The Swift SDK isn't on the CocoaPods trunk, so add it to `ios/Podfile` inside the app target, with the same version as the npm package:

```ruby
pod 'FeedbackKit', :git => 'https://github.com/tianhaoz95/feedback-kit.git', :tag => 'v<package version>'
```

Then run `cd ios && pod install`. Android needs nothing else.

### Step 2 -- Configure once at startup

In `index.js` or at module scope in the root component's file:

```ts
import { FeedbackKit } from 'feedbackkit-react-native';

FeedbackKit.configure({
  endpointUrl: '<endpoint from the dashboard>',
  projectKey: '<project key>',
});
FeedbackKit.showFloatingTriggerButton();
FeedbackKit.enableShakeToReport();
FeedbackKit.enableFixVerification();
```

On iOS in debug builds, React Native's dev menu also listens for shakes. Release builds aren't affected.

### Step 3 -- Track the current screen

With React Navigation:

```tsx
const navigationRef = useNavigationContainerRef();

<NavigationContainer
  ref={navigationRef}
  onReady={() => FeedbackKit.setCurrentScreen(navigationRef.getCurrentRoute()?.name ?? null)}
  onStateChange={() => FeedbackKit.setCurrentScreen(navigationRef.getCurrentRoute()?.name ?? null)}
>
```

With Expo Router, call `FeedbackKit.setCurrentScreen(pathname)` from a `usePathname()` effect in the root layout.

### Step 4 -- Optional: own button, branding, user, confirmation

```tsx
<Button title="Report a problem" onPress={() => FeedbackKit.presentAndSubmitIfConfigured()} />

FeedbackKit.setTheme({ primaryColorHex: '#RRGGBB', secondaryColorHex: '#RRGGBB' });
FeedbackKit.setUser({ id: user.id, email: user.email });

useEffect(() => FeedbackKit.onSubmissionResult((result) => {
  if (result.status === 'success') showToast('Thanks for the feedback!');
}), []);
```

`FeedbackKit.present()` resolves with the report (PNGs base64) for apps that deliver reports themselves.

### Step 5 -- Close the loop

`enableFixVerification()` asks the reporter "is it fixed?" once a fix ships in the build they're running (iOS `CFBundleVersion`, Android `versionCode`). Announce each release build:

```bash
npx feedbackkit-cli release --build <build number>
```

### Step 6 -- Verify

Run on both platforms (`npx react-native run-ios` / `run-android`, or `npx expo run:ios|android`). Tap the floating button, draw, describe and send. The report appears in the dashboard with an **iOS** or **Android** badge.
