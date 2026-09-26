# FeedbackKit — Design Overview

FeedbackKit is three things that share one contract:

1. **An iOS + macOS + watchOS SDK** (`FeedbackKit`, one Swift Package) that
   lets any app capture a screenshot, let the user annotate it and describe
   a problem, and hands the developer a structured `FeedbackReport`. What
   happens to that report is entirely up to the developer. (watchOS is a
   deliberately stripped-down flow — text and context only, no screenshot,
   no annotation — see §1.) **A web SDK** (`web-sdk/`, npm `feedbackkit-web`)
   is the same idea for websites and produces the same report shape — see §1b.
2. **An optional hosted dashboard** (`web/` + `supabase/`) that's just one way
   to consume that report: a place to receive it, organize it by project,
   and turn it into a prompt for a coding agent.
3. **A CLI + MCP server** (`cli/`) that lets a coding agent fetch that
   generated prompt directly — the last manual step (copying it from the
   dashboard and pasting it to the agent) removed. It's additive on top of
   (2): a CLI-shaped client of the same database, not a new backend.

The SDK never requires the dashboard. The dashboard never requires anything
beyond "something POSTs this JSON shape to this URL." That boundary is the
main architectural decision in this project — everything else follows from it.

```
 ┌─────────────────────┐        FeedbackReport         ┌──────────────────────┐
 │   iOS app + SDK      │ ─────────────────────────────▶│  developer's own     │
 │  (Sources/FeedbackKit)       (completion handler)     │  code — print it,    │
 │                      │                                │  send it anywhere    │
 └──────────┬───────────┘                                └──────────────────────┘
            │ optional: FeedbackKit.configure(...) + presentAndSubmit
            ▼
 ┌──────────────────────┐   POST /functions/v1/ingest-feedback (project_key)
 │ Supabase Edge Function│ ◀────────────────────────────────────────────────────
 │   ingest-feedback     │
 └──────────┬────────────┘
            │ service-role writes
            ▼
 ┌──────────────────────┐   RLS-scoped reads/writes  ┌───────────────────────┐
 │ Postgres + Storage    │ ◀─────────────────────────▶│ Next.js dashboard (web)│
 │ (organizations,       │                             │ projects, feedback,   │
 │  projects, feedback)  │                             │ prompt templates      │
 └──────────────────────┘                             └───────────────────────┘
```

## 1. iOS + macOS + watchOS SDK (`Sources/FeedbackKit`)

**Capture is window-level, not view-controller-level.** `ScreenshotCapture`
renders the key `UIWindow`'s layer to a bitmap (`UIGraphicsImageRenderer` +
`drawHierarchy`). This is the load-bearing decision that lets the SDK work
identically whether the screen on top was built with UIKit, SwiftUI, or a mix
— it never has to know or care. The demo app has one screen of each
(`HomeView.swift` in SwiftUI, `CartViewController.swift` in UIKit) specifically
to prove this.

**Annotation is a transparent overlay** (`AnnotationCanvasView`) sized to
exactly match the screenshot's on-screen frame (computed with `AVMakeRect` so
there's no letterboxing math to get wrong). It supports four tools —
freehand, rectangle, arrow, text — and stores every shape as normalized
(0...1) points, so annotations render identically at any resolution. On
submit, `flattenedImage(baseImage:)` burns the shapes into the screenshot at
its *native pixel size* (independent of the on-screen view size), and both the
raw and flattened PNGs travel in the final report — raw for record-keeping,
flattened for actually looking at the bug, plus the structured shapes in case
a future consumer wants to re-render or edit them.

**Triggers are pluggable by design.** `FeedbackKit.present(from:)` is the one
call everything else is built on. `enableShakeToReport` and
`showFloatingTriggerButton` are conveniences on top of it — a developer who
wants a custom trigger (menu item, debug gesture, whatever) just calls
`present(from:)` directly and ignores both. Shake detection swizzles
`UIWindow.motionEnded` (the standard technique for this — Instabug and
similar SDKs do the same) so it works without the host app subclassing
`UIWindow`.

**"Which screen was this?" has no fully reliable answer**, so the SDK takes a
best-effort layered approach: `FeedbackKit.currentScreen` is a developer-set
string (recommended — set it as the user navigates), with automatic
top-view-controller-name detection (`TopViewControllerResolver`) as a fallback
for apps that don't bother. The fallback only sees UIKit view controllers,
which is disclosed in the doc comment rather than silently pretending it's
reliable for SwiftUI-only screens.

**The wire format is decoupled from the Swift API.** `FeedbackReport` and its
nested types use idiomatic Swift camelCase — that's the public API surface.
`FeedbackSubmitter`'s `IngestPayload` is a private mirror struct that encodes
the same data as snake_case JSON for the ingestion endpoint. This keeps the
public SDK API from being shaped by a backend convention it doesn't need to
know about.

