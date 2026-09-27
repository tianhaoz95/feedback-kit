import { supabase } from "@/lib/supabase";

/**
 * First-party product analytics (supabase/migrations/0020_analytics.sql):
 * events go to our own `analytics_events` table — no third-party tracker, no
 * cookies, no IP address. Fire-and-forget: tracking never blocks or breaks
 * the UI. Off in dev builds (unless VITE_ANALYTICS=1) and for browsers that
 * send Do Not Track or Global Privacy Control.
 */
const ENABLED =
  (import.meta.env.PROD || import.meta.env.VITE_ANALYTICS === "1") &&
  typeof navigator !== "undefined" &&
  navigator.doNotTrack !== "1" &&
  (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl !== true;

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** Paths without ids or query strings, so pages aggregate: /projects/:id. */
export function normalizePath(pathname: string): string {
  return pathname.replace(UUID, ":id").slice(0, 300);
}

function sessionId(): string {
  try {
    let id = sessionStorage.getItem("feedbackkit.analyticsSession");
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem("feedbackkit.analyticsSession", id);
    }
    return id;
  } catch {
    return "no-storage";
  }
}

async function record(name: string, properties: Record<string, unknown>, organizationId?: string | null) {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id ?? null;
  // Signed-out visitors can only record page views (the table's anon policy).
  if (!userId && name !== "page_view") return;
  await supabase.from("analytics_events").insert({
    user_id: userId,
    organization_id: userId ? (organizationId ?? null) : null,
    session_id: sessionId(),
    name,
    path: normalizePath(window.location.pathname),
    properties,
  });
}

/** Records a product event, e.g. track("prompt_copied", { merged: false }, project.organization_id). */
export function track(name: string, properties: Record<string, unknown> = {}, organizationId?: string | null): void {
  if (!ENABLED) return;
  void record(name, properties, organizationId).catch(() => {});
}

export function trackPageView(): void {
  let referrer: string | null = null;
  try {
    if (document.referrer && !document.referrer.startsWith(window.location.origin)) referrer = new URL(document.referrer).host;
  } catch {
    // Unparseable referrer — leave it out.
  }
  track("page_view", referrer ? { referrer } : {});
}
