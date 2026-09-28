import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { FeedbackKit, setUpFeedbackKit } from "@/lib/feedbackkit";
import { SiteFooter } from "@/components/SiteFooter";
import { Logomark } from "@/components/Logomark";
import {
  ClaudeIcon,
  CodexIcon,
  CursorIcon,
  CopilotIcon,
  AntigravityIcon,
} from "@/components/icons";
import { BrowserMockup } from "@/components/landing/BrowserMockup";
import { DashboardMockup } from "@/components/landing/DashboardMockup";
import { Reveal } from "@/components/landing/Reveal";
import { LifecycleLoop, LifecyclePlayer } from "@/components/docs/Lifecycle";
import { HeroLoop } from "@/components/landing/HeroLoop";

// Capture, framed as the input to the loop rather than the product itself.
const steps = [
  {
    title: "Capture",
    description:
      "A shake, a floating button, a keyboard shortcut, or your own trigger captures the current screen: UIKit, SwiftUI, AppKit, or any web page.",
  },
  {
    title: "Annotate & describe",
    description:
      "The user draws on the screenshot (freehand, rectangle, arrow, or text), writes what went wrong, and can ask to hear back when it's fixed.",
  },
  {
    title: "Hand it to your agent",
    description:
      "Screenshot, markup, device, build and screen arrive as one structured report, ready for a coding agent without anyone rewriting it.",
  },
];

// Agents FeedbackKit hands reports to, with their respective brand marks.
const agents = [
  { name: "Claude Code", icon: ClaudeIcon, colorClass: "text-[#D97757]" },
  { name: "Codex", icon: CodexIcon, colorClass: "text-[#10A37F]" },
  { name: "Cursor", icon: CursorIcon, colorClass: "text-neutral-900" },
  { name: "GitHub Copilot", icon: CopilotIcon, colorClass: "text-neutral-900" },
  { name: "Antigravity", icon: AntigravityIcon, colorClass: "text-[#3186FF]" },
];

const agentRoutes = [
  {
    title: "Copy the prompt",
    description: "Every report renders into a ready-to-paste prompt, with the report's id and the steps that let your agent update it.",
  },
  {
    title: "Connect over MCP",
    description: "Ask your agent to fix report 8c2. It reads the report, claims it, asks the reporter if it must, and links its fix.",
  },
  {
    title: "Let FeedbackKit start it",
    description: "Send to agent starts one on GitHub Actions, Copilot or your own Mac. Run on my machine hands it to your local agent.",
  },
];

// What other tools do and don't do. No competitor named: the point is the
// shape of the loop, and it holds across the category.
const comparisonRows: { label: string; typical: boolean; agent: boolean }[] = [
  { label: "Capture an annotated screenshot with device context", typical: true, agent: true },
  { label: "Hand the report to a coding agent", typical: false, agent: true },
  { label: "Track the fix to the build that ships it", typical: false, agent: false },
  { label: "Ask the person who reported it to confirm the fix", typical: false, agent: false },
];

const features = [
  {
    title: "One report, every platform",
    description:
      "iOS, iPadOS, macOS, watchOS and the web all produce the same report, so your dashboard, CLI and coding agent handle them the same way.",
  },
  {
    title: "No permission prompts",
    description:
      "Native capture renders the app's own window and web capture re-renders the page, so users never see a screen-recording prompt.",
  },
  {
    title: "Four annotation tools",
    description:
      "Freehand, rectangle, arrow, and text, stored as normalized coordinates so they render correctly at any resolution.",
  },
  {
    title: "A structured report, not a screenshot",
    description:
      "Device, OS, app version and build, locale and screen name travel with the image and every shape drawn on it. On the web: the page URL, browser, and recent console errors and failed requests.",
  },
  {
    title: "Prompts you control",
    description:
      "Each project's prompt is a plain, editable template filled from the report, with a per-report override when one bug needs more.",
  },
  {
    title: "Built for teams",
    description:
      "Invite teammates with a link, watch the reports you care about, and get notified live in the dashboard or the Portal app. Every project stays behind Postgres row-level security.",
  },
];

// Where the SDK runs today, and what's next. Android needs its own native
// SDK (capture, annotation UI, report contract) rather than a port, so it's
// listed as coming soon instead of pretending otherwise.
const platforms: { name: string; soon?: boolean }[] = [
  { name: "iOS & iPadOS" },
  { name: "macOS" },
  { name: "watchOS" },
  { name: "Web" },
  { name: "Android", soon: true },
];

