import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { SiteFooter } from "@/components/SiteFooter";
import { Logomark } from "@/components/Logomark";
import { PhoneMockup } from "@/components/landing/PhoneMockup";
import { BrowserMockup } from "@/components/landing/BrowserMockup";
import { DashboardMockup } from "@/components/landing/DashboardMockup";
import { Reveal } from "@/components/landing/Reveal";

const steps = [
  {
    title: "Capture",
    description:
      "A shake, a floating button, a keyboard shortcut, or your own trigger captures the current screen: UIKit, SwiftUI, AppKit, or any web page.",
  },
  {
    title: "Annotate & describe",
    description:
      "The user draws on the screenshot — freehand, rectangle, arrow, or text — and writes what went wrong.",
  },
  {
    title: "Ship it",
    description:
      "You get a structured report with the screenshot, the drawing, and device context. Keep it, send it to your own backend, or hand it to the hosted dashboard.",
  },
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
    title: "No dashboard required",
    description:
      "The SDK hands the report to your code. Where it goes next is up to you: the dashboard is one option, not a requirement.",
  },
  {
    title: "Prompt generation for coding agents",
    description:
      "The optional dashboard turns a report into a ready-to-paste prompt via a plain, editable template — no templating language to learn.",
  },
  {
    title: "Closes the loop with the reporter",
    description:
      "When a fix ships, the person who reported the bug sees their own screenshot and confirms it's fixed, or shows you what's still broken.",
  },
  {
    title: "Built for teams",
    description:
      "Invite teammates with a link, switch between organizations, and keep every project behind Postgres row-level security.",
  },
  {
    title: "Notified the moment it matters",
    description:
      "New reports, reporter replies, and fixes confirmed or reopened show up live in the dashboard and as push notifications in the Portal app.",
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
    ? { to: "/projects", label: "Go to your projects", shortLabel: "Projects" }
    : { to: "/login", label: "Sign in", shortLabel: "Sign in" };

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
                Source available &middot; PolyForm Perimeter
              </span>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight text-neutral-900 sm:text-5xl">
                In-app feedback for your apps and websites, turned into prompts your coding agent can act on.
              </h1>
              <p className="mt-5 text-base text-neutral-600 sm:text-lg">
                Add the SDK to your iOS, macOS or watchOS app, or your website.
                Users mark up the screen and describe the problem. You get a
                structured report and, if you want it, a hosted dashboard that
                turns it into a ready-to-paste prompt.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  to={primaryCta.to}
                  className="rounded-md bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition-all duration-150 hover:-translate-y-0.5 hover:bg-neutral-800 hover:shadow-lg hover:shadow-neutral-900/10 active:translate-y-0 active:scale-95"
                >
                  {primaryCta.label}
                </Link>
                <a
                  href="https://github.com/tianhaoz95/feedback-kit"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-900 transition-all duration-150 hover:-translate-y-0.5 hover:bg-neutral-50 active:translate-y-0 active:scale-95"
                >
                  View on GitHub
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
                Swift Package and npm. No dashboard required — bring your own backend, or use ours.
              </p>
            </div>
            {/* The same capture → annotate step on the web and on iOS, both real
                captures of the SDKs' own UI. The phone sits in front, overlapping
                the browser's right edge. */}
            <div className="animate-fade-up" style={{ animationDelay: "150ms" }}>
              <div className="relative mx-auto max-w-[560px]">
                <div className="absolute left-0 top-1/2 w-[86%] -translate-y-1/2">
                  <div className="animate-float-delayed">
                    <BrowserMockup />
                  </div>
                </div>
                <div className="relative z-10 ml-auto w-[38%]">
                  <div className="animate-float">
                    <PhoneMockup className="" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-t border-neutral-100 bg-neutral-50/60">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
            <Reveal>
              <h2 className="text-center text-sm font-semibold uppercase tracking-wide text-neutral-500">
                How it works
              </h2>
            </Reveal>
            <div className="mt-10 grid gap-8 sm:grid-cols-3">
              {steps.map((step, i) => (
                <Reveal key={step.title} delayMs={i * 120}>
                  <div className="relative">
                    <span className="text-3xl font-semibold text-neutral-200">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h3 className="mt-2 text-base font-semibold text-neutral-900">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-sm text-neutral-600">{step.description}</p>
                  </div>
                </Reveal>
              ))}
            </div>
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
                Native and web SDKs that share one report format and never
                require the dashboard, plus a dashboard, CLI and MCP server
                that are optional ways to use what they produce.
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
                  Optional
                </span>
                <h2 className="mt-4 text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
                  A dashboard that turns reports into prompts
                </h2>
                <p className="mt-3 text-sm text-neutral-600 sm:text-base">
                  Receive feedback, organize it by project, and generate a
                  ready-to-paste prompt for whatever coding agent you use — via
                  a plain, editable template, not a templating language to
                  learn.
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
                Add it to your app in an afternoon
              </h2>
              <p className="mt-3 text-sm text-neutral-300 sm:text-base">
                A Swift Package for Apple platforms and an npm package for the
                web, with Android coming soon. The dashboard is optional, and
                free to self-host from this repo.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link
                  to={primaryCta.to}
                  className="rounded-md bg-white px-5 py-2.5 text-sm font-medium text-neutral-900 transition-all duration-150 hover:-translate-y-0.5 hover:bg-neutral-100 active:translate-y-0 active:scale-95"
                >
                  {primaryCta.label}
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
