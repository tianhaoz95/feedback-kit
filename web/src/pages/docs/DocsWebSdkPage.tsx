import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FeedbackKit, type FeedbackReport } from "feedbackkit-web";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { DocsCallout, DocsList, DocsSection, DocsTable, DocsTitle, InlineCode } from "@/components/docs/DocsProse";
import { Button } from "@/components/Button";

const install = `npm install feedbackkit-web`;

const scriptTag = `<script src="https://cdn.jsdelivr.net/npm/feedbackkit-web/dist/feedbackkit.iife.js"></script>
<script>
  // Exposes window.FeedbackKit — same API as the npm package.
  FeedbackKit.showFloatingTriggerButton();
</script>`;

const basicUsage = `import { FeedbackKit } from "feedbackkit-web";

// From any button, menu item or shortcut handler:
const report = await FeedbackKit.present();
if (report) {
  // The user tapped Send. Delivery is up to you — your own backend,
  // a support inbox, or FeedbackKit.submit(report) for the dashboard.
  console.log(report.text, report.annotations, report.environment);
}`;

const dashboardConfig = `import { FeedbackKit } from "feedbackkit-web";

FeedbackKit.configure({
  projectKey: "pk_...",
  // Optional — defaults to the hosted dashboard. Point it at your own
  // deployment's function when self-hosting:
  endpoint: "https://<your-project>.supabase.co/functions/v1/ingest-feedback",
  appVersion: "2.4.0",   // optional: a browser can't know your app's version
  appBuild: "a1b2c3d",
});

// Opens the dialog and delivers the report on Send, with progress,
// retry-on-error and a thank-you state built in:
await FeedbackKit.presentAndSubmit({
  onSubmitted: (report) => console.log("Submitted", report.id),
  onError: (error) => console.warn(error),
});`;

const triggers = `FeedbackKit.showFloatingTriggerButton();                 // bottom-right "Feedback" pill
FeedbackKit.showFloatingTriggerButton({ position: "bottom-left", compact: true });
FeedbackKit.enableKeyboardShortcut();                     // ⌘⇧F / Ctrl+Shift+F
FeedbackKit.enableKeyboardShortcut({ key: "B" });          // ⌘⇧B / Ctrl+Shift+B

// Or your own button:
<button onClick={() => FeedbackKit.presentAndSubmit()}>Report a problem</button>`;

const currentScreen = `// From your router's navigation hook — e.g. React Router:
const location = useLocation();
useEffect(() => {
  FeedbackKit.currentScreen = routeTitle(location.pathname); // "Checkout"
}, [location.pathname]);`;

const logsConfig = `FeedbackKit.configure({
  projectKey: "pk_...",
  captureLogs: { maxEntries: 100, includeVerbose: true }, // also console.log/info/debug
  // captureLogs: false,                                  // turn it off entirely
});`;

const nextjs = `"use client";
// app/feedback.tsx — render <Feedback /> once from app/layout.tsx.
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { FeedbackKit } from "feedbackkit-web";

export function Feedback() {
  const pathname = usePathname();
  useEffect(() => {
    FeedbackKit.configure({ projectKey: process.env.NEXT_PUBLIC_FEEDBACKKIT_KEY! });
    FeedbackKit.showFloatingTriggerButton();
    return () => FeedbackKit.destroy();
  }, []);
  useEffect(() => {
    FeedbackKit.currentScreen = pathname;
  }, [pathname]);
  return null;
}`;

const theme = `FeedbackKit.theme = {
  primaryColorHex: "#7C3AED",   // Send, selected tool, toggles, trigger button
  secondaryColorHex: "#F97316", // Cancel, Attach
};`;

const captureMode = `FeedbackKit.captureOptions = {
  mode: "display",   // Screen Capture API: pixel-exact, but asks every time
  maxPixelRatio: 1,  // smaller uploads on dense displays (default 2)
};`;

