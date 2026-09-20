import { Link } from "react-router-dom";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { DocsCallout, DocsList, DocsSection, DocsTable, DocsTitle, InlineCode } from "@/components/docs/DocsProse";

const basicUsage = `import FeedbackKit

// Anywhere you have a presenting view controller — a button action,
// a debug menu item, whatever trigger you want:
FeedbackKit.present(from: self) { report in
    guard let report else { return } // user cancelled
    print("Got feedback: \\(report.text)")
    // Send \`report\` wherever you like — your own backend, a support
    // inbox, or FeedbackSubmitter (below) if you're using the dashboard.
}`;

const shakeAndButton = `// Somewhere in app startup:
FeedbackKit.enableShakeToReport {
    UIApplication.shared.topMostViewController
}

// and/or:
FeedbackKit.showFloatingTriggerButton {
    UIApplication.shared.topMostViewController
}`;

const macOSBasicUsage = `import FeedbackKit

// From a menu item action, a toolbar button, wherever:
FeedbackKit.present(from: view.window) { report in
    guard let report else { return } // user cancelled
    print("Got feedback: \\(report.text)")
}`;

const macOSButton = `// Somewhere in app startup — there's no enableShakeToReport on macOS
// (no motion sensor, no real equivalent gesture):
FeedbackKit.showFloatingTriggerButton {
    NSApplication.shared.keyWindow
}`;

const currentScreen = `// As the user navigates (e.g. in viewDidAppear, or a SwiftUI .onAppear):
FeedbackKit.currentScreen = "Checkout"`;

const dashboardConfig = `FeedbackKit.configure(
    .init(
        endpointURL: URL(string: "https://<your-project>.supabase.co/functions/v1/ingest-feedback")!,
        projectKey: "pk_live_..."
    )
)

// Then use presentAndSubmit instead of present — it still calls your
// completion handler, but also delivers the report to the dashboard:
FeedbackKit.presentAndSubmit(from: self) { result in
    switch result {
    case .success(let report):
        print("Submitted \\(report.id)")
    case .failure(let error):
        print("Failed to submit: \\(error)")
    }
}`;

const spmPackage = `.package(url: "https://github.com/tianhaoz95/feedback-kit", branch: "main")`;

const watchOSUsage = `import SwiftUI
import FeedbackKit

FeedbackKit.configure(.init(endpointURL: myEndpoint, projectKey: "pk_live_..."))
FeedbackKit.currentScreen = "Checkout"

// Embed this in your own presentation — there's no present(from:) on
// watchOS, since watch apps are SwiftUI-only with no window to present
// modally over:
.sheet(isPresented: $showingFeedback) {
    FeedbackQuickNoteView { report in
        guard let report else { return }
        FeedbackSubmitter.submit(report, configuration: myConfiguration) { _ in }
    }
}`;

