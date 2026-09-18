import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/SiteFooter";

export function LegalPageLayout({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <Link to="/" className="text-sm font-semibold tracking-tight">
            FeedbackKit
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-xs text-neutral-400">Last updated: {lastUpdated}</p>
        <div className="mt-6 rounded-md bg-amber-50 px-4 py-3 text-xs text-amber-800">
          This is a starting template, not legal advice — have it reviewed before you rely
          on it for a real product.
        </div>
        <div className="mt-8 space-y-6 text-sm leading-relaxed text-neutral-700">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-medium text-neutral-900">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}
