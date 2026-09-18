import { Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { SiteFooter } from "@/components/SiteFooter";

export function LandingPage() {
  const { user, loading } = useAuth();
  const primaryCta = !loading && user
    ? { to: "/projects", label: "Go to your projects" }
    : { to: "/login", label: "Sign in" };

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">FeedbackKit</h1>
          <p className="mt-4 text-base text-neutral-600 sm:text-lg">
            An iOS SDK for capturing in-app user feedback — screenshot, annotations, a
            description, and device/app/screen info — plus an optional dashboard for
            collecting it and turning it into prompts for a coding agent.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
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
        </div>

        <div className="mx-auto grid max-w-4xl gap-6 px-4 pb-20 sm:grid-cols-2">
          <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-medium">iOS SDK</h2>
            <p className="mt-2 text-sm text-neutral-600">
              Drop into any UIKit or SwiftUI app. Shake-to-report or a trigger button
              captures the screen, lets the user mark it up and describe the problem, and
              hands your app a structured report — no dashboard required.
            </p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-medium">Optional hosted dashboard</h2>
            <p className="mt-2 text-sm text-neutral-600">
              One way to consume that report: receive it, organize it by project, and turn
              it into a ready-to-paste prompt for whatever coding agent you use.
            </p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
