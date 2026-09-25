# Web SDK (`web-sdk/`)

The browser counterpart of the Swift SDK, published to npm as
[`feedbackkit-web`](https://www.npmjs.com/package/feedbackkit-web) (and to
GitHub Packages as `@tianhaoz95/feedbackkit-web`). Same capture → annotate →
describe → `FeedbackReport` flow, same wire format, same ingestion endpoint.
User-facing docs live on the dashboard at `/docs/web-sdk`; this page is for
contributors.

## Layout

| Path | What |
|---|---|
| `src/index.ts` | Public `FeedbackKit` API (configure, present, presentAndSubmit, triggers, shortcut, log capture, destroy) |
| `src/global.ts` | Entry for the `<script>`-tag IIFE build (`window.FeedbackKit`) |
| `src/types.ts` | Public report model — mirrors `Sources/FeedbackKit/Model/FeedbackReport.swift` |
| `src/capture.ts` | Viewport capture: DOM re-rendering via `modern-screenshot` (default) or the Screen Capture API |
| `src/renderer.ts` | Canvas port of the Swift `AnnotationRenderer` (drawing + hit-testing) |
| `src/environment.ts` | OS/browser detection (UA + Client Hints), URL redaction |
| `src/logs.ts` | Console / error / fetch+XHR ring buffer with redaction |
| `src/submit.ts` | Wire payload encoding (same shape as Swift's `IngestPayload`) and submission |
| `src/ui/` | Shadow-DOM widget: trigger button, dialog, annotation editor, styles, icons |
| `test/` | Vitest unit tests |
| `e2e/` | Playwright end-to-end suite (Chromium, Firefox, WebKit) against a fixture page |

## Commands

```bash
cd web-sdk
npm install
npm run lint       # tsc --noEmit
npm test           # unit tests
npm run build      # ESM + IIFE bundles + .d.ts into dist/
npm run test:e2e   # build + full flow in 3 real browsers (npx playwright install first)
```

## How capture works

The page's own DOM is rendered into an image (SVG `foreignObject`), clipped to
the viewport and shifted by the scroll offset. Because shifting puts a
transform on `<body>` — making it the containing block for every
`position: fixed` descendant — fixed and sticky elements are measured on the
live page and re-pinned *in the clone* to where they appeared on screen. The
e2e suite compares against real browser screenshots with sticky headers,
fixed buttons, transformed modals and scrolled containers.

Limits: cross-origin iframes, images without CORS headers and WebGL canvases
without `preserveDrawingBuffer` render blank. `captureOptions.mode = "display"`
switches to `getDisplayMedia` (pixel-exact, prompts every time, desktop only).

## The contract with the rest of the stack

- Annotation points are `[x, y]` tuples — how Swift's `CGPoint` encodes — and
  every required Swift `FeedbackEnvironment` field is always sent, because the
  Developer Portal decodes web reports with the Swift SDK's types.
- Web-only fields are optional: `environment.platform = "web"`, `pageUrl`,
  `userAgent`, `browserName`, `browserVersion`, plus the top-level `logs`
  array stored in `feedback_items.logs` (`0013_web_sdk.sql`).
- The dashboard, CLI and Portal add `{{platform}}`, `{{page_url}}`,
  `{{browser}}` and `{{console_logs}}` prompt placeholders, and append a
  "Web context" section automatically when a template uses none of them.

## Dogfooding

The dashboard imports the SDK **from source** (`web/vite.config.ts` aliases
`feedbackkit-web` to `../web-sdk/src/index.ts`) for its own Feedback button,
configured in `web/src/lib/feedbackkit.ts`. `web-sdk-ci.yml` builds the
dashboard from a clean checkout to make sure that alias works without
`web-sdk/node_modules`, matching the Cloudflare build.

## Releasing

`publish-web-sdk.yml` runs on every published GitHub Release (unified `vX.Y.Z`
tags, or `web-sdk-vX.Y.Z` via `./scripts/cut_release.sh X.Y.Z --web-sdk`). It
lints, unit-tests, builds, runs the Chromium e2e, then publishes to npm (with
provenance) and GitHub Packages. The published version comes from the tag.