const renderer = `import { drawAnnotations } from "feedbackkit-web";

// Redraw a stored report's markup on top of its raw screenshot:
ctx.scale(canvas.width / env.screenWidthPoints, canvas.height / env.screenHeightPoints);
drawAnnotations(ctx, report.annotations, {
  width: env.screenWidthPoints,
  height: env.screenHeightPoints,
});`;

export function DocsWebSdkPage() {
  return (
    <div>
      <DocsTitle
        eyebrow="SDK"
        title="Web SDK"
        description="The browser counterpart of the Swift SDK: capture what the user is looking at,
          let them mark it up and describe the problem, and get the same structured FeedbackReport —
          plus the page URL and the console errors and failed requests that led up to it. One small
          npm package (or a script tag), no framework required, and nothing sent anywhere unless you
          ask it to."
      />

      <DocsSection title="Requirements">
        <DocsList
          items={[
            <>Any modern browser — Chrome/Edge, Safari and Firefox, desktop and mobile</>,
            <>Works with any framework (or none): the UI is plain DOM inside a Shadow DOM, so your CSS can't break it and its CSS can't leak into your page</>,
            <>One dependency (<InlineCode>modern-screenshot</InlineCode>), loaded on first capture</>,
          ]}
        />
      </DocsSection>

      <DocsSection title="Install">
        <CodeBlock code={install} label="Terminal" />
        <p>Or with no build step at all:</p>
        <CodeBlock code={scriptTag} label="HTML" />
      </DocsSection>

      <DocsSection title="Basic usage">
        <p>
          <InlineCode>FeedbackKit.present()</InlineCode> captures the visible viewport, opens the
          annotate/describe dialog, and resolves with the finished report — or <InlineCode>null</InlineCode> if
          the user cancels. Nothing leaves the page; what happens to the report is up to you.
        </p>
        <CodeBlock code={basicUsage} label="TypeScript" />
      </DocsSection>

      <DocsSection title="Sending to the hosted dashboard">
        <p>
          Configure a project key (from your project&apos;s <strong>SDK setup</strong> tab) and use{" "}
          <InlineCode>presentAndSubmit</InlineCode>. Reports land in the same project, list and
          prompt generation as your iOS/macOS reports, marked with a <strong>Web</strong> badge.
        </p>
        <CodeBlock code={dashboardConfig} label="TypeScript" />
        <p className="text-neutral-600">
          The project key is a routing key, not a secret — it can only create feedback. On the web
          it&apos;s visible in your page source, so lock it to your own sites under{" "}
          <strong>Settings → Allowed web origins</strong>. Submissions are also rate-limited per project.
        </p>
      </DocsSection>

      <DocsSection title="Closing the loop: “is it fixed?”">
        <p>
          <InlineCode>FeedbackKit.enableFixVerification()</InlineCode> asks the person who reported a bug to confirm
          the fix once it ships: a small card shows their original screenshot with <em>Yes, it's fixed</em> /{" "}
          <em>No, still broken</em>. Still broken reopens the capture dialog so they can show what's wrong now, and
          the report goes back to you and your coding agent. Each browser gets an anonymous reporter id, so no
          sign-up is involved. Run <InlineCode>npx feedbackkit-cli release --build &lt;id&gt;</InlineCode> after a
          deploy to mark merged fixes shipped.
        </p>
        <CodeBlock
          code={`FeedbackKit.configure({ projectKey: "pk_...", appBuild: "2026.09.25.1" }); // appBuild optional
FeedbackKit.enableFixVerification();
FeedbackKit.setUser({ email: user.email }); // optional`}
          label="TypeScript"
        />
        <DocsCallout>
          With a dotted-number <InlineCode>appBuild</InlineCode>, only fixes shipped in that build or earlier are
          shown. Any other build id (like a git SHA) counts as live as soon as it's released — right for a site
          that's replaced on every deploy.
        </DocsCallout>
      </DocsSection>

      <DocsSection title="Triggers">
        <CodeBlock code={triggers} label="TypeScript" />
        <p className="text-neutral-600">
          The keyboard shortcut is the web&apos;s stand-in for the native SDK&apos;s shake-to-report. Without{" "}
          <InlineCode>configure</InlineCode>, the built-in triggers fall back to <InlineCode>present()</InlineCode> and
          log the report to the console.
        </p>
      </DocsSection>

      <DocsSection title="Tracking the current page">
        <p>
          Reports carry the full page URL automatically (with sensitive query parameters such as{" "}
          <InlineCode>token</InlineCode>, <InlineCode>code</InlineCode> or <InlineCode>session</InlineCode> redacted). For a readable
          screen name — used in the dashboard list and the coding-agent prompt — set{" "}
          <InlineCode>currentScreen</InlineCode> on navigation; otherwise it falls back to{" "}
          <InlineCode>location.pathname</InlineCode>.
        </p>
        <CodeBlock code={currentScreen} label="React" />
      </DocsSection>

      <DocsSection title="Annotation tools">
        <p>
          The same four tools as native — <strong>freehand</strong>, <strong>rectangle</strong>,{" "}
          <strong>arrow</strong> and <strong>text</strong> — in the same colors, plus <strong>move</strong>: drag a
          shape to reposition it, scroll (or pinch on a trackpad) to resize it, Shift+scroll to
          rotate it, Delete to remove it. On touch screens, two-finger pinch and twist work like on
          iOS. Undo is ⌘Z / Ctrl+Z; ⌘/Ctrl+Enter sends; Escape cancels.
        </p>
        <p>
          Shapes are stored exactly like native ones — normalized 0…1 points, drawn by a line-for-line
          port of the Swift <InlineCode>AnnotationRenderer</InlineCode> — so the dashboard, the Developer
          Portal app and the CLI treat web and native markup identically. The renderer is exported
          if you want to redraw markup yourself:
        </p>
        <CodeBlock code={renderer} label="TypeScript" />
      </DocsSection>

      <DocsSection title="Console & network logs">
        <p>
          The one thing a browser knows that a native report doesn&apos;t: what the page was
          complaining about. Once configured, the SDK keeps a small rolling buffer of{" "}
          <InlineCode>console.warn</InlineCode>/<InlineCode>console.error</InlineCode> output, uncaught exceptions,
          unhandled promise rejections, and fetch/XHR requests that failed or returned HTTP 4xx/5xx.
          They&apos;re attached to the report and flow straight into the coding-agent prompt.
        </p>
        <DocsList
          items={[
            <>Request and response <em>bodies</em> are never recorded — only method, URL and status.</>,
            <>Bearer tokens, JWTs, <InlineCode>password=</InlineCode>/<InlineCode>api_key=</InlineCode>-style values and sensitive URL parameters are redacted, and each message is truncated.</>,
            <>The dialog lists exactly what will be sent, and the user can untick the logs for any report.</>,
          ]}
        />
        <CodeBlock code={logsConfig} label="TypeScript" />
      </DocsSection>

      <DocsSection title="How the screenshot is captured">
        <p>
          By default the SDK re-renders your page&apos;s own DOM into an image — the web equivalent of
          the native SDKs&apos; window-level capture — so there&apos;s no permission prompt. It captures
          exactly the visible viewport at the current scroll position, including sticky headers,
          fixed elements and scrolled containers, and leaves its own button out of the shot.
        </p>
        <DocsCallout tone="warning">
          DOM rendering can&apos;t read pixels the browser won&apos;t share: cross-origin iframes (embedded
          maps, videos, payment fields) and images served without CORS headers come out blank, as
          do WebGL canvases created without <InlineCode>preserveDrawingBuffer</InlineCode>. If your app
          depends on those, opt into the Screen Capture API — pixel-exact, but the browser asks the
          user to share the tab each time, and it isn&apos;t available on mobile. The SDK falls back to
          DOM rendering if the user declines.
        </DocsCallout>
        <CodeBlock code={captureMode} label="TypeScript" />
      </DocsSection>

      <DocsSection title="Theming">
        <CodeBlock code={theme} label="TypeScript" />
        <p className="text-neutral-600">
          The dialog follows the user&apos;s light/dark preference automatically.
        </p>
      </DocsSection>

      <DocsSection title="Next.js and other SSR frameworks">
        <p>
          The SDK touches <InlineCode>window</InlineCode> and <InlineCode>document</InlineCode>, so configure it
          from client-only code — in Next.js, a <InlineCode>&quot;use client&quot;</InlineCode> component&apos;s effect:
        </p>
        <CodeBlock code={nextjs} label="app/feedback.tsx" />
      </DocsSection>

      <DocsSection title="What's in a FeedbackReport">
        <DocsTable
          columns={["Field", "Notes"]}
          rows={[
            [<InlineCode>text</InlineCode>, "The user's description."],
            [<InlineCode>screenshotRaw</InlineCode>, "PNG Blob of the viewport, or null if the user turned the screenshot off."],
            [<InlineCode>screenshotAnnotated</InlineCode>, "The same PNG with markup burned in."],
            [<InlineCode>annotations</InlineCode>, "Each shape's kind, normalized [x, y] points, color, scale and rotation."],
            [
              <InlineCode>environment</InlineCode>,
              <>
                Same fields as native (<InlineCode>osName</InlineCode> is the real OS, <InlineCode>deviceModel</InlineCode> the
                browser, <InlineCode>screenWidthPoints</InlineCode> the viewport, <InlineCode>screenScale</InlineCode> the pixel
                ratio) plus <InlineCode>platform: &quot;web&quot;</InlineCode>, <InlineCode>pageUrl</InlineCode> and{" "}
                <InlineCode>userAgent</InlineCode>.
              </>,
            ],
            [<InlineCode>logs</InlineCode>, "Recent console/network entries — { level, message, timestamp }."],
            [<InlineCode>attachment</InlineCode>, "An optional file (up to 10 MB) picked from the dialog."],
            [<InlineCode>products</InlineCode>, "The affected products the user picked (configured or fetched from the dashboard)."],
          ]}
        />
      </DocsSection>

      <DocsSection title="Try it">
        <p>
          This button runs the real SDK on this page with <InlineCode>present()</InlineCode> — nothing is
          sent anywhere; the report is shown below instead.
        </p>
        <TryIt />
        <p className="text-neutral-600">
          The FeedbackKit dashboard itself uses the web SDK for its own <strong>Feedback</strong> button —
          see <InlineCode>web/src/lib/feedbackkit.ts</InlineCode>. Setting up a project first? See the{" "}
          <Link to="/docs/dashboard" className="underline">
            dashboard guide
          </Link>
          .
        </p>
      </DocsSection>
    </div>
  );
}

