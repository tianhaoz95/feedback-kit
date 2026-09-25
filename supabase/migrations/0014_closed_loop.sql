-- Closed loop: report → agent fix → shipped build → reporter verifies on device.
--
-- 1. `feedback_items.fix_stage` — where the fix for this report is in the
--    agent/release loop, *separate* from the triage `status` enum on purpose:
--    `status` (new/in_progress/resolved/wont_fix) is decoded by strict enums
--    in already-shipped Developer Portal builds, so adding values to it would
--    break every item that used one. `fix_stage` is a plain checked text
--    column (null = nothing has happened yet), and every transition that
--    changes it also moves `status` to the matching coarse value, so clients
--    that only know `status` still see something sensible:
--
--      agent_working, pr_open, merged → status in_progress
--      shipped                        → status in_progress (not proven yet)
--      verified                       → status resolved
--      reopened                       → status in_progress
--
-- 2. Fix bookkeeping: the PR/commit that fixed it and the build it shipped in.
--    `fixed_in_build` is compared against the reporter's own build on device
--    (see `compare_builds` below) to decide when to ask "is it fixed?".
--
-- 3. Reporter identity: `reporter_id` is an opaque, random per-install id the
--    SDKs generate and persist (not a user account). It's what lets the public
--    `reporter-updates` Edge Function show a report's fix back to the one
--    device/browser that filed it — knowing it is the capability, the same way
--    `project_key` is the capability to create reports. `reporter` holds the
--    optional host-app-supplied identity (`FeedbackKit.setUser`), opaque
--    camelCase JSONB like `environment`.
--
-- 4. `feedback_events` — the per-report timeline shared by the dashboard,
--    the Portal, the CLI/MCP (agents) and, for rows with
--    `visible_to_reporter`, the reporter's own device.
--
-- 5. `releases` — one row per build announced with `feedbackkit release`.

alter table feedback_items
  add column if not exists fix_stage text
    check (fix_stage in ('agent_working', 'pr_open', 'merged', 'shipped', 'verified', 'reopened')),
  add column if not exists fix_pr_url text,
  add column if not exists fix_pr_number integer,
  add column if not exists fix_commit_sha text,
  add column if not exists fix_summary text,
  add column if not exists fixed_in_build text,
  add column if not exists shipped_at timestamptz,
  add column if not exists verified_at timestamptz,
  add column if not exists reopen_count integer not null default 0,
  add column if not exists reporter_id text,
  add column if not exists reporter jsonb;

create index if not exists feedback_items_project_reporter_idx
  on feedback_items (project_id, reporter_id)
  where reporter_id is not null;

create index if not exists feedback_items_project_fix_stage_idx
  on feedback_items (project_id, fix_stage);

