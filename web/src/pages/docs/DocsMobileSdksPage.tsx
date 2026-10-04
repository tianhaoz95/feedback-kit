import { CodeBlock } from "@/components/docs/CodeBlock";
import { DocsCallout, DocsList, DocsSection, DocsTable, DocsTitle, InlineCode } from "@/components/docs/DocsProse";

const androidInstall = `// settings.gradle.kts
dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
        maven { url = uri("https://jitpack.io") }
    }
}

// app/build.gradle.kts — use the latest vX.Y.Z release tag
dependencies {
    implementation("com.github.tianhaoz95.feedback-kit:feedbackkit:v<latest release>")
}`;

const androidUsage = `import com.feedbackkit.FeedbackKit
import com.feedbackkit.FeedbackKitConfiguration
import com.feedbackkit.FeedbackTheme

class MyApp : Application() {
    override fun onCreate() {
        super.onCreate()
        // Optional: deliver reports to the hosted dashboard.
        FeedbackKit.configure(FeedbackKitConfiguration(
            endpointUrl = "https://<project>.supabase.co/functions/v1/ingest-feedback",
            projectKey = "pk_live_...",
        ))
        FeedbackKit.showFloatingTriggerButton()   // on every activity
        FeedbackKit.enableShakeToReport()         // only listens while in the foreground
        FeedbackKit.enableFixVerification()       // "is it fixed?" once a fix ships
        FeedbackKit.theme = FeedbackTheme("#7C3AED", "#F97316") // optional
    }
}

// Keep reports labelled with the screen the user is on:
FeedbackKit.currentScreen = "Checkout"

// From your own button — you deliver the report:
FeedbackKit.present { report -> report?.let(::sendToMyBackend) }
// …or send it to the dashboard:
FeedbackKit.presentAndSubmitIfConfigured()`;

const flutterInstall = `dependencies:
  feedbackkit_flutter:
    git:
      url: https://github.com/tianhaoz95/feedback-kit
      path: flutter/feedbackkit_flutter`;

const flutterUsage = `import 'package:feedbackkit_flutter/feedbackkit_flutter.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await FeedbackKit.configure(const FeedbackKitConfiguration(
    endpointUrl: 'https://<project>.supabase.co/functions/v1/ingest-feedback',
    projectKey: 'pk_live_...',
  ));
  await FeedbackKit.showFloatingTriggerButton();
  await FeedbackKit.enableShakeToReport();
  await FeedbackKit.enableFixVerification();
  FeedbackKit.onSubmissionResult = (result) { /* success or failure */ };

  runApp(MaterialApp(
    navigatorObservers: [FeedbackKitNavigatorObserver()], // labels reports with route names
    home: const HomePage(),
  ));
}

// From your own button:
final report = await FeedbackKit.present();          // you deliver it
final result = await FeedbackKit.presentAndSubmit(); // sends it to the dashboard`;

const rnInstall = `npm install feedbackkit-react-native

# ios/Podfile, inside your app target — the same version as the npm package:
pod 'FeedbackKit', :git => 'https://github.com/tianhaoz95/feedback-kit.git', :tag => 'v<version>'

cd ios && pod install`;

const rnUsage = `import { FeedbackKit } from 'feedbackkit-react-native';

FeedbackKit.configure({
  endpointUrl: 'https://<project>.supabase.co/functions/v1/ingest-feedback',
  projectKey: 'pk_live_...',
});
FeedbackKit.showFloatingTriggerButton();
FeedbackKit.enableShakeToReport();
FeedbackKit.enableFixVerification();

const unsubscribe = FeedbackKit.onSubmissionResult((result) => {
  // { status: 'success', report } | { status: 'failure', error }
});

// With React Navigation:
<NavigationContainer
  ref={navigationRef}
  onStateChange={() => FeedbackKit.setCurrentScreen(navigationRef.getCurrentRoute()?.name ?? null)}
/>

// From your own button (PNGs arrive base64-encoded):
const report = await FeedbackKit.present();
const result = await FeedbackKit.presentAndSubmit();`;