**macOS is a second UI implementation on top of the same model, not a port.**
`FeedbackReport`, `FeedbackAnnotation`, `FeedbackEnvironment`,
`FeedbackKitConfiguration`, and `FeedbackSubmitter` were already pure
Foundation/CoreGraphics — zero changes needed for a second platform. The UI
layer is where iOS and macOS genuinely diverge (UIKit and AppKit don't share
view, event, or gesture-recognizer *classes*, even where the concepts line
up closely), so every UIKit file has an AppKit sibling
(`FeedbackViewController` ↔ `FeedbackWindowController`, `AnnotationCanvasView`
↔ its `+macOS` file, etc.) rather than one file trying to abstract over both.
Two exceptions, because the underlying APIs happened to allow it:

- **`AnnotationRenderer` draws with raw `CGContext` path/color calls**
  (`ctx.addLine(to:)`, `ctx.setStrokeColor(_:)`) instead of
  `UIBezierPath`/`NSBezierPath`, whose APIs look similar but genuinely
  diverge (`addLine(to:)` vs `line(to:)`, different rounded-rect
  initializers). Core Graphics itself has zero platform divergence, so this
  one file — the actual drawing math for all four annotation shapes plus
  hit-testing — is shared byte-for-byte between both platforms.
- **`UIColor` and `NSColor` happen to expose identical
  `init(red:green:blue:alpha:)`/`getRed(_:green:blue:alpha:)` signatures**
  (unlike their bezier paths), so `PlatformTypes.swift` typealiases
  `PlatformColor`/`PlatformFont` per platform and defines the hex↔color
  conversion once against that typealias instead of twice.

