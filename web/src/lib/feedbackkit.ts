import { FeedbackKit } from "feedbackkit-web";

/**
 * The dashboard dogfoods FeedbackKit's own web SDK (../web-sdk, imported
 * from source via the `feedbackkit-web` alias in vite.config.ts) — the same
 * way the Developer Portal iOS app uses the Swift SDK. Reports land in the
 * FeedbackKit team's own hosted project, next to the Portal app's.
 *
 * Which project receives them:
 *   - `VITE_FEEDBACKKIT_PROJECT_KEY` (+ optional `VITE_FEEDBACKKIT_ENDPOINT`,
 *     defaulting to this deployment's own `ingest-feedback` function) —
 *     e.g. a project in your local `supabase start` stack.
 *   - Otherwise, production builds use the FeedbackKit team's hosted
 *     dogfood project; dev builds leave the SDK unconfigured, so the trigger
 *     is hidden and nothing is sent anywhere by accident.
 */
const DOGFOOD_PROJECT_KEY = "pk_cde764e9b97ba261cdd084e7e3e4cf04ce31";

/**
 * Product preselected in the composer for each surface. The chips themselves
 * come from the project's product catalog (Settings › Products), fetched by
 * the SDK, so a report can be tagged with any product — e.g. web + backend +
 * Portal. A key missing from the catalog falls back to its default product.
 */
const DEFAULT_PRODUCT_KEY = { dashboard: "web-dashboard", website: "website" } as const;

/** Which part of the SPA is asking — decides the product preselected in the composer. */
export type FeedbackSurface = "dashboard" | "website";

let configuredFor: FeedbackSurface | null = null;

export function setUpFeedbackKit(surface: FeedbackSurface = "dashboard"): boolean {
  if (configuredFor === surface) return true;
  const envKey = import.meta.env.VITE_FEEDBACKKIT_PROJECT_KEY;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  let projectKey: string | null = null;
  let endpoint: string | undefined;
  if (envKey) {
    projectKey = envKey;
    endpoint =
      import.meta.env.VITE_FEEDBACKKIT_ENDPOINT ??
      (supabaseUrl ? `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/ingest-feedback` : undefined);
  } else {
    // Production and development default to the FeedbackKit team's hosted dogfood
    // project so the web SDK is always available to test in the web portal app.
    projectKey = DOGFOOD_PROJECT_KEY;
    endpoint = FeedbackKit.DEFAULT_ENDPOINT;
  }
  if (!projectKey) return false;

  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const includeScreenshot = !(
    import.meta.env.VITE_FEEDBACKKIT_CAPTURE_SCREENSHOT === "false" ||
    import.meta.env.VITE_FEEDBACKKIT_INCLUDE_SCREENSHOT === "false" ||
    searchParams?.get("screenshot") === "off" ||
    searchParams?.get("screenshot") === "false" ||
    searchParams?.has("no_screenshot")
  );

  // Re-running configure when the surface changes is safe: it only swaps the
  // configuration (log capture is started once).
  FeedbackKit.configure({
    projectKey,
    endpoint,
    defaultProductKey: DEFAULT_PRODUCT_KEY[surface],
    appVersion: __APP_VERSION__,
    appBuild: __APP_COMMIT__ || import.meta.env.MODE,
    captureScreenshot: includeScreenshot,
    includeScreenshot,
  });
  if (configuredFor !== null) {
    configuredFor = surface;
    return true;
  }
  FeedbackKit.theme = { primaryColorHex: "#171717", secondaryColorHex: "#525252" };
  FeedbackKit.enableKeyboardShortcut();
  // "We fixed what you reported — is it fixed?" once a fix ships. appBuild is
  // a git SHA here, which doesn't order, so a released fix counts as live on
  // the next page load — right for a static SPA that's replaced on deploy.
  FeedbackKit.enableFixVerification();
  configuredFor = surface;
  return true;
}

/** Human-readable screen names for reports, from the current route. */
export function screenNameForPath(pathname: string): string {
  if (/^\/projects\/[^/]+\/feedback\/[^/]+/.test(pathname)) return "Project › Feedback detail";
  if (/^\/projects\/[^/]+/.test(pathname)) {
    const tab = new URLSearchParams(window.location.search).get("tab");
    return tab ? `Project › ${tab[0].toUpperCase()}${tab.slice(1)}` : "Project › Feedback";
  }
  const names: Record<string, string> = {
    "/projects": "Projects",
    "/cli-sessions": "CLI sessions",
    "/billing": "Billing",
  };
  return names[pathname] ?? pathname;
}

export { FeedbackKit };
