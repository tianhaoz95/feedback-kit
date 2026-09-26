# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

FeedbackKit is three things sharing one JSON contract / one Postgres schema:

1. **An iOS + macOS + watchOS SDK** (`Sources/FeedbackKit`, one Swift Package)
   — a drop-in library that captures a screenshot, lets the user annotate it
   and describe a problem, and hands the developer a structured
   `FeedbackReport`. The SDK never requires the dashboard; delivery is
   entirely up to the integrating app. iOS and macOS share the data model
   and the drawing/geometry core (`AnnotationRenderer`) but have separate
   UIKit/AppKit UI implementations — see the architecture notes below before
   touching either. watchOS is a deliberately stripped-down third flow (text
   + context only, no screenshot, no annotation tools) rather than a third
   full UI port — see `FeedbackQuickNoteView`. **A web SDK** (`web-sdk/`,
   npm `feedbackkit-web`) brings the same flow to websites and produces the
   same report shape — see the web SDK notes below.
2. **An optional hosted dashboard** (`web/` + `supabase/`) — one way to consume
   that report: receive it, organize it by project, and turn it into a prompt
   for a coding agent.
3. **A CLI + MCP server** (`cli/`) — lets a coding agent fetch that generated
   prompt directly (`feedbackkit mcp`), instead of a human copying it from the
   dashboard and pasting it in. It authenticates as a real dashboard user (see
   the architecture notes below), so it's additive on top of (2), not a new
   backend or credential system.

Read `DESIGN.md` before making non-trivial changes — it explains the
architecture and the reasoning behind the key decisions (window-level capture,
normalized annotation coordinates, snake_case wire format vs. camelCase Swift
API, RLS-enforced multi-tenancy, etc.). Don't repeat that reasoning here; this
file is about how to build/test/run things day to day.

## Repo layout

| Path | What |
|---|---|
| `Sources/FeedbackKit/` | The iOS + macOS + watchOS SDK (Swift Package) |
| `Tests/FeedbackKitTests/` | SDK unit tests |
| `web-sdk/` | Web SDK (npm `feedbackkit-web`, TypeScript, no framework): capture/annotate/submit for websites, plus console/network log capture. Unit tests (vitest) + Playwright e2e |
| `DemoApp/` | Sample apps exercising the SDK on iOS, macOS, and watchOS (one XcodeGen project, three targets; the `.xcodeproj` is generated — not committed) |
| `DeveloperApp/` | Native Developer Portal companion apps for iOS and macOS (one XcodeGen project `FeedbackPortal.xcodeproj`, SwiftUI; the Mac app shares the iOS views — see `DeveloperApp/README.md`). Triages feedback, renders annotations, follows fix loops, dispatches AI coding prompts, and dogfoods FeedbackKit on itself |
| `web/` | Static SPA dashboard (Vite + React + React Router), deployed to Cloudflare Workers Static Assets (`https://feedback-kit.hejitech.workers.dev`) |
| `docs/` | Contributor developer documentation (VitePress), deployed to GitHub Pages (`https://tianhaoz95.github.io/feedback-kit/`) |
| `supabase/` | Postgres migrations, storage policies, the ingestion Edge Function, billing (Stripe) Edge Functions |
| `cli/` | `feedbackkit` CLI + MCP server (Node/TypeScript) — reads feedback/prompts as a logged-in user |
| `skills/` | Agent Skills catalog (`vercel-labs/skills`) for automated setup via AI coding agents |
| `.github/workflows/` | Release/deploy pipelines, incl. `publish-web-sdk.yml` (npm + GitHub Packages) and `web-sdk-ci.yml` (SDK unit + 3-browser e2e, dashboard clean build) |
| `scripts/` | `setup.sh`, `run-ios.sh`, `run-macos.sh`, `run-watchos.sh`, `run-portal-ios.sh`, `run-portal-macos.sh`, `start-web.sh`, `deploy-functions.sh`, `cut_release.sh`, `generate_mac_icon.py`, `generate_social_preview.py`, `release_testflight.sh`, `release_portal_testflight.sh`, `release-mac.sh`, `release_macos_demo.sh`, `release_portal_macos.sh` |
| `branding/` | FeedbackKit logo assets (SVG source + PNG exports) — reused for the iOS app icon and the GitHub OAuth App's logo |

## Commands