function TryIt() {
  const [report, setReport] = useState<FeedbackReport | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function run() {
    setCancelled(false);
    const result = await FeedbackKit.present();
    if (!result) {
      setCancelled(true);
      return;
    }
    setReport(result);
    setPreviewUrl(result.screenshotAnnotated ? URL.createObjectURL(result.screenshotAnnotated) : null);
  }

  const summary = report
    ? JSON.stringify(
        {
          id: report.id,
          text: report.text,
          annotations: report.annotations,
          environment: report.environment,
          logs: report.logs,
          attachment: report.attachment ? { filename: report.attachment.filename, mimeType: report.attachment.mimeType } : null,
          screenshotRaw: report.screenshotRaw ? `Blob(${report.screenshotRaw.size} bytes)` : null,
          screenshotAnnotated: report.screenshotAnnotated ? `Blob(${report.screenshotAnnotated.size} bytes)` : null,
        },
        null,
        2,
      )
    : null;

  return (
    <div className="space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
      <Button onClick={() => void run()}>Open the feedback dialog</Button>
      {cancelled && <p className="text-xs text-neutral-500">Cancelled — present() resolved with null.</p>}
      {previewUrl && (
        <img src={previewUrl} alt="Annotated screenshot from the report" className="max-h-64 rounded-md border border-neutral-200" />
      )}
      {summary && <CodeBlock code={summary} label="FeedbackReport" />}
    </div>
  );
}
