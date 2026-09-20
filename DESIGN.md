# FeedbackKit — Design Overview

FeedbackKit is three things that share one contract:

1. **An iOS SDK** (`FeedbackKit`, Swift Package) that lets any app capture a
   screenshot, let the user annotate it and describe a problem, and hands the
   developer a structured `FeedbackReport`. What happens to that report is
   entirely up to the developer.
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

## 1. iOS SDK (`Sources/FeedbackKit`)

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

## 2. Data model / multi-tenancy (`supabase/migrations`)

```
organizations ──< memberships >── auth.users     (an org = a developer account;
     │                                             memberships is many-to-many,
     ▼                                             so teams work from day one)
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

The landing page (`/`), privacy notice (`/privacy`), and user agreement
(`/terms`) are public routes in the same app rather than a separate site,
since a static host like GitHub Pages has no natural place to split them out
to. The legal pages are a content template (clearly marked as such, with
`[bracketed]` placeholders) — not reviewed legal advice.

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

## Repo layout

```
Sources/FeedbackKit/   the SDK (Swift Package)
Tests/FeedbackKitTests/
DemoApp/               project.yml (XcodeGen) + a sample app exercising the SDK
web/                   Static SPA dashboard (Vite + React)
supabase/              migrations, storage policies, the ingestion Edge Function
cli/                   feedbackkit CLI + MCP server (Node/TypeScript)
scripts/               setup.sh, run-ios.sh, start-web.sh — see README.md
```

## Known gaps / deliberate scope cuts

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
- **No rate limiting on the ingestion endpoint.** A leaked `project_key`
  could be used to spam a project with junk feedback. Not a data-privacy
  issue (it can't read anything), but worth adding before this is used by
  real strangers' apps at scale.
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