### One-time setup

```bash
./scripts/setup.sh      # installs xcodegen + Supabase CLI via brew, npm install for web/
```

### SDK (`Sources/FeedbackKit`)

The macOS side builds and tests natively — no simulator, no `xcodebuild`:

```bash
swift build
swift test
swift test --filter FeedbackReportTests/testHexColorRoundTrip   # a single test
```

iOS and watchOS both need `xcodebuild` against a simulator destination
instead, since `swift build`/`swift test` always resolve to *this* Mac's
platform:

```bash
# Find a simulator id: xcrun simctl list devices available
xcodebuild build -scheme FeedbackKit -destination 'id=<SIMULATOR_UDID>'
xcodebuild test  -scheme FeedbackKit -destination 'id=<SIMULATOR_UDID>'

# Run a single test:
xcodebuild test -scheme FeedbackKit -destination 'id=<SIMULATOR_UDID>' \
  -only-testing:FeedbackKitTests/FeedbackReportTests/testFeedbackReportRoundTripsThroughJSON
```

Same commands for a watch simulator id — `xcodebuild`/the `FeedbackKit`
scheme don't care which platform the destination resolves to.

`Tests/FeedbackKitTests/` runs on all three platforms. Most of it
(`AnnotationRendererTests`, `FeedbackReportTests`) is platform-agnostic,
exercising only the shared model/geometry code; `WatchOSCaptureTests` is
the one platform-specific file, `#if os(watchOS)`-gated, covering that
platform's `EnvironmentInfo`/`ScreenshotCapture`/`FeedbackQuickNoteView`
directly since there's no UI layer to test on any platform otherwise (see
the architecture note on why below).

### Web SDK (`web-sdk/`)

```bash
cd web-sdk
npm install
npm run lint        # tsc --noEmit
npm test            # vitest unit tests (renderer geometry, UA parsing, redaction, wire payload)
npm run build       # dist/feedbackkit.js (ESM, modern-screenshot external) + feedbackkit.iife.js + d.ts
npm run test:e2e    # build, then the full flow in real Chromium/Firefox/WebKit (needs `npx playwright install`)
BROWSERS=chromium node e2e/run.mjs   # one engine
```

The e2e (`e2e/run.mjs` + `e2e/fixture.html`) drives the built IIFE bundle
through trigger → annotate → submit against a mocked endpoint and asserts
the exact JSON posted; screenshots land in `e2e/output/` (gitignored).
Published on releases by `publish-web-sdk.yml` (unified `vX.Y.Z` tags, or
`./scripts/cut_release.sh X.Y.Z --web-sdk` for `web-sdk-vX.Y.Z` alone); the
version comes from the tag, not `package.json`.

### Demo apps (`DemoApp/`)

One XcodeGen project, three targets/schemes — `FeedbackKitDemo` (iOS),
`FeedbackKitDemoMac` (macOS), `FeedbackKitDemoWatch` (watchOS, standalone —
no iOS companion):

```bash
./scripts/run-ios.sh      # regenerates the Xcode project (xcodegen), builds, installs, launches in Simulator
./scripts/run-macos.sh    # same, but builds/launches natively — no simulator
./scripts/run-watchos.sh  # same, but on a watch simulator
```

`DemoApp/project.yml` is the source of truth for the Xcode project — the
`.xcodeproj` and `Generated/*.plist` are gitignored and regenerated by these
scripts (or manually via `cd DemoApp && xcodegen generate`). Edit
`project.yml`, not the generated project, for build settings/Info.plist
changes (including the iOS app icon: `ASSETCATALOG_COMPILER_APPICON_NAME`,
pointing at `DemoApp/DemoApp/Assets.xcassets/AppIcon.appiconset`). Override
the simulator with `SIMULATOR_NAME="iPhone 16" ./scripts/run-ios.sh` or
`SIMULATOR_NAME="Apple Watch SE 3 (44mm)" ./scripts/run-watchos.sh`.

The iOS target's Home (SwiftUI) and Cart (UIKit) screens, and the macOS
target's Home/Cart (both SwiftUI, in `DemoApp/DemoMacApp/`), all share one
`CartStore` (`DemoApp/DemoApp/Support/CartStore.swift`, an
`ObservableObject` singleton included directly in both targets' `sources` in
`project.yml` rather than copied) rather than each holding its own fake
product data — every screen's "Add"/list/remove all read and write the same
state, so before adding demo content to any of them check whether it
belongs in `CartStore` instead of a screen-local model. The watchOS target
has no catalog/cart screens at all — there's nothing to screenshot on that
platform, so its one screen just exercises `FeedbackQuickNoteView` directly
(see the architecture note on watchOS below for why).

