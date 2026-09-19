import { Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { SiteFooter } from "@/components/SiteFooter";
import { Logomark } from "@/components/Logomark";
import { PhoneMockup } from "@/components/landing/PhoneMockup";
import { DashboardMockup } from "@/components/landing/DashboardMockup";

const steps = [
  {
    title: "Capture",
    description:
      "A shake, or a floating button, or your own trigger — one call captures the current screen, whether it's UIKit, SwiftUI, or both.",
  },
  {
    title: "Annotate & describe",
    description:
      "The user draws on the screenshot — freehand, rectangle, arrow, or text — and writes what went wrong.",
  },
  {
    title: "Ship it",
    description:
      "You get a structured FeedbackReport in a completion handler. Print it, send it to your own backend, or hand it to the hosted dashboard.",
  },
];

const features = [
  {
    title: "Works with UIKit and SwiftUI",
    description:
      "Capture is window-level, not view-controller-level, so it works identically no matter what built the screen on top.",
  },
  {
    title: "Four annotation tools",
    description:
      "Freehand, rectangle, arrow, and text, stored as normalized coordinates so they render correctly at any resolution.",
  },
  {
    title: "A structured report, not a screenshot",
    description:
      "Device model, OS version, app version/build, locale, and screen name travel alongside the image and every shape drawn on it.",
  },
  {
    title: "No dashboard required",
    description:
      "present(from:) hands you a FeedbackReport in a completion handler. Delivery is entirely up to your app.",
  },
  {
    title: "Prompt generation for coding agents",
    description:
      "The optional dashboard turns a report into a ready-to-paste prompt via a plain, editable template — no templating language to learn.",
  },
  {
    title: "Multi-project, multi-tenant",
    description:
      "Organizations, projects, and per-project prompt templates, with Postgres row-level security enforcing tenancy, not application code.",
  },
];

const codeSample = `FeedbackKit.configure(
    .init(endpointURL: myEndpoint, projectKey: "pk_live_...")
)

FeedbackKit.enableShakeToReport {
    UIApplication.shared.topMostViewController
}

FeedbackKit.currentScreen = "Checkout"`;

export function LandingPage() {
  const { user, loading } = useAuth();
  const primaryCta = !loading && user
    ? { to: "/projects", label: "Go to your projects" }
    : { to: "/login", label: "Sign in" };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="border-b border-neutral-100">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-2">
            <Logomark size={26} />
            <span className="text-sm font-semibold tracking-tight">FeedbackKit</span>
          </Link>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/tianhaoz95/feedback-kit"
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
            >
              GitHub
            </a>
            <Link
              to={primaryCta.to}
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
            >
              {primaryCta.label}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(23,23,23,0.06),_transparent_60%)]"
          />
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:py-24 lg:grid-cols-2">
            <div>
              <span className="inline-flex items-center rounded-full border border-neutral-200 px-3 py-1 text-xs font-medium text-neutral-600">
                Open source &middot; MIT licensed
              </span>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight text-neutral-900 sm:text-5xl">
                In-app feedback for iOS, turned into prompts your coding agent can act on.
              </h1>
              <p className="mt-5 text-base text-neutral-600 sm:text-lg">
                Drop the SDK into any UIKit or SwiftUI app. Users shake, mark up
                the screen, and describe the problem. You get a structured
                report — and, optionally, a hosted dashboard that turns it
                into a ready-to-paste prompt.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  to={primaryCta.to}
                  className="rounded-md bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
                >
                  {primaryCta.label}
                </Link>
                <a
                  href="https://github.com/tianhaoz95/feedback-kit"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
                >
                  View on GitHub
                </a>
              </div>
              <p className="mt-4 text-xs text-neutral-400">
                Swift Package. No dashboard required — bring your own backend, or use ours.
              </p>
            </div>
            <PhoneMockup />
          </div>
        </section>

        {/* How it works */}
        <section className="border-t border-neutral-100 bg-neutral-50/60">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
            <h2 className="text-center text-sm font-semibold uppercase tracking-wide text-neutral-500">
              How it works
            </h2>
            <div className="mt-10 grid gap-8 sm:grid-cols-3">
              {steps.map((step, i) => (
                <div key={step.title} className="relative">
                  <span className="text-3xl font-semibold text-neutral-200">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-2 text-base font-semibold text-neutral-900">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm text-neutral-600">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Feature grid */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
              Everything the report needs, nothing it doesn't
            </h2>
            <p className="mt-3 text-sm text-neutral-600 sm:text-base">
              Built as two things sharing one JSON contract: an SDK that
              never requires the dashboard, and a dashboard that's just one
              way to consume what the SDK produces.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm"
              >
                <h3 className="text-sm font-semibold text-neutral-900">{feature.title}</h3>
                <p className="mt-2 text-sm text-neutral-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Integration code sample */}
        <section className="border-t border-neutral-100 bg-neutral-50/60">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:py-20 lg:grid-cols-2">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
                A few lines to wire up
              </h2>
              <p className="mt-3 text-sm text-neutral-600 sm:text-base">
                One call — <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-[13px]">FeedbackKit.present(from:)</code> —
                is everything else is built on. Shake-to-report and a
                floating trigger button are convenience wrappers on top of it;
                call it directly if you already have your own trigger.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-neutral-600">
                <li className="flex gap-2">
                  <span className="text-neutral-400">&middot;</span>
                  Swift Package, no external dependencies.
                </li>
                <li className="flex gap-2">
                  <span className="text-neutral-400">&middot;</span>
                  Works with your own backend via the completion handler, or
                  submit straight to the hosted dashboard.
                </li>
                <li className="flex gap-2">
                  <span className="text-neutral-400">&middot;</span>
                  Set <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-[13px]">currentScreen</code> as
                  users navigate so reports say where they came from.
                </li>
              </ul>
            </div>
            <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 shadow-xl">
              <div className="flex items-center gap-1.5 border-b border-neutral-800 px-4 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-neutral-700" />
                <span className="h-2.5 w-2.5 rounded-full bg-neutral-700" />
                <span className="h-2.5 w-2.5 rounded-full bg-neutral-700" />
                <span className="ml-3 text-[11px] text-neutral-500">AppDelegate.swift</span>
              </div>
              <pre className="overflow-x-auto p-5 text-[13px] leading-relaxed text-neutral-200">
                <code>{codeSample}</code>
              </pre>
            </div>
          </div>
        </section>

        {/* Dashboard */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <DashboardMockup />
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
                  Organizations and team membership, with row-level security
                  enforcing that no account can see another's data.
                </li>
                <li className="flex gap-2">
                  <span className="text-neutral-400">&middot;</span>
                  Sign in with GitHub — no separate password to manage.
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t border-neutral-100 bg-neutral-900">
          <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:py-20">
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Add it to your app in an afternoon
            </h2>
            <p className="mt-3 text-sm text-neutral-300 sm:text-base">
              FeedbackKit is a Swift Package. The dashboard is optional, and
              free to self-host from this repo.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                to={primaryCta.to}
                className="rounded-md bg-white px-5 py-2.5 text-sm font-medium text-neutral-900 hover:bg-neutral-100"
              >
                {primaryCta.label}
              </Link>
              <a
                href="https://github.com/tianhaoz95/feedback-kit"
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-neutral-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
              >
                View on GitHub
              </a>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
