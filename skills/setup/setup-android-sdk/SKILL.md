---
name: setup-android-sdk
description: Integrate the native FeedbackKit Android SDK into an Android app (Kotlin or Java, Jetpack Compose or Views) — adds the JitPack dependency, configures the project key in Application.onCreate, adds a feedback trigger, wires screen names from navigation, and enables "is it fixed?" verification.
---

# setup-android-sdk

Integrates FeedbackKit's native Android SDK. Users capture a screenshot, mark it up, describe the problem, and the report goes to the FeedbackKit dashboard (or to the app, via `FeedbackKit.present`). It's the same flow and report format as the iOS SDK.

## When to Use

- Use when adding in-app feedback or bug reporting with annotated screenshots to a native Android app.
- Trigger phrases: "add feedbackkit to my android app", "setup feedbackkit android", "add shake to report on android".
- For Flutter apps use `setup-flutter-sdk`; for React Native use `setup-react-native-sdk`.

## Prerequisites

- An Android app with `minSdk 24` or higher.
- A FeedbackKit project key and endpoint URL from the dashboard's **SDK setup** tab. Optional if the app only handles reports locally via `FeedbackKit.present`.

## Step-by-Step Instructions

### Step 1 -- Add the dependency (JitPack)

In `settings.gradle(.kts)`:

```kotlin
dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
        maven { url = uri("https://jitpack.io") }
    }
}
```

In the app module's `build.gradle(.kts)`, use the newest `vX.Y.Z` tag from https://github.com/tianhaoz95/feedback-kit/releases:

```kotlin
dependencies {
    implementation("com.github.tianhaoz95.feedback-kit:feedbackkit:vX.Y.Z")
}
```

Projects that declare repositories in the root `build.gradle` (`allprojects { repositories { … } }`) add the JitPack line there instead.

### Step 2 -- Configure in `Application.onCreate()`

If the app has no `Application` subclass, create one and register it with `android:name` on `<application>` in `AndroidManifest.xml`.

```kotlin
import com.feedbackkit.FeedbackKit
import com.feedbackkit.FeedbackKitConfiguration

class MyApp : Application() {
    override fun onCreate() {
        super.onCreate()
        FeedbackKit.configure(FeedbackKitConfiguration(
            endpointUrl = "<endpoint from the dashboard>",
            projectKey = "<project key>",
        ))
        FeedbackKit.showFloatingTriggerButton()
        FeedbackKit.enableShakeToReport()
        FeedbackKit.enableFixVerification()
    }
}
```

Add nothing to the manifest: the SDK merges in its editor activity and tracks the foreground activity itself.

### Step 3 -- Choose triggers

- Floating draggable button on every activity: `FeedbackKit.showFloatingTriggerButton()`
- Shake to report (listens only in the foreground): `FeedbackKit.enableShakeToReport()`
- From an existing "Report a problem" button or menu item: `FeedbackKit.presentAndSubmitIfConfigured()`
- To deliver reports yourself: `FeedbackKit.present { report -> … }`

Keep the triggers the user asked for; default to the floating button plus shake.

### Step 4 -- Track the current screen

Without this, reports only name the activity class, which in a single-activity app says nothing. Set it from the app's navigation:

```kotlin
// Navigation component (Views or Compose):
navController.addOnDestinationChangedListener { _, destination, _ ->
    FeedbackKit.currentScreen = destination.label?.toString() ?: destination.route
}
```

### Step 5 -- Optional: branding, user, products

```kotlin
FeedbackKit.theme = FeedbackTheme(primaryColorHex = "#RRGGBB", secondaryColorHex = "#RRGGBB")
FeedbackKit.user = FeedbackUser(id = user.id, email = user.email)
FeedbackKit.onSubmissionResult = { result -> /* toast on Success / Failure */ }
```

### Step 6 -- Close the loop

`enableFixVerification()` (Step 2) asks the reporter "is it fixed?" once a fix ships in the build they're running. It compares the app's `versionCode`, so announce each release build with that number:

```bash
npx feedbackkit-cli release --build <versionCode>
```

See `setup-release-loop` for doing this from CI.

### Step 7 -- Verify

Build and run the app (`./gradlew :app:installDebug`), tap the floating button, draw on the screenshot, type a description and send. With a project key set, the report appears in the dashboard with an **Android** badge.

## Notes

- Capture uses `PixelCopy` on the app's own window, compositing SurfaceViews (video, maps) underneath. There's no screen-recording permission prompt.
- "Take Photo" in the attach menu needs a camera app. If the app declares `android.permission.CAMERA`, the SDK asks for it first.
- The SDK depends only on the Kotlin standard library, so no AppCompat or Compose versions are forced on the app.
