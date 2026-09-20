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

export function DocsIosSdkPage() {
  return (
    <div>
      <DocsTitle
        eyebrow="iOS SDK"
        title="iOS SDK"
        description="A Swift Package that captures a screenshot, lets the user annotate it and describe a
          problem, and hands your app a structured report. Works with UIKit, SwiftUI, or a mix of
          both — the SDK never needs to know which one built the screen on top."
      />

      <DocsSection title="Requirements">
        <DocsList
          items={[
            <>iOS 15.0+</>,
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
      </DocsSection>

      <DocsSection title="Basic usage" id="basic-usage">
        <p>
          One call is everything else in the SDK is built on:{" "}
          <InlineCode>FeedbackKit.present(from:completion:)</InlineCode>. It captures the current
          screen, presents the annotate/describe flow modally, and calls your completion handler with
          the finished report (or <InlineCode>nil</InlineCode> if the user cancelled). Delivery is
          entirely up to you — print it, POST it to your own backend, or use the dashboard path below.
        </p>
        <CodeBlock code={basicUsage} label="Swift" />
      </DocsSection>

      <DocsSection title="Triggers">
        <p>
          <InlineCode>enableShakeToReport</InlineCode> and <InlineCode>showFloatingTriggerButton</InlineCode> are
          convenience wrappers around <InlineCode>present(from:)</InlineCode> — call it directly instead if you
          already have your own trigger (a debug menu item, a settings row, a custom gesture).
        </p>
        <CodeBlock code={shakeAndButton} label="Swift" />
        <p className="text-neutral-600">
          Shake detection swizzles <InlineCode>UIWindow.motionEnded</InlineCode> — the standard technique for
          this — so it works without subclassing your app's window.
        </p>
      </DocsSection>

      <DocsSection title="Tracking the current screen">
        <p>
          FeedbackKit has no fully reliable way to know "what screen is this," so it uses a layered
          approach: a developer-set string (recommended) with best-effort auto-detection of the
          top UIKit view controller as a fallback. The fallback can't see SwiftUI-only screens, so
          setting this explicitly is worth doing:
        </p>
        <CodeBlock code={currentScreen} label="Swift" />
      </DocsSection>

      <DocsSection title="Annotation tools">
        <p>
          The composer supports four tools — <strong>freehand</strong>, <strong>rectangle</strong>,{" "}
          <strong>arrow</strong>, and <strong>text</strong> — plus a drag tool for repositioning a shape
          (two-finger pinch to scale, two-finger twist to rotate). Every shape is stored as normalized
          (0···1) points, so annotations render correctly at any screenshot resolution. On submit, the
          shapes are burned into a copy of the screenshot at its native pixel size — both the raw and
          the annotated PNG travel in the report, plus the structured shapes themselves.
        </p>
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
          ), then use <InlineCode>presentAndSubmit</InlineCode> instead of <InlineCode>present</InlineCode>:
        </p>
        <CodeBlock code={dashboardConfig} label="Swift" />
        <DocsCallout>
          The project key is a routing key, not a secret — it can only ever <em>create</em> feedback for
          that project, never read anything, so it's safe to ship in an app binary.
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

      <DocsSection title="Try it in the demo app">
        <p>
          The repo includes a small sample app (one SwiftUI screen, one UIKit screen) with
          shake-to-report, the floating button, and manual "Report a Problem" buttons already wired
          up:
        </p>
        <CodeBlock code="./scripts/run-ios.sh" label="Terminal" />
      </DocsSection>
    </div>
  );
}
