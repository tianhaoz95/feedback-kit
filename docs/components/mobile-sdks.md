# Android, Flutter & React Native

A native Android SDK (`android/feedbackkit`) with the Swift SDK's flow and
report contract, and two thin bridges over the native iOS and Android SDKs:
the Flutter plugin (`flutter/feedbackkit_flutter`) and the React Native
module (`react-native/`, npm `feedbackkit-react-native`). User-facing docs
live on the dashboard at `/docs/mobile-sdks`; this page is for contributors.
The reasoning behind the design is in `DESIGN.md` §1c.

## Android SDK layout (`android/feedbackkit/src/main/java/com/feedbackkit/`)

| Path | What |
|---|---|
| `FeedbackKit.kt` | Public API: configure, present, presentAndSubmit(IfConfigured), triggers, theme, user, fix verification |
| `Models.kt` | `FeedbackReport`, `FeedbackAnnotation`, `FeedbackEnvironment`, … — mirrors `FeedbackReport.swift` |
| `AnnotationRenderer.kt` | Port of the Swift `AnnotationRenderer` (drawing + hit-testing; lengths × `unit`) |
| `FeedbackSubmitter.kt`, `FixUpdatesClient.kt`, `FixUpdate.kt` | Transport, mirroring the Swift clients; `FeedbackBuild` = `compare_builds` |
| `FeedbackKitBridge.kt` | Plain-map conversions the Flutter/RN wrappers share |
| `internal/WireFormat.kt` | The ingest JSON — same shape as Swift's `IngestPayload` |
| `internal/ScreenshotCapture.kt` | `PixelCopy` of the window + SurfaceViews composited underneath |
| `internal/ActivityTracker.kt` | Manifest-merged initializer + foreground activity tracking |
| `ui/` | `FeedbackActivity` (editor), `AnnotationCanvasView`, `AnnotationToolbar`, capture indicator, trigger button, fix-verification dialog |

```bash
cd android
./gradlew :feedbackkit:testDebugUnitTest
./gradlew :feedbackkit:assembleRelease :demo:assembleDebug
../scripts/run-android.sh
```

## The bridges

Both forward every call to the native `FeedbackKit` and convert with
`FeedbackKitBridge` (Swift `Sources/FeedbackKit/Bridge/`, Kotlin
`FeedbackKitBridge.kt`). Keep their keys in step with
`flutter/feedbackkit_flutter/lib/src/models.dart` and
`react-native/src/types.ts`.

| | Flutter | React Native |
|---|---|---|
| Transport | Method channel `feedbackkit` | TurboModule `FeedbackKit` (codegen spec `src/NativeFeedbackKit.ts`) |
| Android native code | `android/src/main/kotlin/.../FeedbackKitFlutterPlugin.kt` | `android/src/main/java/com/feedbackkit/reactnative/` |
| iOS native code | `ios/feedbackkit_flutter/Sources/.../FeedbackKitFlutterPlugin.swift` | `ios/FeedbackKitModule.mm` → `ios/FeedbackKitRNBridge.swift` |
| Swift SDK from | `Package.swift` path dependency (in repo) / GitHub tag | `FeedbackKit` pod (`:path` in the example's Podfile) |
| Android SDK from | Gradle `sourceSets` → `android/feedbackkit` (vendored on publish) | same (vendored by `prepack`) |
| Binary fields | Raw bytes (`Uint8List`) | base64 strings |
| Native-started submissions | `onSubmissionResult` channel callback | `onSubmissionResult` codegen `EventEmitter` |

```bash
cd flutter/feedbackkit_flutter && flutter analyze && flutter test
cd example && flutter run

cd react-native && corepack yarn && corepack yarn typecheck && corepack yarn test
corepack yarn example ios   # or android
```

Gotchas worth knowing:

- Flutter names the plugin's SwiftPM symlink after its directory, so the
  directory must stay `feedbackkit_flutter`, the package name.
- The wrappers' Android Gradle namespace is `com.feedbackkit`, because the
  SDK's sources and their `R` references compile into them. That's why the
  React Native package spells out its autolinking import in
  `react-native.config.js`.
- On iOS, the React Native module name maps to its ObjC class through
  `codegenConfig.ios.modulesProvider` in `package.json`. Without it,
  `TurboModuleRegistry.getEnforcing('FeedbackKit')` throws at startup.

## Demo apps

All three repeat the iOS demo's Home / Cart / Settings sample, including the
same `CartStore` idea, the branding presets and the Settings fields. CI builds
them in `android-ci.yml`, `flutter-ci.yml` and `react-native-ci.yml`.