// The closed loop, in three sentences, next to the animated diagram.
const loopPoints = [
  {
    title: "Your agent gets the whole bug",
    description:
      "Screenshot, markup, device and screen arrive as one prompt over MCP. No reproduction steps to write, no copy and paste.",
  },
  {
    title: "Every stage tracks itself",
    description:
      "Claimed, PR open, merged and shipped are recorded from what your agent, GitHub and your release already do.",
  },
  {
    title: "Done means the user says so",
    description:
      "When the fix ships, the person who reported it is asked on their own device. Still broken sends it straight back to the agent.",
  },
];

const codeSamples = {
  swift: {
    label: "Swift",
    file: "AppDelegate.swift",
    code: `FeedbackKit.configure(
    .init(endpointURL: myEndpoint, projectKey: "pk_live_...")
)

FeedbackKit.enableShakeToReport {
    UIApplication.shared.topMostViewController
}

FeedbackKit.currentScreen = "Checkout"`,
  },
  web: {
    label: "Web",
    file: "main.ts",
    code: `import { FeedbackKit } from "feedbackkit-web";

FeedbackKit.configure({ projectKey: "pk_live_..." });

FeedbackKit.showFloatingTriggerButton();
FeedbackKit.enableKeyboardShortcut(); // ⌘⇧F / Ctrl+Shift+F

FeedbackKit.currentScreen = "Checkout";`,
  },
} as const;