export function DocsMobileSdksPage() {
  return (
    <div>
      <DocsTitle
        eyebrow="SDK"
        title="Android, Flutter & React Native"
        description="A native Android SDK with the same flow as the iOS one: capture the screen,
          mark it up, describe the problem, get a structured FeedbackReport. The Flutter plugin and
          the React Native module are thin bridges over the native iOS and Android SDKs, so the
          editor, the capture and the report are exactly what a native app gets."
      />

      <DocsSection title="Which package">
        <DocsTable
          columns={["App", "Package", "Under the hood"]}
          rows={[
            [<>Native Android (Kotlin/Java, Views or Compose)</>, <InlineCode>com.github.tianhaoz95.feedback-kit:feedbackkit</InlineCode>, <>The Android SDK</>],
            [<>Flutter</>, <InlineCode>feedbackkit_flutter</InlineCode>, <>Swift SDK on iOS, Android SDK on Android</>],
            [<>React Native (New Architecture)</>, <InlineCode>feedbackkit-react-native</InlineCode>, <>Swift SDK on iOS, Android SDK on Android</>],
          ]}
        />
        <p>
          Reports from all three use the same JSON contract as the iOS SDK. <InlineCode>osName</InlineCode> is{" "}
          <InlineCode>Android</InlineCode> or <InlineCode>iOS</InlineCode>, the dashboard shows the matching platform
          badge, and prompts, the CLI and the Portal handle them unchanged.
        </p>
      </DocsSection>

      <DocsSection title="Requirements">
        <DocsList
          items={[
            <>Android: <InlineCode>minSdk 24</InlineCode> or higher. The SDK has no dependencies beyond the Kotlin standard library.</>,
            <>iOS (Flutter and React Native): iOS 15 or later</>,
            <>React Native: 0.76 or later with the New Architecture. Expo works with a development build, not Expo Go.</>,
          ]}
        />
      </DocsSection>

      <DocsSection title="Android">
        <CodeBlock code={androidInstall} label="Gradle (Kotlin DSL)" />
        <p>
          Nothing goes in your manifest: the SDK merges in its editor activity, and a small initializer
          tracks which activity is in front. That's why <InlineCode>present()</InlineCode> and the triggers
          don't need an <InlineCode>Activity</InlineCode> argument.
        </p>
        <CodeBlock code={androidUsage} label="Kotlin" />
        <DocsCallout>
          Capture uses <InlineCode>PixelCopy</InlineCode> on the app's own window, plus each visible SurfaceView
          composited at its position (video, maps, Flutter). There's no MediaProjection prompt. The floating button
          hides for the shot, and the capture indicator, dialogs and keyboard aren't included.
        </DocsCallout>
      </DocsSection>

      <DocsSection title="Flutter">
        <CodeBlock code={flutterInstall} label="pubspec.yaml" />
        <p>
          On iOS, Flutter&apos;s Swift Package Manager integration resolves the native SDK automatically. If your app
          still builds plugins with CocoaPods, add{" "}
          <InlineCode>pod &apos;FeedbackKit&apos;, :git =&gt; &apos;https://github.com/tianhaoz95/feedback-kit.git&apos;</InlineCode>{" "}
          to <InlineCode>ios/Podfile</InlineCode>.
        </p>
        <CodeBlock code={flutterUsage} label="Dart" />
      </DocsSection>

      <DocsSection title="React Native">
        <CodeBlock code={rnInstall} label="Terminal" />
        <CodeBlock code={rnUsage} label="TypeScript" />
      </DocsSection>

      <DocsSection title="Tracking the current screen">
        <p>
          Flutter, React Native and most Compose apps run in a single activity or view controller, so the native
          fallback (the activity or view controller name) says almost nothing. Set the screen name as the user
          navigates: <InlineCode>FeedbackKit.currentScreen</InlineCode> on Android,{" "}
          <InlineCode>FeedbackKitNavigatorObserver</InlineCode> or <InlineCode>setCurrentScreen</InlineCode> in Flutter,
          and <InlineCode>setCurrentScreen</InlineCode> in React Native.
        </p>
      </DocsSection>

      <DocsSection title="Closing the loop">
        <p>
          <InlineCode>enableFixVerification()</InlineCode> shows the reporter their original screenshot once a fix ships
          in the build they&apos;re running. On Android that build is the app&apos;s <InlineCode>versionCode</InlineCode>,
          so announce releases with it:
        </p>
        <CodeBlock code="npx feedbackkit-cli release --build <versionCode>" label="Terminal" />
      </DocsSection>

      <DocsSection title="Try it">
        <p>
          Each SDK has a demo app: the same Home / Cart / Settings sample as the iOS demo. Paste a project key in
          Settings to send reports to your dashboard.
        </p>
        <DocsList
          items={[
            <><InlineCode>android/</InlineCode>: <InlineCode>./scripts/run-android.sh</InlineCode> (Compose and classic Views screens)</>,
            <><InlineCode>flutter/feedbackkit_flutter/example</InlineCode>: <InlineCode>flutter run</InlineCode></>,
            <><InlineCode>react-native/example</InlineCode>: <InlineCode>corepack yarn example ios</InlineCode> or <InlineCode>android</InlineCode></>,
          ]}
        />
      </DocsSection>
    </div>
  );
}