export function DocsIosSdkPage() {
  return (
    <div>
      <DocsTitle
        eyebrow="SDK"
        title="iOS, macOS & watchOS SDK"
        description="One Swift Package. On iOS and macOS, it captures a screenshot, lets the user
          annotate it, and hands your app a structured report — works with UIKit, SwiftUI, or AppKit
          without needing to know which one built the screen on top. watchOS gets a deliberately
          smaller version of the same idea: no screenshot, no annotation tools, just a text
          description and device/app context — see the watchOS section below."
      />

      <DocsSection title="Requirements">
        <DocsList
          items={[
            <>iOS 15.0+, macOS 12.0+, or watchOS 8.0+</>,
            <>Swift 5.9 (swift-tools-version in the package)</>,
            <>No external dependencies</>,
          ]}
        />
      </DocsSection>

      <DocsSection title="Install">
        <p>In Xcode: File → Add Package Dependencies, then paste the repository URL:</p>
        <CodeBlock code="https://github.com/tianhaoz95/feedback-kit" label="Package URL" />
        <p>Or add it to your own <InlineCode>Package.swift</InlineCode>:</p>
        <CodeBlock code={spmPackage} label="Package.swift" />
        <p className="text-neutral-600">
          Same package either way — Xcode/SwiftPM picks the right build of <InlineCode>FeedbackKit</InlineCode> for
          whichever platform you're building.
        </p>
      </DocsSection>

      <DocsSection title="Basic usage" id="basic-usage">
        <p>
          One call is everything else in the SDK is built on: <InlineCode>FeedbackKit.present(from:completion:)</InlineCode>.
          It captures the current screen, presents the annotate/describe flow, and calls your
          completion handler with the finished report (or <InlineCode>nil</InlineCode> if the user
          cancelled). Delivery is entirely up to you — print it, POST it to your own backend, or use
          the dashboard path below.
        </p>
        <p className="text-sm font-medium text-neutral-900">iOS — presented modally over a view controller:</p>
        <CodeBlock code={basicUsage} label="Swift (iOS)" />
        <p className="text-sm font-medium text-neutral-900">
          macOS — presented as a sheet on a window (or a standalone window if you pass <InlineCode>nil</InlineCode>):
        </p>
        <CodeBlock code={macOSBasicUsage} label="Swift (macOS)" />
      </DocsSection>

      <DocsSection title="Triggers">
        <p>
          <InlineCode>enableShakeToReport</InlineCode> (iOS only) and <InlineCode>showFloatingTriggerButton</InlineCode> (both
          platforms) are convenience wrappers around <InlineCode>present(from:)</InlineCode> — call it directly
          instead if you already have your own trigger (a debug menu item, a settings row, a custom
          gesture).
        </p>
        <CodeBlock code={shakeAndButton} label="Swift (iOS)" />
        <p className="text-neutral-600">
          Shake detection swizzles <InlineCode>UIWindow.motionEnded</InlineCode> — the standard technique for
          this — so it works without subclassing your app's window.
        </p>
        <p>
          There's no shake trigger on macOS — no motion sensor, and no gesture that reads as an
          obvious equivalent — so the floating button is the recommended default there:
        </p>
        <CodeBlock code={macOSButton} label="Swift (macOS)" />
      </DocsSection>

      <DocsSection title="Tracking the current screen">
        <p>
          On iOS, FeedbackKit has no fully reliable way to know "what screen is this," so it uses a
          layered approach: a developer-set string (recommended) with best-effort auto-detection of
          the top UIKit view controller as a fallback. The fallback can't see SwiftUI-only screens,
          so setting this explicitly is worth doing. On macOS there's no fallback at all — no
          view-controller-stack convention to walk the way UIKit has one — so this is the only way
          a macOS report gets a screen name:
        </p>
        <CodeBlock code={currentScreen} label="Swift" />
      </DocsSection>

      <DocsSection title="Annotation tools">
        <p>
          The composer supports four tools — <strong>freehand</strong>, <strong>rectangle</strong>,{" "}
          <strong>arrow</strong>, and <strong>text</strong> — plus a drag tool for repositioning a shape
          (two-finger pinch to scale, two-finger twist to rotate on iOS; the same gestures on a Mac
          trackpad). Every shape is stored as normalized (0···1) points, so annotations render
          correctly at any screenshot resolution. On submit, the shapes are burned into a copy of the
          screenshot at its native pixel size — both the raw and the annotated PNG travel in the
          report, plus the structured shapes themselves.
        </p>
        <DocsCallout tone="warning">
          Scaling/rotating an existing annotation is trackpad-only on macOS — there's no plain-mouse
          equivalent for a two-finger gesture, so a mouse-only user can draw and move shapes but not
          resize or rotate one afterward.
        </DocsCallout>
      </DocsSection>

      <DocsSection title="Sending to the hosted dashboard">
        <p>
          Skip this section entirely if you're handling delivery yourself via{" "}
          <InlineCode>present(from:)</InlineCode>'s completion handler. If you want the SDK to also submit to
          the dashboard, configure it once at app startup with the endpoint URL and project key shown
          on your project's dashboard page (see{" "}
          <Link to="/docs/dashboard" className="link-underline font-medium text-neutral-900">
            Web dashboard
          </Link>
          ), then use <InlineCode>presentAndSubmit</InlineCode> instead of <InlineCode>present</InlineCode> (same
          signature change as <InlineCode>present</InlineCode> — a window instead of a view controller on
          macOS):
        </p>
        <CodeBlock code={dashboardConfig} label="Swift" />
        <DocsCallout>
          The project key is a routing key, not a secret — it can only ever <em>create</em> feedback for
          that project, never read anything, so it's safe to ship in an app binary.
        </DocsCallout>
      </DocsSection>

      <DocsSection title="watchOS: a stripped-down flow">
        <p>
          watchOS doesn't get a port of the iOS/macOS annotate flow — the screen is too small for
          freehand/rectangle/arrow drawing to be usable regardless of how it's implemented, and watch
          apps are SwiftUI-only with no window-level API to capture a screenshot from in the first
          place. Instead, <InlineCode>FeedbackQuickNoteView</InlineCode> is a plain SwiftUI view with just a
          text field, that you embed in your own presentation:
        </p>
        <CodeBlock code={watchOSUsage} label="Swift (watchOS)" />
        <p>
          There's no <InlineCode>present(from:)</InlineCode> on watchOS (no window to present modally
          over) and no <InlineCode>presentAndSubmit</InlineCode> either — call{" "}
          <InlineCode>FeedbackSubmitter.submit(_:configuration:completion:)</InlineCode> yourself from the
          view's completion handler, same function the other two platforms use under the hood.
        </p>
        <DocsCallout>
          A watchOS report's screenshot fields hold a small generated placeholder card, not a real
          screenshot — the actual content is <InlineCode>text</InlineCode> plus{" "}
          <InlineCode>environment</InlineCode> (device model, watchOS version, app version, locale),
          which the dashboard's prompt template placeholders already surface like any other report.
        </DocsCallout>
      </DocsSection>

      <DocsSection title="What's in a FeedbackReport">
        <DocsTable
          columns={["Field", "What it is"]}
          rows={[
            ["id / createdAt", "A generated identifier and timestamp."],
            ["text", "The user's free-text description."],
            ["screenshot (raw + annotated)", "Both PNGs — raw for record-keeping, annotated for actually looking at the bug."],
            ["annotations", "Each shape's kind, normalized points, color, and (for rectangle/arrow) scale/rotation."],
            ["environment", "OS name/version, device model, app version/build, bundle id, locale, screen size/scale, and the current screen name if set."],
            ["attachment", "An optional extra file the user picked from the composer's attach button."],
          ]}
        />
      </DocsSection>

      <DocsSection title="Try it">
        <p>
          The repo includes a small iOS sample app (one SwiftUI screen, one UIKit screen) with
          shake-to-report, the floating button, and manual "Report a Problem" buttons already wired
          up:
        </p>
        <CodeBlock code="./scripts/run-ios.sh" label="Terminal" />
        <p>
          There's no macOS sample app yet — <InlineCode>swift build</InlineCode> and{" "}
          <InlineCode>swift test</InlineCode> build and run the shared test suite natively on your
          Mac, no simulator required. Same for watchOS, but via a watch simulator destination:{" "}
          <InlineCode>xcodebuild test -scheme FeedbackKit -destination 'id=&lt;WATCH_SIMULATOR_UDID&gt;'</InlineCode>.
        </p>
      </DocsSection>
    </div>
  );
}
