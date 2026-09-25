-- Web SDK support (web-sdk/, npm `feedbackkit-web`).
--
-- 1. `feedback_items.logs`: recent console warnings/errors, uncaught
--    exceptions and failed network requests captured by the browser SDK —
--    context native reports don't have. Opaque camelCase JSONB like
--    `environment`/`annotations` (array of {level, message, timestamp}),
--    read directly by the dashboard/CLI. Always '[]' for native reports.
--
-- 2. `feedback_items.received_at`: server-side arrival time. `created_at` is
--    set by the client (it's when the user captured the report, which is what
--    triage wants to sort by), so it can't be trusted for rate limiting.
--
-- 3. `projects.allowed_origins`: an optional allowlist of web origins
--    (e.g. `https://app.example.com`) allowed to submit with this project's
--    key. A project key is public by design, but on the web it's trivially
--    readable in page source and CORS is `*`, so any site could otherwise
--    embed someone else's key. Empty (the default) = allow every origin,
--    which keeps existing projects unaffected. Requests without an `Origin`
--    header (native apps, curl) are never blocked by this — it stops other
--    *websites*, not a determined script; rate limiting covers that.

alter table feedback_items
  add column if not exists logs jsonb not null default '[]'::jsonb,
  add column if not exists received_at timestamptz not null default now();

create index if not exists feedback_items_project_received_idx
  on feedback_items (project_id, received_at desc);

alter table projects
  add column if not exists allowed_origins text[] not null default '{}'::text[];