The one real, unavoidable gap: **shake-to-report has no macOS equivalent** —
no motion sensor, no analogous gesture — so `enableShakeToReport` simply
doesn't exist on macOS; `showFloatingTriggerButton` (an `NSPanel`-adjacent
floating button, positioned via Auto Layout constraint constants rather than
raw frame math since an arbitrary host app's content view may or may not be
flipped) is the recommended default trigger there instead. Scaling/rotating
an existing annotation is trackpad-only on macOS too
(`NSMagnificationGestureRecognizer`/`NSRotationGestureRecognizer`, the direct
analogs of iOS's two-finger pinch/twist) — there's no mouse equivalent for a
two-finger gesture.

**watchOS is a stripped-down flow, deliberately not a third UI port.** Two
things make "port the annotate UI to watchOS" the wrong move, not just a
harder version of the same move: the screen is too small for
freehand/rectangle/arrow drawing to be a usable interaction regardless of
how it's implemented, and there's no window-level (or any) API for capturing
arbitrary on-screen content the way `drawHierarchy`/`cacheDisplay` do on
iOS/macOS — watch apps are SwiftUI-only, with no `UIWindow` a third party
can reach into. So `FeedbackQuickNoteView` is a plain SwiftUI view carrying
just a text field — the developer embeds it in their own presentation
(typically `.sheet`), since there's no `UIWindow`/`NSWindow` for FeedbackKit
to present modally over the way `present(from:)` does on the other two
platforms.

`FeedbackReport`'s `screenshotRawPNG`/`screenshotAnnotatedPNG` were
originally non-optional `Data`. When watchOS was added, making them optional
was considered and rejected for that feature alone — too much ripple (the
Postgres `not null` columns, the ingestion Edge Function's unconditional
upload/insert, the web dashboard/CLI/MCP's unconditional signed-URL/prompt-
placeholder generation) to take on for one platform's sake. Instead,
`ScreenshotCapture`'s watchOS branch rendered a small, clearly-labeled
placeholder card (a plain colored rectangle with a border — not an attempt
at a fake screenshot) purely to give those fields *something*, and the
actual substance of a watchOS report stayed `text` plus `FeedbackEnvironment`
(device, watchOS version, app version, locale) — surfaced by the dashboard's
existing prompt-template placeholders (§4) with zero new plumbing, since a
report's environment fields are handled identically regardless of which
platform produced them.

That deferred rework became genuinely necessary once iOS/macOS themselves
needed an optional screenshot (a toggle in the composer, for reports that
are pure description, with nothing worth screenshotting) — at that point "optional
screenshot" was no longer a watchOS-only quirk to route around, it was the
actual shape of the data everywhere, so the fields became real `Data?` end
to end: the Postgres columns dropped `not null`
(`0008_optional_screenshot.sql`), the Edge Function uploads/inserts the
paths conditionally, and the web/CLI/MCP signed-URL and prompt-placeholder
code paths all guard on the path being non-null (mirroring the existing
`attachment_path` pattern they already had for the same reason). watchOS's
placeholder-card behavior is unchanged — it still always produces *a*
screenshot rather than `nil`, since there's no user-facing toggle on that
platform to leave one out.

Two watchOS-specific findings worth flagging because they contradicted a
reasonable-sounding assumption, caught by actually building against a watch
simulator rather than guessing: **`UIGraphicsImageRenderer` is not
available on watchOS**, even though `UIColor`/`UIFont`/`UIImage` are (the
placeholder card is built from a raw `CGContext` bitmap instead, the same
style `AnnotationRenderer` already uses); and **`UIColor.systemRed` is not
available on watchOS** either, even though plain literal colors like `.red`
are (`AnnotationRenderer`'s malformed-hex fallback uses `.red` for exactly
this reason). Don't assume the rest of watchOS's UIKit subset without
checking — it's a real subset, not "UIKit minus views."

**`FeedbackKit.theme` lets the host app brand the feedback screen** instead
of always showing FeedbackKit's own system-blue accent. `FeedbackTheme`
holds two hex strings (`primaryColorHex`/`secondaryColorHex`) rather than
`UIColor`/`NSColor` values, for the same reason `FeedbackKitConfiguration`
and the wire format use plain data types — one `Sendable` struct that works
unmodified on all three platforms, converted to a platform color only at the
point of use via `PlatformColor.init(hex:)` (already used by the annotation
tool's color swatches). The mapping is deliberately asymmetric with how
prominent each control is, not a literal "primary=this, secondary=that"
pair: primary drives the flow's call-to-action affordances (the send
button, the selected annotation tool, the screenshot toggle's on-tint);
secondary drives the less prominent ones (Cancel, the attach button).
Every themed call site falls back to its own *existing* hardcoded default
(`.systemBlue`, `.controlAccentColor`, `.secondaryLabel`, …) when `theme` is
`nil` or a hex string fails to parse, rather than the theme itself owning a
single fallback color, specifically so a caller who never touches `theme`
sees byte-for-byte the same UI as before theming existed — the diff that
introduced this deliberately never changed a color constant, only made each
one overridable. `NSSwitch` (macOS) has no tint/on-color API at all, unlike
`UISwitch`, so the screenshot toggle's on-tint only ever reflects the
primary color on iOS — a known, accepted platform gap, not an oversight.

## 1b. Web SDK (`web-sdk/`, npm `feedbackkit-web`)

The browser counterpart of §1: same capture → annotate → describe → report
flow, same `FeedbackReport` shape, same optional delivery to the same
ingestion endpoint. Nothing downstream needed to learn a new format — a web
report is a normal `feedback_items` row, with a few additive fields.

**Capture is DOM re-rendering, not screen capture** (`src/capture.ts`). The
page's own DOM is rendered into an image with `modern-screenshot` (SVG
`foreignObject`, so the browser itself lays out every modern CSS feature —
html2canvas reimplements CSS and can't even parse Tailwind v4's `oklch()`).
That's the web analog of §1's window-level capture: render our own view
hierarchy instead of reading the screen buffer, so there's never a
permission prompt. The Screen Capture API (`getDisplayMedia`) is an opt-in
`captureOptions.mode = "display"` for pages that need pixel-exact output
(cross-origin iframes, WebGL) — it asks every time and doesn't exist on
mobile, so it's not the default.

What's captured is the **viewport**, not the document, because that's what
the user saw and what annotations are normalized against. The root is
clipped to `innerWidth × innerHeight` and shifted by the scroll offset — but
a transform on `<body>` silently makes it the containing block for every
`position: fixed` descendant, and sticky elements have no scroll context in
the clone. `pinFixedAndSticky` measures each fixed/sticky element's
on-screen box first and re-pins it in the *clone only* (the live page only
gets a temporary data attribute). Verified pixel-for-pixel against real
browser screenshots in Chromium, Firefox and WebKit with sticky headers,
fixed FABs, transformed modals and scrolled inner containers.

**The report contract is the Swift one, byte for byte where it matters.**
Annotation points are `[x, y]` tuples because that's how Swift's `CGPoint`
encodes through `Codable` — the Developer Portal decodes stored web reports
with the Swift SDK's own `FeedbackAnnotation`/`FeedbackEnvironment`, so every
required Swift field is always sent (`osName` is the real OS, `deviceModel`
the browser, `screenWidthPoints` the viewport, `screenScale` the pixel
ratio, `bundleIdentifier` the host). Web-only facts are *additive optional*
fields (`platform: "web"`, `pageUrl`, `userAgent`, `browserName`,
`browserVersion`) that Swift's `Codable` ignores or, since this change,
decodes into optional properties. `web-sdk/test/submit.test.ts` and
`FeedbackReportTests.testDecodesWebSDKEnvironmentAndAnnotations` pin the
contract from both sides.

**Annotation rendering is a line-for-line port of `AnnotationRenderer`**
(`src/renderer.ts`): same 4pt stroke, arrowhead geometry, text-bubble
metrics, scale/rotation math and hit-testing, in the capture's CSS-pixel
space. The dashboard imports the same renderer to overlay stored markup
(from any platform) on the raw screenshot. Scale/rotate works by pinch/twist
on touch and by wheel / Shift+wheel with a mouse — closing the gap the macOS
port accepted (trackpad-only).

**Console & network logs** (`src/logs.ts`) are the one thing a browser knows
that a native report doesn't, and exactly what turns "the button does
nothing" into a root cause for a coding agent. A small ring buffer records
`console.warn/error`, uncaught errors, unhandled rejections and failed or
4xx/5xx fetch/XHR (method, URL, status — never bodies), with credentials
redacted. They're stored in their own `feedback_items.logs` JSONB column
rather than inside `environment` (which mirrors a Swift struct describing the
device, not an event stream), and the dialog shows exactly what's included
with a per-report opt-out.

**UI isolation:** everything lives in one Shadow DOM host with
`:host { all: initial }`, so host-page CSS can't break the widget and vice
versa — no framework dependency, which is what lets one package serve React,
Vue, server-rendered pages and plain `<script>` tags alike. The IIFE build is
self-contained; the ESM build keeps `modern-screenshot` external and
lazy-loads it on first capture.

**Dogfooding:** the dashboard (`web/`) uses the SDK for its own Feedback
button, importing it *from source* via a Vite alias rather than from npm, so
an SDK change is exercised by the real app in the same commit (and
`web-sdk-ci.yml` builds the dashboard from a clean checkout to prove the
alias works without `web-sdk/node_modules`, which is what Cloudflare's build
sees). Its reports go to the same hosted project as the Portal app's.

## 2. Data model / multi-tenancy (`supabase/migrations`)

```
organizations ──< memberships >── auth.users     (an org = a developer account;
     │                                             memberships is many-to-many,
     │                                             so teams work from day one)
     ├──< organization_billing (1:1, Stripe plan/status — see below)
     │
     ▼
  projects ──< prompt_templates (1:1 default template per project)
     │
     └──< feedback_items (screenshots in Storage, annotations/environment as JSONB)
```

- **RLS, not application code, enforces privacy.** Every table's policies
  resolve through `auth_organization_ids()` (a `security definer` function
  reading `memberships`), so "no cross-visibility between accounts" is a
  database guarantee, not something every query has to remember to filter by.
- **Two different kinds of keys, on purpose.** A project's `project_key` is
  embedded in a shipped iOS binary and can only ever *create* feedback for
  that project (the ingestion function looks it up with the service-role key,
  bypassing RLS entirely, by design — there's no user session on an anonymous
  device). It is never used to *read* anything, so it doesn't need to be a
  guarded secret. Dashboard access is entirely separate, via normal Supabase
  Auth sessions + RLS.
- **New signups get an organization automatically** (`handle_new_user`
  trigger), and **every project gets a default prompt template automatically**
  (`create_default_prompt_template` trigger) — both so the dashboard is
  useful immediately after signup/project-creation with zero required setup
  steps.
- **Screenshots live in private Storage**, not the database, at
  `{project_id}/{feedback_id}/{raw,annotated}.png`. The dashboard reads them
  via short-lived signed URLs generated per-request; a storage RLS policy
  restricts *signing* to members of the owning organization.
- **Billing (`organization_billing`) is built ahead of having a real Stripe
  account.** Same "auto-create on insert" trigger pattern as
  `prompt_templates`, so every organization has exactly one billing row from
  the moment it exists (`plan='free'`, `status='none'` by default) rather
  than the dashboard needing to handle a third "no row yet" case. The three
  Stripe-facing Edge Functions detect missing credentials and say so rather
  than erroring — see CLAUDE.md's billing note and README.md's "Turning on
  real billing" for exactly what flips this from dummy to live.

## 3. Ingestion (`supabase/functions/ingest-feedback`)

A single Edge Function, deliberately with no Supabase-auth requirement
(`verify_jwt = false` in `supabase/config.toml`) since the caller is an
anonymous iOS device identified only by `project_key`. It looks up the
project, uploads both PNGs to Storage, and inserts the `feedback_items` row —
using the service-role key throughout, since RLS is built for authenticated
dashboard users, not anonymous ingestion.

The composer's optional attachment (any file, via `UIDocumentPickerViewController`
— separate from the screenshot, added from the "+" button next to send)
follows the same base64-over-JSON path as the screenshots and lands in the
same `feedback-screenshots` bucket, under `{project_id}/{feedback_id}/attachment/{filename}`
— the storage RLS policy only keys off the first path segment, so no new
bucket or policy was needed, just three new nullable `feedback_items` columns
(`attachment_path`/`attachment_filename`/`attachment_mime_type`).