export function LandingPage() {
  const { user, loading } = useAuth();
  // shortLabel is what the compact header nav shows on narrow screens — the
  // hero's own CTA button (full-width, its own line) always uses `label`.
  const primaryCta = !loading && user
    ? { to: "/projects", label: "Go to your projects", shortLabel: "Projects", heroLabel: "Go to your projects" }
    : { to: "/login", label: "Sign in", shortLabel: "Sign in", heroLabel: "Close your first loop" };

  // Dogfooding: the landing page collects feedback with FeedbackKit's own web
  // SDK, via a floating button (and ⌘⇧F / Ctrl+Shift+F). Reports go to the
  // team's project under the "Website" product. Hidden in dev builds unless
  // VITE_FEEDBACKKIT_PROJECT_KEY is set (see lib/feedbackkit.ts).
  useEffect(() => {
    if (!setUpFeedbackKit("website")) return;
    FeedbackKit.currentScreen = "Landing page";
    FeedbackKit.showFloatingTriggerButton({ label: "Feedback" });
    return () => {
      FeedbackKit.hideFloatingTriggerButton();
      FeedbackKit.currentScreen = null;
    };
  }, []);

  const [scrolled, setScrolled] = useState(false);
  const [sampleKind, setSampleKind] = useState<keyof typeof codeSamples>("swift");
  const sample = codeSamples[sampleKind];
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header
        className={`sticky top-0 z-50 border-b bg-white/80 backdrop-blur transition-shadow duration-300 ${
          scrolled ? "border-neutral-200 shadow-sm" : "border-transparent"
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-4 sm:px-4">
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <Logomark size={26} />
            <span className="hidden text-sm font-semibold tracking-tight text-neutral-900 min-[380px]:inline">
              FeedbackKit
            </span>
          </Link>
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              to="/docs"
              className="link-underline text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-900"
            >
              Docs
            </Link>
            <a
              href="https://github.com/tianhaoz95/feedback-kit"
              target="_blank"
              rel="noreferrer"
              className="link-underline hidden text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-900 sm:inline"
            >
              GitHub
            </a>
            <Link
              to={primaryCta.to}
              className="shrink-0 whitespace-nowrap rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:-translate-y-0.5 hover:bg-neutral-800 active:translate-y-0 active:scale-95"
            >
              <span className="sm:hidden">{primaryCta.shortLabel}</span>
              <span className="hidden sm:inline">{primaryCta.label}</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative isolate overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
            {/* Slow-drifting blurred blobs */}
            <div className="animate-aurora-1 absolute left-1/2 top-[-14rem] h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-blue-400/25 blur-3xl" />
            <div className="animate-aurora-2 absolute right-[-8rem] top-[2rem] h-[26rem] w-[26rem] rounded-full bg-violet-400/20 blur-3xl" />
            <div className="animate-aurora-3 absolute bottom-[-12rem] left-[-6rem] h-[28rem] w-[28rem] rounded-full bg-amber-300/15 blur-3xl" />
            {/* Faint grid, fading toward the edges */}
            <div
              className="absolute inset-0 bg-[linear-gradient(to_right,rgba(23,23,23,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(23,23,23,0.05)_1px,transparent_1px)] bg-[size:44px_44px]"
              style={{
                maskImage: "radial-gradient(ellipse 65% 55% at 50% 0%, black, transparent)",
                WebkitMaskImage: "radial-gradient(ellipse 65% 55% at 50% 0%, black, transparent)",
              }}
            />
            {/* Fade the whole ambiance into the page background at the bottom */}
            <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-white" />
          </div>
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:py-24 lg:grid-cols-2">
            <div className="animate-fade-up">
              <span className="inline-flex items-center rounded-full border border-neutral-200 bg-white/70 px-3 py-1 text-xs font-medium text-neutral-600 backdrop-blur">
                Works with Claude Code, Codex, Copilot &amp; more
              </span>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight text-neutral-900 sm:text-5xl">
                Your users report the bug. Your agent fixes it. They confirm it&apos;s fixed.
              </h1>
              <p className="mt-5 text-base text-neutral-600 sm:text-lg">
                FeedbackKit connects the people using your app or website to the coding agent working on it,
                and tracks every fix to the build that ships it, then back to the person who reported it.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  to={primaryCta.to}
                  className="rounded-md bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition-all duration-150 hover:-translate-y-0.5 hover:bg-neutral-800 hover:shadow-lg hover:shadow-neutral-900/10 active:translate-y-0 active:scale-95"
                >
                  {primaryCta.heroLabel}
                </Link>
                <a
                  href="#the-loop"
                  className="rounded-md border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-900 transition-all duration-150 hover:-translate-y-0.5 hover:bg-neutral-50 active:translate-y-0 active:scale-95"
                >
                  Follow one bug end to end
                </a>
              </div>
              <ul className="mt-6 flex flex-wrap items-center gap-2" aria-label="Supported platforms">
                {platforms.map((platform) => (
                  <li
                    key={platform.name}
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                      platform.soon
                        ? "border border-dashed border-neutral-300 text-neutral-500"
                        : "border border-neutral-200 bg-white/70 text-neutral-700"
                    }`}
                  >
                    {platform.name}
                    {platform.soon ? (
                      <span className="rounded-full bg-amber-100 px-1.5 py-px text-[10px] font-semibold text-amber-800">
                        Coming soon
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-neutral-400">
                Swift Package and npm, source available. The fix loop is free for your first project.
              </p>
            </div>
            {/* The loop in three beats, opening on the real iOS capture. */}
            <div className="animate-fade-up" style={{ animationDelay: "150ms" }}>
              <HeroLoop />
            </div>
          </div>
        </section>

        {/* Works with the agent you already use */}
        <section className="border-t border-neutral-100 bg-neutral-50/60">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
            <Reveal>
              <div className="mx-auto max-w-2xl text-center">
                <h2 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
                  Works with the agent you already use
                </h2>
                <ul className="mt-5 flex flex-wrap justify-center gap-2" aria-label="Supported coding agents">
                  {agents.map((agent) => (
                    <li
                      key={agent.name}
                      className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3.5 py-1.5 text-sm font-medium text-neutral-700 shadow-2xs"
                    >
                      <agent.icon className={`h-4 w-4 shrink-0 ${agent.colorClass}`} />
                      <span>{agent.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
            <div className="mt-10 grid gap-6 sm:grid-cols-3">
              {agentRoutes.map((route, i) => (
                <Reveal key={route.title} delayMs={i * 120}>
                  <div>
                    <span className="text-3xl font-semibold text-neutral-200">{String(i + 1).padStart(2, "0")}</span>
                    <h3 className="mt-2 text-base font-semibold text-neutral-900">{route.title}</h3>
                    <p className="mt-2 text-sm text-neutral-600">{route.description}</p>
                  </div>
                </Reveal>
              ))}
            </div>
            <Reveal className="mt-8 text-center">
              <Link to="/docs/agents" className="link-underline text-sm font-medium text-neutral-900">
                Compare the ways to hand a report to an agent →
              </Link>
            </Reveal>
          </div>
        </section>

        {/* The closed loop: report → agent → release → the reporter confirms */}
        <section id="the-loop" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:py-24">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <Reveal className="min-w-0">
              <div>
                <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                  The closed loop
                </span>
                <h2 className="mt-4 text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
                  AI can write the fix. FeedbackKit makes sure it actually fixed the problem.
                </h2>
                <p className="mt-3 text-sm text-neutral-600 sm:text-base">
                  Coding agents are fast, but a merged PR isn't a fixed product. FeedbackKit connects the user who
                  hit the bug, the agent that fixes it, and the release that ships it, and it finishes the loop
                  back on the same user's device.
                </p>
                <ul className="mt-6 space-y-4">
                  {loopPoints.map((point) => (
                    <li key={point.title} className="flex gap-3">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                      <div>
                        <p className="text-sm font-semibold text-neutral-900">{point.title}</p>
                        <p className="mt-0.5 text-sm text-neutral-600">{point.description}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
            <Reveal delayMs={150} className="min-w-0">
              <LifecycleLoop />
            </Reveal>
          </div>

          <Reveal className="mt-14 min-w-0">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">Follow one bug, start to finish</h3>
                <p className="text-sm text-neutral-500">It plays by itself. Click any step to jump to it.</p>
              </div>
              <Link to="/docs/how-it-works" className="link-underline text-sm font-medium text-neutral-900">
                Read the full walkthrough →
              </Link>
            </div>
            <LifecyclePlayer />
          </Reveal>
        </section>

        {/* Other tools stop at the ticket */}
        <section className="border-t border-neutral-100 bg-neutral-50/60">
          <div className="mx-auto max-w-4xl px-4 py-16 sm:py-20">
            <Reveal>
              <div className="text-center">
                <h2 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
                  Other tools stop at the ticket
                </h2>
                <p className="mt-3 text-sm text-neutral-600 sm:text-base">
                  Capturing the bug is where most feedback tools end, and handing it to an agent is where the newest
                  ones do. A merged pull request still isn&apos;t a fixed product.
                </p>
              </div>
            </Reveal>
            <Reveal delayMs={120} className="mt-10">
              <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-100 text-xs text-neutral-500">
                      <th className="px-4 py-3 font-medium" />
                      <th className="px-3 py-3 text-center font-medium">Bug-report tools</th>
                      <th className="px-3 py-3 text-center font-medium">…with an agent integration</th>
                      <th className="px-3 py-3 text-center font-semibold text-neutral-900">FeedbackKit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {comparisonRows.map((row) => (
                      <tr key={row.label}>
                        <td className="px-4 py-3 text-neutral-800">{row.label}</td>
                        <td className="px-3 py-3 text-center">{row.typical ? <Yes /> : <No />}</td>
                        <td className="px-3 py-3 text-center">{row.agent ? <Yes /> : <No />}</td>
                        <td className="bg-emerald-50/50 px-3 py-3 text-center">
                          <Yes />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Capture: the report your agent needs */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <Reveal className="min-w-0">
              <div>
                <span className="inline-flex items-center rounded-full border border-neutral-200 px-3 py-1 text-xs font-medium text-neutral-600">
                  Capture
                </span>
                <h2 className="mt-4 text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
                  The report your agent needs, in one tap
                </h2>
                <ol className="mt-6 space-y-5">
                  {steps.map((step, i) => (
                    <li key={step.title} className="flex gap-4">
                      <span className="text-2xl font-semibold text-neutral-200">{String(i + 1).padStart(2, "0")}</span>
                      <div>
                        <h3 className="text-base font-semibold text-neutral-900">{step.title}</h3>
                        <p className="mt-1 text-sm text-neutral-600">{step.description}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </Reveal>
            <Reveal delayMs={150} className="min-w-0">
              <div className="animate-float-delayed">
                <BrowserMockup />
              </div>
            </Reveal>
          </div>
        </section>

        {/* Feature grid */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
                Everything the report needs, nothing it doesn't
              </h2>
              <p className="mt-3 text-sm text-neutral-600 sm:text-base">
                Native and web SDKs that share one report format, and a
                dashboard, CLI and MCP server that carry it to your coding
                agent.
              </p>
            </div>
          </Reveal>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, i) => (
              <Reveal key={feature.title} delayMs={(i % 3) * 100}>
                <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-neutral-300 hover:shadow-md">
                  <h3 className="text-sm font-semibold text-neutral-900">{feature.title}</h3>
                  <p className="mt-2 text-sm text-neutral-600">{feature.description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Integration code sample */}
        <section className="border-t border-neutral-100 bg-neutral-50/60">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:py-20 lg:grid-cols-2">
            <Reveal className="min-w-0">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
                  A few lines to wire up
                </h2>
                <p className="mt-3 text-sm text-neutral-600 sm:text-base">
                  Configure once, then pick a trigger: shake to report, a
                  floating button, a keyboard shortcut on the web, or your own
                  button calling{" "}
                  <code className="break-words rounded bg-neutral-100 px-1.5 py-0.5 text-[13px]">present</code>.
                </p>
                <ul className="mt-6 space-y-3 text-sm text-neutral-600">
                  <li className="flex gap-2">
                    <span className="text-neutral-400">&middot;</span>
                    <span>
                      Swift Package with no dependencies, or the{" "}
                      <code className="break-words rounded bg-neutral-100 px-1.5 py-0.5 text-[13px]">feedbackkit-web</code>{" "}
                      npm package (or a script tag).
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-neutral-400">&middot;</span>
                    Keep the report in your own code and backend, or submit it
                    straight to the hosted dashboard.
                  </li>
                  <li className="flex gap-2">
                    <span className="text-neutral-400">&middot;</span>
                    <span>
                      Set <code className="break-words rounded bg-neutral-100 px-1.5 py-0.5 text-[13px]">currentScreen</code> as
                      users navigate so reports say where they came from.
                    </span>
                  </li>
                </ul>
              </div>
            </Reveal>
            <Reveal delayMs={150} className="min-w-0">
              <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 shadow-xl transition-transform duration-300 hover:-translate-y-1">
                <div className="flex items-center gap-1.5 border-b border-neutral-800 px-4 py-2.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-neutral-700" />
                  <span className="h-2.5 w-2.5 rounded-full bg-neutral-700" />
                  <span className="h-2.5 w-2.5 rounded-full bg-neutral-700" />
                  <span className="ml-3 text-[11px] text-neutral-500">{sample.file}</span>
                  <div className="ml-auto flex rounded-md bg-neutral-800 p-0.5" role="tablist" aria-label="Code sample language">
                    {(Object.keys(codeSamples) as (keyof typeof codeSamples)[]).map((kind) => (
                      <button
                        key={kind}
                        type="button"
                        role="tab"
                        aria-selected={sampleKind === kind}
                        onClick={() => setSampleKind(kind)}
                        className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                          sampleKind === kind ? "bg-neutral-700 text-white" : "text-neutral-400 hover:text-neutral-200"
                        }`}
                      >
                        {codeSamples[kind].label}
                      </button>
                    ))}
                  </div>
                </div>
                <pre className="overflow-x-auto p-5 text-[13px] leading-relaxed text-neutral-200">
                  <code>{sample.code}</code>
                </pre>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Dashboard */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <Reveal className="min-w-0">
              <div className="animate-float-delayed">
                <DashboardMockup />
              </div>
            </Reveal>
            <Reveal delayMs={150} className="min-w-0">
              <div>
                <span className="inline-flex items-center rounded-full border border-neutral-200 px-3 py-1 text-xs font-medium text-neutral-600">
                  Dashboard
                </span>
                <h2 className="mt-4 text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
                  Where the loop runs
                </h2>
                <p className="mt-3 text-sm text-neutral-600 sm:text-base">
                  Every report, its prompt and its fix in one place: see where each fix is, hand reports to an agent,
                  and promote a build only once the people who reported its bugs have confirmed the fixes.
                </p>
                <ul className="mt-6 space-y-3 text-sm text-neutral-600">
                  <li className="flex gap-2">
                    <span className="text-neutral-400">&middot;</span>
                    Per-project default template, plus a per-report override
                    when one bug needs a tweaked prompt.
                  </li>
                  <li className="flex gap-2">
                    <span className="text-neutral-400">&middot;</span>
                    Invite your team with a link, and get notified about new
                    reports in the browser or the Developer Portal app.
                  </li>
                  <li className="flex gap-2">
                    <span className="text-neutral-400">&middot;</span>
                    Row-level security in Postgres keeps every organization's
                    data private.
                  </li>
                  <li className="flex gap-2">
                    <span className="text-neutral-400">&middot;</span>
                    Sign in with GitHub — no separate password to manage.
                  </li>
                </ul>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t border-neutral-100 bg-neutral-900">
          <Reveal>
            <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:py-20">
              <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                Close your first loop this afternoon
              </h2>
              <p className="mt-3 text-sm text-neutral-300 sm:text-base">
                Add the Swift Package or the npm package, connect your coding agent, and the next bug your users
                report can come back to them fixed. Free for your first project.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link
                  to={primaryCta.to}
                  className="rounded-md bg-white px-5 py-2.5 text-sm font-medium text-neutral-900 transition-all duration-150 hover:-translate-y-0.5 hover:bg-neutral-100 active:translate-y-0 active:scale-95"
                >
                  {primaryCta.heroLabel}
                </Link>
                <a
                  href="https://github.com/tianhaoz95/feedback-kit"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border border-neutral-700 px-5 py-2.5 text-sm font-medium text-white transition-all duration-150 hover:-translate-y-0.5 hover:bg-neutral-800 active:translate-y-0 active:scale-95"
                >
                  View on GitHub
                </a>
              </div>
            </div>
          </Reveal>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function Yes() {
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white" aria-label="Yes">
      <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
        <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function No() {
  return <span className="inline-block h-0.5 w-3 rounded bg-neutral-300 align-middle" aria-label="No" />;
}
