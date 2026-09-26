import { Link } from "react-router-dom";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { DocsCallout, DocsSection, DocsTitle, InlineCode } from "@/components/docs/DocsProse";
import { LifecycleLoop } from "@/components/docs/Lifecycle";

const pieces = [
  {
    to: "/docs/ios-sdk",
    title: "iOS SDK",
    description: "Drop into any UIKit or SwiftUI app to capture, annotate, and hand off feedback.",
  },
  {
    to: "/docs/web-sdk",
    title: "Web SDK",
    description: "The same capture → annotate → report flow for any website, plus console errors and failed requests.",
  },
  {
    to: "/docs/dashboard",
    title: "Web dashboard",
    description: "Receive reports, organize them by project, and generate coding-agent prompts.",
  },
  {
    to: "/docs/cli",
    title: "CLI",
    description: "Read feedback and prompts from a terminal, authenticated as your dashboard account.",
  },
  {
    to: "/docs/mcp",
    title: "MCP & coding agents",
    description: "Let Claude Code, Codex, Antigravity, or another agent fetch a prompt directly — no copy/paste.",
  },
  {
    to: "/docs/skills",
    title: "Agent Skills",
    description: "Automate SDK setup, triggers, and MCP integration with Claude Code, Cursor, Antigravity, and Codex.",
  },
];

const quickStart = `FeedbackKit.enableShakeToReport {
    UIApplication.shared.topMostViewController
}`;

export function DocsOverviewPage() {
  return (
    <div>
      <DocsTitle
        eyebrow="Documentation"
        title="FeedbackKit documentation"
        description="FeedbackKit is an iOS, macOS, watchOS, and web SDK for capturing in-app feedback, plus tools to consume it: a hosted dashboard for your team, a CLI, an MCP server, and Agent Skills for coding agents. An Android SDK is coming soon. Pick the pages you need — each piece works without the others."
      />

      <DocsSection title="See the whole loop first">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] sm:items-center">
          <div className="min-w-0 space-y-3">
            <p>
              A user reports a bug from inside your app. A coding agent fixes it. When the fix ships, the same
              user's device asks them whether it's fixed. Most people understand FeedbackKit after following
              one report through that loop.
            </p>
            <Link
              to="/docs/how-it-works"
              className="inline-flex items-center gap-1 rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-neutral-700"
            >
              Follow one bug, start to finish →
            </Link>
          </div>
          <LifecycleLoop />
        </div>
      </DocsSection>

      <DocsSection title="The building blocks">
        <div className="grid gap-4 sm:grid-cols-2">
          {pieces.map((piece) => (
            <Link
              key={piece.to}
              to={piece.to}
              className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md"
            >
              <h3 className="text-sm font-semibold text-neutral-900">{piece.title}</h3>
              <p className="mt-1 text-sm text-neutral-600">{piece.description}</p>
            </Link>
          ))}
        </div>
      </DocsSection>

      <DocsSection title="The shortest path to a working report">
        <p>
          Add the Swift Package (see <Link to="/docs/ios-sdk" className="link-underline font-medium text-neutral-900">iOS SDK</Link>),
          then wire up a trigger. Shake-to-report is the fastest way to try it:
        </p>
        <CodeBlock code={quickStart} label="AppDelegate.swift" />
        <p>
          That's it — no dashboard, no account, no network call. Shaking the device opens the
          capture/annotate/describe flow, and you get a structured <InlineCode>FeedbackReport</InlineCode> back
          in a completion handler. Everything else on this site (the dashboard, the CLI, MCP) is
          optional infrastructure for what happens to that report next.
        </p>
      </DocsSection>

      <DocsSection title="How the pieces fit together">
        <p>
          Everything shares one contract. The SDK produces a <InlineCode>FeedbackReport</InlineCode> (screenshot,
          annotations, description, device info). If you configure the SDK with a dashboard project's
          endpoint, that report is POSTed to Supabase and stored per-project with row-level security —
          one organization's members can never see another's data. The dashboard turns a stored report
          into a coding-agent prompt via a plain, editable template. The CLI and MCP server are just
          another client of that same database, authenticated as a real dashboard user, so a coding
          agent can fetch that prompt directly instead of a human copying it out of a browser tab.
        </p>
        <DocsCallout>
          The SDK never requires the dashboard, and the dashboard never requires the CLI/MCP layer.
          Each piece is additive — use only what you need.
        </DocsCallout>
      </DocsSection>

      <DocsSection title="What gets collected">
        <p>
          A report includes a raw and an annotated screenshot — optional on iOS/macOS, where a
          toggle in the composer lets the user leave it out entirely — the shapes drawn on it (freehand,
          rectangle, arrow, text), the free-text description, and device/app context (OS, device
          model, app version, locale, and — if you set it — the current screen name). Nothing beyond
          what's visible on screen at capture time and those fields. See{" "}
          <Link to="/privacy" className="link-underline font-medium text-neutral-900">
            the privacy notice
          </Link>{" "}
          for the hosted-dashboard specifics.
        </p>
      </DocsSection>

      <DocsSection title="Getting help">
        <p>
          FeedbackKit is open source. Browse the code, file an issue, or send a pull request on{" "}
          <a
            href="https://github.com/tianhaoz95/feedback-kit"
            target="_blank"
            rel="noreferrer"
            className="link-underline font-medium text-neutral-900"
          >
            GitHub
          </a>
          .
        </p>
      </DocsSection>
    </div>
  );
}