**Abuse controls** (`0013_web_sdk.sql`). A project key is public by
design, but on the web it's trivially readable in page source and CORS is
`*`, so any other site could embed someone's key. `projects.allowed_origins`
(empty = allow all, so existing projects are unaffected) is checked against
the request's `Origin` header — requests without one (native apps, curl) are
never blocked, because this is about stopping *other websites*, not a
determined script. For that there's a per-project submissions-per-minute cap
(`INGEST_RATE_LIMIT_PER_MINUTE`, default 30) counted on a server-set
`received_at` column, since `created_at` comes from the client. Both checks
fail open if their columns are missing, so a function deploy that lands
before its migration can't take ingestion down.

## 4. AI-agent prompt generation (the dashboard's actual differentiator)

This is intentionally just string substitution, not a templating engine
(`web/src/lib/prompt-template.ts`): a `{{placeholder}}` find-and-replace over
a plain-text template. The set of placeholders (`feedback_text`,
`screen_name`, `os_name`, `device_model`, `screenshot_url`, etc.) is small and
fixed, and keeping this trivial keeps the template itself — which developers
read and hand-edit directly — easy to reason about instead of hiding behind
templating-language syntax.

Two layers of editability, matching the two requirements ("preview the
conversion" and "let the developer make the final call"):
- **Per-project default template** (`prompt_templates.template_text`) — edited
  on the project page, applies to every new feedback item.
- **Per-item override** (`feedback_items.edited_prompt`) — a developer can
  tweak the generated prompt for one specific report (e.g. to add "also check
  the caching layer") without touching the shared template. A feedback item
  with no override just renders the current template live, so template edits
  retroactively improve prompts for old, still-unedited items.

Both are plain textareas with a "Copy for coding agent" button
(`navigator.clipboard`) — no attempt to integrate with any specific agent's
API, since "copy into whatever you use" is more durable than betting on one
tool.

## 5. Web dashboard (`web/`, static SPA: Vite + React + React Router + Supabase)

Originally a Next.js App Router app; rewritten as a plain static single-page
app so it can be hosted anywhere that serves static files (including GitHub
Pages), with no server component at all. There is no middleware, no Server
Actions, no request-scoped Supabase client — every page uses one browser
Supabase client (`src/lib/supabase.ts`) and fetches its own data in
`useEffect` on mount. Mutations (`createProject`, `updatePromptTemplate`,
`updateFeedbackStatus`, `save/resetEditedPrompt`) are plain async functions
that call `supabase-js` directly from the component that needs them — RLS
does the authorization work, so these still don't re-implement permission
checks; they're the same query a Server Action would have run, just invoked
client-side.

Auth state lives in a `src/lib/auth.tsx` context (`AuthProvider`) backed by
`supabase.auth.onAuthStateChange`; `RequireAuth`/`RedirectIfAuthed` wrapper
components stand in for what `src/proxy.ts` (Next middleware) used to do.
The tradeoff versus middleware: route-gating happens after the JS bundle
loads and the auth check resolves, so a signed-out visitor briefly sees a
loading state instead of never receiving the protected page's HTML. Since
RLS — not the redirect — is the actual security boundary, this is a UX
difference, not a security regression.

The landing page (`/`), privacy notice (`/privacy`), user agreement
(`/terms`), and docs (`/docs/*`) are public routes in the same app rather
than a separate site, since a static host like GitHub Pages has no natural
place to split them out to. The legal pages are a content template (clearly
marked as such, with `[bracketed]` placeholders) — not reviewed legal
advice. The docs (`web/src/pages/docs/`, laid out by `DocsLayout.tsx`) are
plain hand-written TSX, not a markdown/MDX pipeline — there's exactly four
pages (iOS SDK, dashboard, CLI, MCP) plus an overview, which doesn't
justify a docs generator's build-time cost or a new content format for
this repo to keep in sync with the code by hand either way.

A host serving deep links (e.g. `/projects/abc`) directly needs SPA fallback
routing to `index.html`, since there's no server to resolve arbitrary paths
the way Next's router did.

## 6. CLI + MCP server (`cli/`)

The dashboard's prompt generation (§4) still ended with a human copying text
out of a browser tab and pasting it into a coding agent. `feedbackkit mcp`
removes that step: an agent calls `get_prompt` (or `list_feedback`,
`get_feedback`, `update_feedback_status`) directly. `feedbackkit` the CLI is
the same tool with the MCP server as one of its subcommands, so there's a
single codebase, not two.

**It authenticates as a real dashboard user, not a new credential type.**
`feedbackkit login` opens the browser to `/cli-auth` — a new route in the
same static SPA, no new backend — where, once signed in, the page hands the
CLI its *own* current Supabase session (`access_token`/`refresh_token`) via
a redirect to a local server the CLI starts for exactly this handshake
(`gh auth login`'s pattern, not a device-code flow, since GitHub OAuth via
Supabase Auth is already a browser redirect). This was a deliberate choice
over minting a separate opaque API token: a real session means RLS enforces
CLI access exactly like it enforces browser access, with **zero new
authorization logic** — `cli/src/supabaseClient.ts` has none, on purpose,
matching this project's rule that RLS does tenancy enforcement (§2), not
application code.

The OAuth `redirectTo` has to stay the one fixed, allow-listed URL (`/login`)
— it can't carry the CLI's callback port/state through the full-page
redirect to GitHub and back. Those get stashed in `sessionStorage` instead
and picked back up once `/login` sees a real session, which avoids a hosted
Supabase auth-config change for this feature entirely.

`cli_sessions` (`supabase/migrations/0007_cli_sessions.sql`) is bookkeeping,
not the auth mechanism: it's what lets a user see "CLI on my-macbook, since
Sept 19" on the dashboard and flip a `revoked_at` column. Revocation is
**cooperative**, not a cryptographic kill of the underlying session — the
CLI checks its own row before doing work and deletes its local credentials
if revoked. This mirrors a real limitation in Supabase's own admin API
(revoking a refresh token doesn't invalidate an already-issued access token
before it expires); doing better would mean persisting the CLI's raw access
token server-side, a bigger secret to hold than the problem justifies.

**`get_docs` (and `feedbackkit docs`) exist so an agent can learn the
product, not just query it.** Every other tool/command answers questions
about a specific user's *data*; this one answers "how do I add FeedbackKit
to an iOS app" from real reference content (`cli/src/docs.ts`, condensed
from the website's docs) rather than the model's training-data guess about
a library it may have never seen. It's deliberately the one tool that
doesn't call `getAuthenticatedClient()` — static local content has no
reason to require being logged in, and gating it behind auth would block
exactly the "help me get started" moment it exists for.

## 7. The closed loop: report → agent → build → reporter verifies

§4 and §6 got a report *into* a coding agent. Everything after that used to be
invisible: nobody learned whether the agent's fix worked, and the person who
reported the bug never heard back. The loop closes that gap, and it's the
product's differentiator on mobile specifically: web tools can say "fixed"
the moment a deploy lands, but a native fix only reaches a tester once a new
build is on their phone, so the natural place to confirm a fix is *on the
device, in that build*, by the person who reported it.

```
SDK report (+ reporter_id) → dashboard / MCP → agent: claim, ask, fix, after-shot
      ↑                                              ↓  PR "FeedbackKit: <id>"
reporter's device ← reporter-updates ← release ← merged (github-webhook)
  "is it fixed?"  → verified  |  still broken (new screenshot) → reopened → agent again
```

**`fix_stage` is a separate column, not new `status` values**
(`0014_closed_loop.sql`). Already-shipped Developer Portal builds decode
`status`, so adding enum values there would risk every item that used one.
`fix_stage` (agent_working → pr_open → merged → shipped → verified, plus
reopened) is a checked text column. Every transition also moves `status` to
the matching coarse value, so status-only clients still see something
sensible (verified → resolved, everything else → in_progress).

**The reporter is an anonymous, random, per-install id**, not an account.
The SDKs generate it once (UserDefaults / localStorage) and send it with
each report. The public `reporter-updates` Edge Function only returns or
modifies reports carrying that exact id, so possessing it is the
capability, the same way `project_key` is the capability to create reports.
This means the loop works for every tester with zero sign-up. The cost:
reinstalling the app starts a new identity, and old reports can no longer
reach that device. `FeedbackKit.user` is optional identity on top, for
display only; it's never used for access.

**"Shipped in a build" is a git question, answered where git lives.**
`feedbackkit release --build N` runs in the repo (from the release script).
It ships only the merged fixes whose commit is an ancestor of the release
commit, so releasing an older branch never claims fixes it doesn't contain.
It then calls `record_release` (a `security invoker` RPC, so RLS applies) to
mark them shipped atomically. The device compares its own `CFBundleVersion`
to `fixed_in_build` with `compare_builds`, which is duplicated in SQL, the
Edge Function, CLI, Swift and web SDKs: dotted numeric builds compare
numerically, and anything else only compares equal. An incomparable build
(e.g. a git SHA on the web) counts as "has the fix", because the item only
became `shipped` after a release was announced, and a static site is
replaced wholesale on deploy.

**Agents get narrow write tools, and can't declare victory.** MCP adds
`claim_feedback`, `post_update`, `ask_reporter`, `link_fix` and
`attach_after_screenshot`, all timeline writes through RLS as the logged-in
user (the `feedback_events` insert policy pins `actor_user_id = auth.uid()`
and `actor_type ∈ {user, agent}`, so no one can forge a reporter or GitHub
event). There is deliberately no "mark verified" tool: only the reporter can
verify, from their device. `get_feedback` returns screenshots as MCP image
content, including the reporter's reopen screenshot, because a signed URL
is invisible to an agent that won't fetch it.

**Dispatch uses labels and comments, not assignment.** Assigning an issue to
GitHub's Copilot/Claude/Codex agents needs a *user* token (it's billed per
user), which a GitHub App installation token isn't. A label added by the App
*does* trigger `issues.labeled` workflows (e.g. claude-code-action's
`label_trigger`), so that's the reliable path. On reopen, the label is removed
and re-added so the workflow fires again.

**The GitHub webhook verifies `X-Hub-Signature-256` and scopes every match to
the delivery's repository.** Before this it did neither, so anyone could
POST to resolve feedback, and issue #5 closing in one repo resolved #5-linked
feedback in every project. It now fails closed when `GITHUB_WEBHOOK_SECRET`
isn't set. PRs link to reports via `FeedbackKit: <id>` in the title, body or
branch name (the issue body and MCP prompt both ask for it), or via a
closing keyword for a linked issue.

**Known gaps.** `feedbackkit release` needs a `feedbackkit login` session,
so it runs from a developer's machine; CI-driven releases would need a
project-scoped release token, which doesn't exist yet. The macOS/watchOS
verification UIs and the "still broken → capture" handoff are covered by
builds and a manual simulator check (iOS), not automated UI tests.

## 8. Push-to-main delivery: agents commit, every push is a beta, the owner promotes

With coding agents doing the fixing, a pull request per fix is ceremony: the
real quality gate is the person who reported the bug confirming the fix on
their device (§7). So the default workflow is:

```
agent commit on main ("FeedbackKit: <id>" trailer) ──push──▶ github-webhook: fix_stage merged
      │
      ▼  beta.yml: tests → TestFlight (iOS Portal) + beta-portal-mac prerelease (macOS Portal)
feedbackkit_announce.sh (release token) ──▶ ci-release: shipped in build N (beta channel)
      │
      ▼  reporters on build N: "is it fixed?" → verified / reopened
owner: Releases tab says "ready" ──▶ promotes in App Store Connect ──▶ `feedbackkit promote` / "Mark as released"
```

**Commit trailers replace PR descriptions.** The webhook's `push` handler
reads `FeedbackKit: <id>` (and `Fixes #n` for a report's GitHub issue) from
each commit on the default branch; `FeedbackKit-Summary:` sets the sentence
the reporter sees. PRs still work exactly as before — this is additive.

**CI authenticates with a release token, not a session.** A CI job has no
dashboard user to act as, and minting user sessions for robots would blur
RLS's "a request is a person" model. A release token
(`0015_push_to_main_releases.sql`) is project-scoped, stored only as a
SHA-256 hash, revocable, and can do exactly three things through the
`ci-release` Edge Function: list fixes waiting to ship, record a release,
promote one. Deciding *which* fixes are in a build still happens in the CI
checkout (git ancestry), so the token never needs repository access.

**One announcement step for every pipeline.** `scripts/feedbackkit_announce.sh`
is called at the end of every release script, locally (login session) and in
CI (token), and never fails a release that already shipped. CI runs this
repo's own CLI build rather than npm's, so pipelines use the CLI they ship.

**Build numbers are UTC timestamps everywhere** (`yyyyMMddHHmm`), because fix
verification orders the build on the device against the build a fix shipped
in. This surfaced a real bug: XcodeGen had hardcoded `CFBundleVersion` 1 in
every app, so release scripts' build numbers never reached the binary, and
App Store Connect renumbered TestFlight uploads. Plists now read the build
settings and App Store exports set `manageAppVersionAndBuildNumber` false.
A TestFlight build promoted to the App Store keeps its number, so production
reporters on that build are asked too.

**Channels, not branches.** A release is `beta` until the owner marks it
`production` (the Releases tab, `feedbackkit promote`, or the token API —
e.g. from a future App Store Connect webhook). The `release_readiness` view
rolls each build's fixes into verified / awaiting / reopened, and the
dashboard turns that into a verdict: any reopened fix blocks, all verified
is "ready". For the macOS Portal, "production" is the tagged GitHub release
cut with `cut_release.sh`; betas are one rolling `beta-portal-mac`
prerelease (every release workflow ignores `beta-*` tags).

**Known gaps.** Reporters only verify what they reported, so a fix that
breaks something else isn't caught by the loop — CI tests gate every beta,
and new reports after a beta are the regression signal. Concurrent agents
pushing to main need to rebase and retry. External TestFlight groups can
still wait on Beta App Review; the internal group gets every build at once.
Demo apps ship on releases only, not betas.

## Repo layout

```
Sources/FeedbackKit/   the SDK (Swift Package, iOS + macOS + watchOS)
Tests/FeedbackKitTests/
web-sdk/               the web SDK (npm feedbackkit-web): src/, unit tests, Playwright e2e
DemoApp/               project.yml (XcodeGen) + sample apps exercising the SDK
                       on iOS, macOS, and watchOS (one project, three targets)
web/                   Static SPA dashboard (Vite + React)
supabase/              migrations, storage policies, the ingestion + billing (Stripe) Edge Functions
cli/                   feedbackkit CLI + MCP server (Node/TypeScript)
scripts/               setup.sh, run-ios.sh, start-web.sh — see README.md
```

## Known gaps / deliberate scope cuts

- **Billing is entirely dummy — no plan actually enforces anything yet.**
  `organization_billing` tracks a plan/status, and the dashboard's Billing
  page and Stripe Edge Functions are fully wired up, but nothing in the app
  actually checks `plan === 'pro'` before allowing an action — a free-plan
  org can create as many projects/feedback items as it wants today, despite
  the Billing page's copy claiming a cap. Enforcing that (probably a check
  in `ProjectsPage.tsx`'s create-project flow, or an RLS policy referencing
  `organization_billing`) is real work to do once there's an actual limit to
  enforce, not before.
- **No organization switcher.** The schema supports one user belonging to
  multiple orgs; the dashboard UI just uses the first membership found. Fine
  until someone is actually on two teams.
- **No offline queueing in the SDK.** If `presentAndSubmit` fails (no
  network), the report is just lost unless the developer's own completion
  handler does something with it. A disk-backed retry queue is the natural
  next step if the hosted path becomes the primary use case rather than
  "hand me the struct."
- **No image compression/downsizing.** Screenshots are full-resolution PNGs;
  fine for a v1, but worth revisiting (JPEG or PNG downscaling) if storage
  cost or upload time on cellular becomes a concern.
- **Rate limiting is coarse.** Ingestion caps submissions per project per
  minute (see §3), which stops a leaked key from flooding a project, but
  it's one shared bucket — a spammer can crowd out real users for that
  minute. Per-client limits would need an IP/fingerprint store, deliberately
  not built yet.
- **Web capture can't see cross-origin pixels.** DOM rendering leaves
  cross-origin iframes, CORS-less images and non-preserved WebGL canvases
  blank (§1b); `mode: "display"` is the escape hatch, at the cost of a
  prompt. There's also no session replay — a web report is a moment, not a
  recording — by design, for privacy and payload size.
- **Local Supabase requires Docker**, which this environment didn't have
  installed — see README.md for the one manual prerequisite.
- **`feedbackkit login` needs a browser reachable from wherever the CLI
  runs.** Fine for a developer's own laptop; breaks over SSH or in CI. A
  device-code-style fallback (enter a code shown in the terminal on any
  browser, `gh auth login`'s non-`--web` path) is the natural v2 addition,
  deliberately deferred rather than building both flows at once.
- **A CLI session isn't scoped to one project.** It gets exactly what the
  signed-in user's browser session would — every project across every
  organization they belong to — since it's the same session, not a
  narrower credential. Fine while "the CLI user" and "the dashboard user"
  are the same person; would need real thought before, say, handing a CLI
  session to a CI job.
- **Neither platform's UI layer has automated tests** — `Tests/FeedbackKitTests/`
  only covers the shared model/geometry code (`AnnotationRenderer`,
  `FeedbackReport`). The macOS port was verified with real, running
  `NSApplication` smoke runs (presenting the sheet, clicking through to
  submit, inspecting the resulting `FeedbackReport`) rather than an
  automated XCTest UI suite; the iOS side has never had one either. Worth
  a proper UI test target on both sides before this SDK has many more
  contributors than just its original author.
- **A watchOS report's `screenshotRawPNG`/`screenshotAnnotatedPNG` are still
  a generated placeholder card, not a real screenshot or `nil`** — see §1's
  watchOS section. The fields did eventually become genuinely optional
  (`Data?`) end to end once iOS/macOS grew their own screenshot toggle, but
  watchOS itself was left unchanged: there's no user-facing toggle there
  (no window-level capture API to make a real screenshot worth toggling in
  the first place), so it still always produces the placeholder rather than
  `nil`. Worth revisiting only if that placeholder card itself becomes a
  problem (e.g. someone builds dashboard logic that assumes a non-nil
  screenshot path means "there's something worth looking at").