Two things about the macOS/watchOS targets' deployment targets that look
like a mismatch but aren't: they're set higher than the SDK's own
`Package.swift` minimums (macOS 13.0 vs. the SDK's 12.0, watchOS 9.0 vs. the
SDK's 8.0) — a consuming app targeting higher than a package's floor is
normal, and here it's specifically needed because `MacContentView` uses
`NavigationSplitView` (macOS 13+) and because this Xcode's watchOS
Simulator only accepts 9.0+ as a deployment target at all (a real build
failure, not a guess) for a *standalone* watch app in the first place.

### Developer Portal (`DeveloperApp/`)

```bash
./scripts/run-portal-ios.sh      # iOS app in the Simulator
./scripts/run-portal-macos.sh    # macOS app ("FeedbackKit Portal"), natively
cd DeveloperApp && xcodegen generate
xcodebuild test -project FeedbackPortal.xcodeproj -scheme FeedbackPortalMac -destination 'platform=macOS'
xcodebuild test -project FeedbackPortal.xcodeproj -scheme FeedbackPortal -destination 'id=<SIMULATOR_UDID>'
./scripts/release_portal_macos.sh --version X.Y.Z [--no-upload]   # notarized DMG → GitHub Release vX.Y.Z (local)
./scripts/cut_release.sh X.Y.Z                # CI: unified release — every pipeline, incl. both Portals
./scripts/cut_release.sh X.Y.Z --mac-portal   # CI: macOS Portal only (tag portal-mac-vX.Y.Z)
```

One `project.yml`, two apps sharing `Sources/`; the Mac target adds `SourcesMac/`
(desktop shell) and makes the iOS views compile via
`Sources/Platform/PortalPlatform+macOS.swift`. Both apps dogfood FeedbackKit
into the team's own project (`Sources/App/PortalDogfood.swift`). Read
`DeveloperApp/README.md` before adding iOS-only APIs to a shared view.

### Web dashboard (`web/`)

```bash
cd web
npm run dev      # dev server (Vite)
npm run build    # type-check + production build to web/dist/
npm run lint     # eslint
```

Needs `web/.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
— see `web/.env.local.example`. `./scripts/start-web.sh` starts local
Supabase and writes this file automatically, then runs `npm run dev`.

This is a **static single-page app** (Vite + React + React Router), not a
Next.js app — there is no server, so there's no middleware, no Server
Actions, no `cookies()`/request-scoped Supabase client. Every page fetches
through the single browser Supabase client (`src/lib/supabase.ts`), auth
state lives in `src/lib/auth.tsx` (`AuthProvider`/`useAuth`/`RequireAuth`),
and mutations are just plain async functions that call `supabase-js`
directly from the component — RLS is what enforces tenancy, so these
functions don't re-implement permission checks. Because route-guarding is
client-side (`RequireAuth`/`RedirectIfAuthed`), protected pages briefly
render a loading state before redirecting signed-out visitors, unlike a
server-side redirect. `web/dist/` is a plain static build deployable to any
static host (GitHub Pages, Vercel static, Netlify, S3, …); a host serving
deep links (e.g. `/projects/abc`) needs SPA fallback routing to
`index.html`, since there's no server to resolve those paths.

The web dashboard is deployed to **Cloudflare Workers Static Assets**
(`https://feedback-kit.hejitech.workers.dev`) via Git integration using
`wrangler.jsonc`. `base` in `web/vite.config.ts` dynamically resolves to `"/"`
for root-domain hosting.

**Developer Documentation (`docs/`)** is built with VitePress and deployed to
GitHub Pages (`https://tianhaoz95.github.io/feedback-kit/`) via
`.github/workflows/deploy-docs.yml` (`actions/deploy-pages`) on every push to
`main` touching `docs/**`. To develop contributor docs locally:
```bash
cd docs
npm install
npm run dev      # VitePress dev server (http://localhost:5173)
npm run build    # type-check + production build to docs/.vitepress/dist/
```

**Auth is GitHub OAuth only** — `LoginPage.tsx` has no email/password form,
just `supabase.auth.signInWithOAuth({ provider: "github" })`. This is
enforced on both ends: `supabase/config.toml` has `auth.email.enable_signup
= false` and `auth.external.github.enabled = true` (client ID/secret via
`env(SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_ID/SECRET)`), and the hosted
project matches — pushed there via a one-time, manually-reviewed
`supabase config push` (see the Supabase section below for why that's not
automated). Don't add an email/password path back into the UI without
updating both.

### Supabase (`supabase/`)

Requires Docker Desktop running.

```bash
./scripts/start-web.sh          # supabase start + writes web/.env.local + npm run dev
supabase status -o env          # local API URL / anon key / service role key
supabase db reset               # reapply supabase/migrations/ from scratch
supabase functions serve        # if iterating on the Edge Function without a full db reset
```

Supabase Studio (inspect tables/storage/auth locally): http://127.0.0.1:54323.

Migrations are numbered and applied in order (`0001_init.sql`,
`0002_storage.sql`, `0003_defaults.sql`, …). Add new schema changes as a new
numbered file rather than editing an already-applied one — once a migration
has been applied to the hosted project, editing it in place is a no-op
remotely (`supabase db push` tracks applied migrations by filename), so a
fix always needs its own new numbered file.

Migrations deploy to the hosted project automatically via Supabase's native
GitHub integration (Dashboard → Project Settings → Integrations → GitHub —
not a custom Actions workflow, deliberately: it's a GitHub App connection
Supabase itself manages and scopes to this repo, so no Postgres password or
account-wide access token needs to live in this repo's secrets). Edge
Functions deploy automatically to the hosted project via GitHub Actions
(`.github/workflows/deploy-functions.yml`) using `SUPABASE_ACCESS_TOKEN` on
every push to `main` touching `supabase/functions/**`, or manually via
`./scripts/deploy-functions.sh`. `supabase config push`
(auth/MFA/pooler/storage settings) is never automated; push those
manually after reviewing `supabase config diff` — a blind push syncs
config.toml's entire declared state, including its local-dev-oriented
defaults, over whatever's actually live.

The dashboard **dogfoods the web SDK from source**: `vite.config.ts` aliases
`feedbackkit-web` → `../web-sdk/src/index.ts` (with `resolve.dedupe` for
`modern-screenshot`, and matching `tsconfig.app.json` `paths`), so `web/`
builds without `web-sdk/node_modules` — which is what Cloudflare's build
has. `web/package.json` lists `modern-screenshot` itself for that reason;
keep its version in step with `web-sdk/package.json`. `src/lib/feedbackkit.ts`
configures it: `VITE_FEEDBACKKIT_PROJECT_KEY` if set, else production builds
send to the FeedbackKit team's hosted project (same key as the Portal app),
and dev builds leave it unconfigured (Feedback button hidden).

### CLI + MCP server (`cli/`)

The CLI is published on npm as `feedbackkit-cli` (`npm install -g feedbackkit-cli` or `npx feedbackkit-cli`).

For local development:

```bash
cd cli
npm install
npm run build      # tsc -b -> dist/
node dist/index.js --help
```

See `cli/README.md` for `npm link` / running from `dist/` directly, the full
command list, and the MCP tool list. `feedbackkit login --dashboard-url http://localhost:3000`
points it at a local `./scripts/start-web.sh` stack instead of the hosted
dashboard.

`feedbackkit docs [topic]` / the `get_docs` MCP tool (`cli/src/docs.ts`)
print FeedbackKit's own reference docs — a condensed, hand-kept-in-sync copy
of `web/src/pages/docs/*.tsx`'s content in plain markdown — so a connected
coding agent can answer "how do I add this to an iOS app" from real
documentation. Unlike every other CLI command/MCP tool, this one doesn't
call `getAuthenticatedClient()` — it's static local content, deliberately
usable before `feedbackkit login`.

### Agent Skills (`skills/`)

Skills follow the [`vercel-labs/skills`](https://github.com/vercel-labs/skills) specification for discovery (`npx skills add . --list`).

```bash
npm run validate       # Validate all SKILL.md frontmatter in skills/
npm run list           # List all discoverable skills via npx skills
npm run new            # Interactively scaffold a new skill with @clack/prompts
npm run new -- <cat>/<name> "description"  # Non-interactive scaffolder
```

Rules for skills:
- Always run `npm run validate` after creating or modifying skills.
- Keep `name` in frontmatter identical to directory basename (`skills/<category>/<skill-name>/SKILL.md`).
- Keep `## Skills Catalog` in `README.md` synchronized with `skills/`.
- Multi-file skills can include templates in a `templates/` subdirectory.

## Architecture notes worth knowing before editing

- **The wire format is intentionally decoupled from the SDK's public Swift
  API.** `FeedbackReport` (public, camelCase) and `IngestPayload` (private
  mirror struct in `FeedbackSubmitter.swift`, snake_case JSON) are two
  different shapes on purpose. If you add a field to `FeedbackReport`, you
  must also update `IngestPayload`'s `CodingKeys`/`encode(to:)`, the
  `ingest-feedback` Edge Function's `IngestPayload` interface, and
  `web/src/lib/types.ts` — nothing enforces this consistency automatically.
- **Annotation points are normalized to 0...1**, not pixel coordinates, in
  both the SDK (`FeedbackAnnotation.points`) and the web types. This is what
  lets annotations render correctly at any screenshot resolution.
- **`environment` and `annotations` stay camelCase in JSON** even though the
  top-level ingestion payload is snake_case — they're stored as opaque JSONB
  and read directly by the web dashboard's TypeScript types, so keep
  `Sources/FeedbackKit/Model/FeedbackReport.swift`'s property names in sync
  with `web/src/lib/types.ts` by hand. This includes `FeedbackAnnotation`
  (e.g. `scale`/`rotation`, set via the drag tool's two-finger gestures) —
  it's nested JSONB too, not just the top-level fields.
- **The optional attachment** (`FeedbackReport.attachment`, picked via the
  composer's "+" button) reuses the `feedback-screenshots` bucket under
  `{project_id}/{feedback_id}/attachment/{filename}` rather than a separate
  bucket/policy — the storage RLS policy only keys off the first path
  segment (project_id), so any path under a project's folder is already
  covered.
- **RLS does the multi-tenancy enforcement**, not application code. Dashboard
  mutations (in `web/src/pages/*.tsx`) generally just run the equivalent
  Supabase query and rely on the policies in `supabase/migrations/0001_init.sql`
  to scope it — don't add manual organization/project ownership checks in
  TypeScript that duplicate what RLS already guarantees.
- **The ingestion Edge Function runs with no Supabase auth**
  (`verify_jwt = false` in `supabase/config.toml` for `ingest-feedback`)
  because the caller is an anonymous iOS device identified only by
  `project_key`. It uses the service-role key and bypasses RLS by design.
- **Billing is dummy infrastructure today, wired up before a real Stripe
  account exists.** `organization_billing` (`0009_billing.sql`) is a
  1:1-per-organization row (same auto-create-on-insert trigger pattern as
  `prompt_templates` for projects), defaulting every org to
  `plan='free'`/`status='none'` forever. Three Edge Functions —
  `create-checkout-session`, `create-portal-session`, `stripe-webhook` — talk
  to Stripe via `supabase/functions/_shared/stripe.ts`'s `getStripe()`, which
  returns `null` (never throws) when `STRIPE_SECRET_KEY` isn't set; every
  function checks for that and responds `501 {error: "billing_not_configured"}`
  instead of failing weirdly, which `web/src/pages/BillingPage.tsx` renders
  as a plain "billing isn't set up yet" notice. This means turning on real
  billing later — `supabase secrets set STRIPE_SECRET_KEY=... STRIPE_WEBHOOK_SECRET=...
  STRIPE_PRICE_ID_PRO=...` on the hosted project, then registering the
  webhook URL in the Stripe Dashboard — needs zero schema or app-code
  changes. The checkout/portal functions authenticate the caller with their
  own Supabase JWT (`verify_jwt` left at its default `true`) and use an
  anon-key client forwarding that JWT to check org membership via RLS, the
  same as the dashboard's own queries — no application-code permission
  checks duplicating what RLS already does. `stripe-webhook` is the
  exception: `verify_jwt = false` (like `ingest-feedback`), since Stripe
  can't present a Supabase session — its trust boundary is verifying the
  `Stripe-Signature` header against `STRIPE_WEBHOOK_SECRET` instead, via
  `constructEventAsync` + `Stripe.createSubtleCryptoProvider()` (the sync
  verifier needs Node's `crypto` module, which doesn't exist in Deno).
- **Screenshot capture is window-level** (`ScreenshotCapture.captureKeyWindow`),
  not view-controller-level — this is why it works for both UIKit and SwiftUI
  screens without the SDK needing to know which one built the screen. Don't
  reintroduce a `UIViewController`-specific capture path. The macOS
  implementation is the same idea one level down the stack: `NSView.cacheDisplay(in:to:)`
  renders the window's content view hierarchy directly (like
  `drawHierarchy(in:afterScreenUpdates:)` does on iOS) rather than compositing
  the real screen buffer, so neither platform needs Screen Recording/screen-
  capture permission for this.
- **Every existing iOS file is wrapped in `#if os(iOS)` around its entire
  contents; every macOS file is a same-named-concept `+macOS.swift` sibling
  wrapped in `#if os(macOS)`.** SPM compiles every file in the target
  regardless of which platform you're building for, so without this an iOS
  build fails immediately on `import AppKit` (and vice versa). If you add a
  new platform-specific type, it needs this wrapper — there's no per-file
  platform exclusion at the package-manifest level to lean on instead.
- **`AnnotationRenderer` and `PlatformTypes.swift` are the only files with no
  `#if os()` split** — deliberately. `AnnotationRenderer` draws with raw
  `CGContext` path/color calls instead of `UIBezierPath`/`NSBezierPath`
  (whose method names genuinely diverge — `addLine(to:)` vs `line(to:)`,
  different rounded-rect initializers), so the exact same file runs on both
  platforms. `PlatformTypes.swift` typealiases `PlatformColor`/`PlatformFont`
  to `UIColor`/`UIFont` or `NSColor`/`NSFont` and holds one hex↔color
  extension shared by both, since `UIColor`/`NSColor` happen to expose
  identical `init(red:green:blue:alpha:)`/`getRed(_:green:blue:alpha:)`
  signatures. Keep new cross-platform drawing/color code going through these
  rather than reaching for `UIBezierPath` again on the iOS side only.
- **macOS's `AnnotationCanvasView` sets `isFlipped = true`.** AppKit views
  default to a bottom-left-origin coordinate system; UIKit's is top-left.
  Flipping is what lets every bit of the (0...1)-normalized annotation
  coordinate math stay byte-for-byte identical to the iOS implementation
  instead of needing a parallel, Y-inverted copy of it.
- **The macOS flow is presented as a sheet** (`FeedbackWindowController.show(on:)`),
  not a full-screen scene — `FeedbackKit.present(from:)` takes an `NSWindow?`
  on macOS (an iOS call site passes a `UIViewController`). There's
  deliberately no macOS equivalent of `enableShakeToReport` — no motion
  sensor and no real analogous gesture to hang it off of; `showFloatingTriggerButton`
  is the recommended default trigger there instead.
- **Scaling/rotating an existing annotation is trackpad-only on macOS**
  (`NSMagnificationGestureRecognizer`/`NSRotationGestureRecognizer`, the
  direct AppKit analogs of the iOS two-finger pinch/twist) — there's no mouse
  equivalent for a two-finger gesture, so a mouse-only user can draw/move
  shapes but not resize/rotate one after the fact. Known, accepted gap
  rather than an oversight.
- **watchOS is intentionally not a third UI port** — the screen's too small
  for freehand/rectangle/arrow annotation to be usable, and there's no
  window-level API to capture a screenshot from in the first place
  (watch apps are SwiftUI-only, no `UIWindow`). `FeedbackQuickNoteView` is a
  plain SwiftUI view the developer embeds themselves (there's no
  `UIWindow`/`NSWindow` for FeedbackKit to present modally over, so no
  `present(from:)` on this platform); `ScreenshotCapture`'s watchOS branch
  renders a small, clearly-labeled placeholder card (plain `CGContext`
  drawing, not `UIGraphicsImageRenderer` — confirmed unavailable there by
  a real build against a watch simulator, not assumed) purely so
  `FeedbackReport`'s screenshot fields have *something* rather than `nil`.
  watchOS has no user-facing toggle to leave the screenshot out (see the
  next bullet) — it always produces the placeholder.
- **`FeedbackReport.screenshotRawPNG`/`screenshotAnnotatedPNG` are `Data?`,
  not `Data`** — on iOS/macOS a "Screenshot" switch in the composer's second
  row (next to the send button, on by default) lets the user exclude the
  screenshot for a pure-description report; when off, `FeedbackViewController`/
  `FeedbackWindowController`'s `submitTapped()` sends `nil`/`nil`/`[]` for
  screenshot/annotations instead of encoding real PNG data. This is exactly
  the "should these fields be optional across the whole stack" question the
  watchOS port above deferred — it became worth doing once iOS/macOS needed
  it too, not just watchOS. If you touch this path, the whole chain has to
  move together: `IngestPayload.encode` (`encodeIfPresent`, not `encode`),
  `feedback_items.screenshot_raw_path`/`screenshot_annotated_path` (nullable
  since `0008_optional_screenshot.sql`), the `ingest-feedback` Edge
  Function's conditional upload/insert, and every dashboard/CLI/MCP call
  site that creates a signed URL or fills the `{{screenshot_url}}` prompt
  placeholder from those paths — they all guard on the path being non-null
  now, the same pattern already used for the optional `attachment_path`.
- **`FeedbackKit.theme` (`FeedbackTheme`) lets a host app brand the feedback
  screen** with its own primary/secondary accent colors instead of the
  system default (`.systemBlue` on iOS/watchOS, `.controlAccentColor` on
  macOS). Colors are hex strings, not `UIColor`/`NSColor`, so the struct is
  `Sendable` and works unmodified across all three platforms; the UI layer
  converts via `PlatformColor.init(hex:)` (the same conversion the
  annotation tool's color swatches already use). Primary drives the flow's
  call-to-action controls (send button, selected annotation tool, the
  screenshot toggle's on-tint); secondary drives Cancel and the attach
  button. Every themed call site falls back to its *own* existing hardcoded
  default when `theme` is `nil` or fails to parse, so leaving it unset is a
  byte-for-byte no-op. `NSSwitch` has no tint API at all (unlike
  `UISwitch`), so the screenshot toggle's on-tint is iOS-only — a known
  platform gap. See `DemoApp`'s three app targets for a working example
  (`FeedbackKit.theme = .init(primaryColorHex:secondaryColorHex:)` in each
  target's `init()`); the iOS target's Settings tab additionally has a live
  "Branding" picker (`DemoBranding.swift`) that swaps `FeedbackKit.theme`
  immediately on selection and persists the choice via `@AppStorage`, for a
  developer to see the effect without editing code.
- **`AnnotationRenderer` and `PlatformTypes.swift` cover watchOS too**, via
  `#if os(iOS) || os(watchOS)` for the `UIColor`/`UIFont` typealiases —
  watchOS carries UIKit's plain data types (no `UIView`/`UIWindow`, but
  `UIColor`/`UIFont`/`UIImage` exist, since SwiftUI needs them there) — see
  `PlatformTypes.swift`'s comment. `UIColor.systemRed` is *not* one of
  those available bits (another one found by a real build, not assumed);
  the one fallback color in `AnnotationRenderer` uses plain `.red` instead
  for exactly this reason — don't reach for a `.system*` color there again
  without checking watchOS availability.
- **The CLI authenticates by receiving a real Supabase session, not a
  separate token type.** `feedbackkit login` opens `/cli-auth` in the
  browser (`CliAuthPage.tsx`), which — once the user is signed in — hands
  the CLI its *own* `access_token`/`refresh_token` via a redirect to a
  local server the CLI started for this purpose (`cli/src/commands/login.ts`).
  This means RLS enforces CLI access exactly like it enforces browser access,
  with zero new authorization logic (`cli/src/supabaseClient.ts` deliberately
  has none). `cli_sessions` (`0007_cli_sessions.sql`) is bookkeeping only, so
  a user can see/revoke connected CLIs — revocation is cooperative (the CLI
  checks its own row before doing work), not a cryptographic kill of the
  underlying Supabase session, because doing that properly needs the raw
  access token persisted server-side, which is a bigger secret to hold than
  the problem justifies. Don't try to make revocation "harder" by storing
  access tokens in that table — see the migration's comment.
- **The closed loop (`0014_closed_loop.sql`) tracks fixes in `fix_stage`, not
  in new `status` values.** Shipped Portal builds decode `status`, so it keeps
  its four values. Every writer that moves `fix_stage` also sets the
  matching `status` (`record_release`, `reporter-updates`, `github-webhook`,
  `cli/src/loop.ts`), so keep that pairing if you add a transition.
  `compare_builds` (build ordering) is duplicated in SQL,
  `supabase/functions/_shared/builds.ts`, `cli/src/loop.ts`,
  `Sources/FeedbackKit/Model/FixUpdate.swift` and `web-sdk/src/fixes.ts`,
  and nothing enforces consistency, same as the wire format. The
  reporter-updates response and action payload are mirrored by hand in
  `FixUpdatesClient.swift` and `web-sdk/src/fixes.ts`. `feedback_events` is
  append-only for members, and its insert policy pins `actor_user_id =
  auth.uid()` so no one can forge reporter/GitHub events. Only Edge
  Functions (service role) write those. `github-webhook` rejects every
  delivery unless `GITHUB_WEBHOOK_SECRET` is set. See DESIGN.md §7.
  End-to-end test against a local stack:
  `cli/test/closed-loop.integration.mjs` (needs `supabase functions serve`
  with `GITHUB_WEBHOOK_SECRET=testsecret`; header comment has the steps).
- **The web SDK's report is the Swift contract, not a lookalike.**
  Annotation points are `[x, y]` tuples (how `CGPoint` encodes), and every
  required `FeedbackEnvironment` field is always sent, because the Developer
  Portal decodes web reports with the Swift SDK's own types — a missing field
  fails the whole item. Web-only data goes in *optional* fields
  (`platform: "web"`, `pageUrl`, `userAgent`, `browserName`, `browserVersion`
  — mirrored as optionals on the Swift `FeedbackEnvironment`, in
  `web/src/lib/types.ts` and `cli/src/types.ts`) or the separate
  `feedback_items.logs` column (`0013_web_sdk.sql`). `web/src/lib/platform.ts`
  infers native platforms from `osName`, since native reports never set
  `platform`. Web prompts get `{{platform}}`/`{{page_url}}`/`{{browser}}`/
  `{{console_logs}}`, and a "Web context" section is auto-appended when a
  template uses none of them — implemented three times (web, CLI, Portal's
  `PromptGenerator.swift`), keep them in sync by hand.
- **Web capture re-renders the DOM** (`web-sdk/src/capture.ts`) rather than
  using the Screen Capture API, for the same no-permission reason as the
  native window-level capture; it clips to the viewport and re-pins
  fixed/sticky elements in the clone (a `<body>` transform otherwise makes
  it their containing block). Don't "simplify" that away without re-running
  the e2e — it's what makes sticky headers and floating buttons land in the
  right place. `web-sdk/src/renderer.ts` is a port of `AnnotationRenderer`;
  change both together.
- **Ingestion now has abuse controls** (`0013_web_sdk.sql`):
  `projects.allowed_origins` (empty = any; only checked when an `Origin`
  header exists, so native apps are never affected) and a per-project
  per-minute cap on server-set `received_at`. Both fail open if the columns
  are missing, so function and migration can deploy in either order — keep
  that property when adding checks.
- **RLS helper functions that query the same table their policy protects
  must be PL/pgSQL, not `language sql`, and every policy on that table needs
  the same treatment.** This bit us for real: `auth_organization_ids()` (used
  by the `memberships` policies) was `language sql` — Postgres can inline
  plain SQL functions into the caller's query, which defeats the
  SECURITY DEFINER owner's RLS bypass and causes "infinite recursion detected
  in policy" (a 500 from PostgREST) on any `memberships` query. PL/pgSQL is
  never inlined, so `0004_fix_membership_rls_recursion.sql` switched it. That
  alone wasn't enough — `memberships` also had a second, `for all` policy
  ("owners can manage memberships") that queried `memberships` *directly*
  with no function indirection at all, and `for all` covers `select` too, so
  it kept recursing regardless (`0005_fix_membership_owner_policy_recursion.sql`
  gave it the same safe-helper-function treatment). If you add a new policy
  on `memberships`, `organizations`, or any table a helper function reads
  from, make sure it goes through a PL/pgSQL SECURITY DEFINER function too,
  not a direct subquery on that same table.
