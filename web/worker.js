// SPA fallback for the dashboard's Cloudflare deployment.
//
// Static assets are matched first, so this only runs for a path with no file
// behind it. Production already answers those with index.html via
// `not_found_handling: "single-page-application"`, but Cloudflare's PR
// Previews (`wrangler preview`) ignore that setting and return a bare
// "Not found" — which broke every deep link on a preview, including /login,
// where GitHub sign-in lands. Serving the app shell here doesn't depend on
// that setting. Requests for missing files (a stale /assets/*.js) still 404.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const isPageNavigation =
      (request.method === "GET" || request.method === "HEAD") &&
      !/\.[a-z0-9]+$/i.test(url.pathname) &&
      (request.headers.get("Sec-Fetch-Mode") === "navigate" ||
        (request.headers.get("Accept") ?? "").includes("text/html"));
    if (!isPageNavigation) return env.ASSETS.fetch(request);
    return env.ASSETS.fetch(
      new Request(new URL("/", url), { method: request.method, headers: request.headers }),
    );
  },
};