create table if not exists feedback_events (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references feedback_items(id) on delete cascade,
  -- Denormalized so the RLS policy doesn't need a join through feedback_items.
  project_id uuid not null references projects(id) on delete cascade,
  kind text not null check (kind in (
    'comment',        -- free-form note (internal, or to the reporter if visible_to_reporter)
    'question',       -- a question for the reporter; always visible_to_reporter
    'reporter_reply', -- the reporter's answer / extra detail, from their device
    'claimed',        -- an agent/dev started working on it
    'dispatched',     -- handed to a coding agent (e.g. GitHub issue + trigger)
    'pr_opened',
    'pr_merged',
    'pr_closed',
    'shipped',        -- included in a build announced via `feedbackkit release`
    'verified',       -- the reporter confirmed the fix on their device
    'reopened',       -- the reporter says it's still broken (may carry a new screenshot)
    'status_changed',
    'after_screenshot' -- an agent's post-fix screenshot (e.g. from the simulator)
  )),
  actor_type text not null check (actor_type in ('user', 'agent', 'reporter', 'system', 'github')),
  -- The dashboard user behind the action, when there is one (users and
  -- agents acting through a logged-in CLI session). Null for reporter/system/github.
  actor_user_id uuid references auth.users(id) on delete set null,
  -- Human-readable "who", e.g. "Claude Code", "GitHub", "Reporter".
  actor_label text,
  body text,
  -- Kind-specific details (pr_url, build, screenshot_path, …). camelCase-free on
  -- purpose: it's snake_case like the rest of the row, read by TS and Swift alike.
  data jsonb not null default '{}'::jsonb,
  visible_to_reporter boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists feedback_events_feedback_idx on feedback_events (feedback_id, created_at);
create index if not exists feedback_events_project_idx on feedback_events (project_id, created_at desc);

alter table feedback_events enable row level security;

create policy "members can read events in their orgs"
  on feedback_events for select
  using (
    project_id in (
      select id from projects where organization_id in (select auth_organization_ids())
    )
  );

-- Members (and agents acting as them via the CLI) can add events, but only as
-- themselves: the actor must be the caller and the actor_type user/agent.
-- Reporter/system/github events are written by Edge Functions with the
-- service-role key, which bypasses RLS.
create policy "members can add events in their orgs"
  on feedback_events for insert
  with check (
    project_id in (
      select id from projects where organization_id in (select auth_organization_ids())
    )
    and actor_type in ('user', 'agent')
    and actor_user_id = auth.uid()
    -- An event must belong to a feedback item in the same project.
    and exists (
      select 1 from feedback_items f where f.id = feedback_id and f.project_id = feedback_events.project_id
    )
  );

-- The timeline is an audit trail — no update/delete policy for members.
-- Deleting the feedback item (or project) still cascades.

create table if not exists releases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  build text not null,
  version text,
  commit_sha text,
  -- Optional product scope (products.key); null = the whole project.
  product_key text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists releases_project_idx on releases (project_id, created_at desc);

alter table releases enable row level security;

create policy "members can manage releases in their orgs"
  on releases for all
  using (
    project_id in (
      select id from projects where organization_id in (select auth_organization_ids())
    )
  )
  with check (
    project_id in (
      select id from projects where organization_id in (select auth_organization_ids())
    )
  );

-- Coding-agent dispatch settings for GitHub issues created from the dashboard.
-- Labels are the robust trigger (a label added by a GitHub App installation
-- *does* trigger Actions workflows, e.g. claude-code-action's `label_trigger`);
-- the comment is for mention-triggered agents (`@claude`, `@codex`, …).
alter table projects
  add column if not exists dispatch_labels text[] not null default '{}'::text[],
  add column if not exists dispatch_comment text;

-- Agents (via the CLI/MCP) upload post-fix screenshots under
-- `{project_id}/{feedback_id}/after/…`. Same first-segment scoping as the read
-- policy in 0002_storage.sql.
create policy "members can upload to their org's screenshots"
  on storage.objects for insert
  with check (
    bucket_id = 'feedback-screenshots'
    and try_cast_uuid((storage.foldername(name))[1]) in (
      select id from projects where organization_id in (select auth_organization_ids())
    )
  );

-- Build ordering, shared by SQL and mirrored in every SDK (keep in sync:
-- Sources/FeedbackKit/Model/FixUpdate.swift `FeedbackBuild.compare`,
-- web-sdk/src/fixes.ts `compareBuilds`, supabase/functions/_shared/builds.ts).
-- Dotted numeric builds ("42", "1.2.10", the timestamp builds
-- scripts/release_testflight.sh produces) compare numerically segment by
-- segment; anything else only compares equal/unequal (null = unknown).
create or replace function compare_builds(a text, b text)
returns integer
language plpgsql
immutable
as $$
declare
  pa text[];
  pb text[];
  i integer;
  na numeric;
  nb numeric;
begin
  if a is null or b is null then
    return null;
  end if;
  if a = b then
    return 0;
  end if;
  if a !~ '^[0-9]+(\.[0-9]+)*$' or b !~ '^[0-9]+(\.[0-9]+)*$' then
    return null;
  end if;
  pa := string_to_array(a, '.');
  pb := string_to_array(b, '.');
  for i in 1..greatest(array_length(pa, 1), array_length(pb, 1)) loop
    na := coalesce(pa[i], '0')::numeric;
    nb := coalesce(pb[i], '0')::numeric;
    if na < nb then return -1; end if;
    if na > nb then return 1; end if;
  end loop;
  return 0;
end;
$$;

-- Marks fixes as shipped in a build, atomically, as the calling user (RLS
-- applies — `security invoker`). The CLI decides *which* items are in the
-- build (it has the git history to check commit ancestry) and passes their
-- ids; this records the release, moves each item to `shipped`, and writes
-- one `shipped` timeline event per item, visible to the reporter.
create or replace function record_release(
  p_project_id uuid,
  p_build text,
  p_version text,
  p_commit_sha text,
  p_product_key text,
  p_feedback_ids uuid[],
  p_actor_label text default 'feedbackkit release'
)
returns setof uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_release_id uuid;
begin
  insert into releases (project_id, build, version, commit_sha, product_key, created_by)
    values (p_project_id, p_build, p_version, p_commit_sha, p_product_key, auth.uid())
    returning id into v_release_id;

  return query
  with shipped as (
    update feedback_items f
      set fix_stage = 'shipped',
          fixed_in_build = p_build,
          shipped_at = now(),
          status = case when f.status in ('resolved', 'wont_fix') then f.status else 'in_progress' end
      where f.project_id = p_project_id
        and f.id = any(p_feedback_ids)
        and f.fix_stage is distinct from 'verified'
      returning f.id
  ), events as (
    insert into feedback_events (feedback_id, project_id, kind, actor_type, actor_user_id, actor_label, body, data, visible_to_reporter)
      select s.id, p_project_id, 'shipped', 'user', auth.uid(), p_actor_label,
             'Fixed in build ' || p_build || coalesce(' (' || p_version || ')', ''),
             jsonb_build_object('build', p_build, 'version', p_version, 'commit_sha', p_commit_sha, 'release_id', v_release_id),
             true
        from shipped s
      returning feedback_id
  )
  select feedback_id from events;
end;
$$;
