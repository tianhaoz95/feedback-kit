# feedbackkit-web

In-app feedback for websites: capture what the user is looking at, let them
mark it up and describe the problem, and get a structured report — plus the
page URL and the console errors and failed requests that led up to it.

The browser counterpart of [FeedbackKit](https://github.com/tianhaoz95/feedback-kit)'s
iOS/macOS/watchOS SDK: same flow, same report shape, same optional delivery
to the FeedbackKit dashboard (where reports become ready-to-paste prompts for
a coding agent). Framework-agnostic — the UI is plain DOM in a Shadow DOM, so
it works with React, Vue, Svelte, server-rendered pages, or none of them.

## Install

```bash
npm install feedbackkit-web
```

Or with no build step:

```html
<script src="https://cdn.jsdelivr.net/npm/feedbackkit-web/dist/feedbackkit.iife.js"></script>
<script>
  FeedbackKit.configure({ projectKey: "pk_..." });
  FeedbackKit.showFloatingTriggerButton();
</script>
```

### From GitHub Packages

Also published as `@tianhaoz95/feedbackkit-web` on the GitHub npm registry
(which requires a token with `read:packages`, even for public packages):

```ini
# ~/.npmrc
@tianhaoz95:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_PAT
```

```bash
npm install @tianhaoz95/feedbackkit-web
```

## Usage

### Keep the report yourself

```ts
import { FeedbackKit } from "feedbackkit-web";

const report = await FeedbackKit.present(); // null if the user cancels
if (report) {
  // report.text, report.screenshotAnnotated (PNG Blob), report.annotations,
  // report.environment, report.logs … — send it wherever you like.
}
```

### Send it to the FeedbackKit dashboard

```ts
FeedbackKit.configure({
  projectKey: "pk_...",   // from your project's SDK setup tab
  // endpoint: "https://<ref>.supabase.co/functions/v1/ingest-feedback", // when self-hosting
  appVersion: "2.4.0",    // optional
});

FeedbackKit.showFloatingTriggerButton();   // a "Feedback" pill, bottom-right
FeedbackKit.enableKeyboardShortcut();      // ⌘⇧F / Ctrl+Shift+F
// …or from your own button:
await FeedbackKit.presentAndSubmit();
```

Configure from client-only code — the SDK uses `window` and `document`. In
Next.js, call it from a `"use client"` component's `useEffect`.

### Close the loop: "is it fixed?"

```ts
FeedbackKit.configure({ projectKey: "pk_...", appBuild: "2026.09.25.1" }); // appBuild optional
FeedbackKit.enableFixVerification();
FeedbackKit.setUser({ email: currentUser.email }); // optional — shows who reported what
```

Each browser gets an anonymous reporter id (localStorage), sent with every
report. Once a fix for one of this browser's reports ships
(`npx feedbackkit-cli release --build …` after a deploy), a small card
shows the original screenshot and asks "is it fixed?". **Still broken**
reopens the capture dialog so the user can show what's wrong now, and the
report goes back to the developer (and their coding agent). Questions the
developer or agent asks about a report also show up in the card. With
`appBuild` set to a dotted number, only fixes shipped in that build or
earlier are shown; other build ids (e.g. a git SHA) count as live as soon as
they're released. For your own UI, use `checkForFixUpdates()` and
`respondToFixUpdate(id, { type: "verify" | "reopen" | "reply" })`.

### Options

| API | What it does |
|---|---|
| `FeedbackKit.currentScreen = "Checkout"` | Screen name for reports (set on route changes). Defaults to `location.pathname`. |
| `FeedbackKit.theme = { primaryColorHex, secondaryColorHex }` | Brand the trigger and dialog. |
| `FeedbackKit.captureOptions = { mode, maxPixelRatio }` | `mode: "display"` uses the Screen Capture API (pixel-exact, asks every time) instead of DOM rendering. |
| `configure({ captureLogs })` | Console/network log capture — on by default; pass options (`maxEntries`, `includeVerbose`, `network`) or `false`. |
| `configure({ products, defaultProductKey })` | The "affected product" chips. Fetched from the dashboard when omitted. |
| `FeedbackKit.submit(report)` | Send a report you got from `present()`. |
| `FeedbackKit.captureScreenshot()` | Just the viewport PNG, no UI. |
| `FeedbackKit.enableFixVerification()` / `disableFixVerification()` | The "is it fixed?" card (checks on load and tab focus, at most once a minute). |
| `FeedbackKit.setUser({ id, email, name })` | Optional identity attached to reports. `null` on sign-out. |
| `FeedbackKit.reporterId` | This browser's anonymous reporter id. |
| `configure({ reporterUpdatesEndpoint })` | Override where fix updates come from (defaults to the sibling of `endpoint`). |
| `FeedbackKit.destroy()` | Remove the trigger, dialog host, listeners and log hooks. |
| `drawAnnotations(ctx, annotations, size)` | The annotation renderer (a port of the Swift `AnnotationRenderer`), for redrawing stored markup. |

## What's captured

- **Screenshot** — the visible viewport at the current scroll position, including
  sticky/fixed elements, rendered from the DOM (no permission prompt). The
  user can turn it off per report. Cross-origin iframes, images without CORS
  headers and WebGL canvases without `preserveDrawingBuffer` render blank —
  use `mode: "display"` if that matters.
- **Annotations** — freehand, rectangle, arrow and text, movable, resizable
  (scroll / pinch) and rotatable (Shift+scroll / twist), stored as normalized
  `[x, y]` points exactly like the native SDKs'.
- **Environment** — OS, browser, viewport, pixel ratio, locale, page URL (with
  sensitive query parameters redacted), your app version, screen name.
- **Logs** — recent `console.warn`/`console.error`, uncaught errors, unhandled
  rejections, and failed or 4xx/5xx fetch/XHR requests (method, URL, status —
  never bodies). Tokens and secrets are redacted, and the user can untick logs
  for any report.

The project key only allows *creating* feedback. Since it's visible in your
page source, restrict it to your own sites in the dashboard under
**Settings → Allowed web origins**.

## Development

This package lives in the FeedbackKit monorepo at `web-sdk/`; the dashboard
(`web/`) dogfoods it straight from source.

```bash
npm install
npm test            # unit tests (vitest)
npm run build       # dist/feedbackkit.js (ESM) + dist/feedbackkit.iife.js + types
npm run test:e2e    # full flow in real Chromium, Firefox and WebKit (Playwright)
```

## License

See [LICENSE](./LICENSE).
