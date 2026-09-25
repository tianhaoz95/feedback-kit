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

const WEB_DASHBOARD_PRODUCT = {
  key: "web-dashboard",
  name: "Web Dashboard",
  description: "The FeedbackKit web dashboard (web/ — Vite + React SPA on Cloudflare).",
  isDefault: true,
};

let configured = false;

export function setUpFeedbackKit(): boolean {
  if (configured) return true;
  const envKey = import.meta.env.VITE_FEEDBACKKIT_PROJECT_KEY;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  let projectKey: string | null = null;
  let endpoint: string | undefined;
  if (envKey) {
    projectKey = envKey;
    endpoint =
      import.meta.env.VITE_FEEDBACKKIT_ENDPOINT ??
      (supabaseUrl ? `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/ingest-feedback` : undefined);
  } else if (import.meta.env.PROD) {
    projectKey = DOGFOOD_PROJECT_KEY;
    endpoint = FeedbackKit.DEFAULT_ENDPOINT;
  }
  if (!projectKey) return false;

  FeedbackKit.configure({
    projectKey,
    endpoint,
    products: [WEB_DASHBOARD_PRODUCT],
    defaultProductKey: WEB_DASHBOARD_PRODUCT.key,
    appVersion: __APP_VERSION__,
    appBuild: __APP_COMMIT__ || import.meta.env.MODE,
  });
  FeedbackKit.theme = { primaryColorHex: "#171717", secondaryColorHex: "#525252" };
  FeedbackKit.enableKeyboardShortcut();
  configured = true;
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
