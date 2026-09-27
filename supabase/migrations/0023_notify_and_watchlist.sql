-- 1. "Notify me when it's fixed" — the reporter's choice, made in the SDK
--    composer's attach menu and off by default (Sources/FeedbackKit/UI,
--    web-sdk/src/ui/widget.ts). reporter-updates only shows fix updates and
--    questions to reporters who opted in. Null = a report from an SDK
--    released before the option, which keeps the old behavior (asked).
--
-- 2. Watchlist: any member can watch a report and hear about every step of
--    its fix — not just the org-wide highlights 0017 notifies everyone
--    about — through the same notifications table (so push reaches the
--    iOS Portal too).

alter table feedback_items add column if not exists notify_reporter boolean;

-- A reporter who didn't opt in can't be asked, so their shipped fix no
-- longer counts as "awaiting" (which kept a build from ever being ready).
create or replace view release_readiness
with (security_invoker = true)
as
select
  r.id as release_id,
  r.project_id,
  r.build,
  r.version,
  r.commit_sha,
  r.product_key,
  r.channel,
  r.source,
  r.created_at,
  r.promoted_at,
  count(f.id) as fixes,
  count(f.id) filter (where f.fix_stage = 'verified') as verified,
  count(f.id) filter (where f.fix_stage = 'reopened') as reopened,
  count(f.id) filter (where f.fix_stage = 'shipped' and f.reporter_id is not null and f.notify_reporter is distinct from false) as awaiting,
  count(f.id) filter (where f.fix_stage = 'shipped' and (f.reporter_id is null or f.notify_reporter = false)) as unreachable
from releases r
left join feedback_items f
  on f.project_id = r.project_id and f.fixed_in_build = r.build
  and (r.product_key is null or f.product_keys = '{}' or r.product_key = any(f.product_keys))
group by r.id;

-- ------------------------------------------------------------------ watchlist

create table if not exists feedback_watchers (
  feedback_id uuid not null references feedback_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (feedback_id, user_id)
);

create index if not exists feedback_watchers_user_idx on feedback_watchers (user_id, created_at desc);

alter table feedback_watchers enable row level security;

-- Your own watches, on reports you can see (feedback_items' RLS scopes the
-- subquery to your organizations).
create policy "members manage their own watches"
  on feedback_watchers for all
  using (user_id = auth.uid() and exists (select 1 from feedback_items f where f.id = feedback_id))
  with check (user_id = auth.uid() and exists (select 1 from feedback_items f where f.id = feedback_id));

alter table notifications drop constraint if exists notifications_kind_check;
alter table notifications add constraint notifications_kind_check check (kind in (
  'new_feedback', 'reporter_reply', 'reopened', 'verified', 'fix_merged', 'member_joined', 'watched_update'
));

-- Tells a report's watchers about an event the organization isn't notified
-- about (claimed, PR opened, shipped, notes, questions, …). Never the person
-- who caused it, only people still in the organization, and not if they
-- muted 'watched_update'.
create or replace function notify_watchers(e feedback_events)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_project projects;
  v_text text;
begin
  v_title := case e.kind
    when 'claimed' then 'An agent started working on it'
    when 'dispatched' then 'Sent to a coding agent'
    when 'pr_opened' then 'Pull request opened'
    when 'pr_closed' then 'Pull request closed'
    when 'shipped' then 'Fix shipped' || coalesce(' in build ' || (e.data->>'build'), '')
    when 'question' then 'Question sent to the reporter'
    when 'comment' then 'New note'
    when 'after_screenshot' then 'After-fix screenshot added'
    when 'status_changed' then 'Status changed'
    when 'promoted' then 'Released to production'
    else null
  end;
  if v_title is null then
    return;
  end if;

  select * into v_project from projects where id = e.project_id;
  select text into v_text from feedback_items where id = e.feedback_id;
  if v_project.id is null then
    return;
  end if;

  insert into notifications (user_id, organization_id, project_id, feedback_id, kind, title, body, data)
  select w.user_id, v_project.organization_id, v_project.id, e.feedback_id, 'watched_update',
         v_title || ' · ' || v_project.name,
         case when e.kind in ('comment', 'question') and coalesce(trim(e.body), '') <> '' then feedback_snippet(e.body)
              else feedback_snippet(v_text) end,
         jsonb_build_object('event_kind', e.kind)
  from feedback_watchers w
  join memberships m on m.user_id = w.user_id and m.organization_id = v_project.organization_id
  left join notification_preferences np on np.user_id = w.user_id
  where w.feedback_id = e.feedback_id
    and (e.actor_user_id is null or w.user_id <> e.actor_user_id)
    and not ('watched_update' = any (coalesce(np.muted_kinds, '{}')));
end;
$$;

revoke all on function notify_watchers(feedback_events) from public;

-- Same trigger function as 0022, now also fanning out to watchers.
create or replace function notify_feedback_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text;
  v_title text;
  v_project projects;
  v_text text;
  v_body text;
begin
  case new.kind
    when 'reporter_reply' then v_kind := 'reporter_reply'; v_title := 'The reporter replied';
    when 'reopened' then v_kind := 'reopened'; v_title := 'Reporter says it''s still broken';
    when 'verified' then
      v_kind := 'verified';
      -- A teammate's "Mark verified" (FixLoopPanel) isn't the reporter's word.
      v_title := case when new.actor_type = 'reporter' then 'Reporter confirmed the fix' else 'Fix marked verified' end;
    when 'pr_merged' then v_kind := 'fix_merged'; v_title := 'Fix merged';
    when 'fix_committed' then v_kind := 'fix_merged'; v_title := 'Fix committed';
    else
      -- Not worth notifying the whole organization about, but people
      -- watching this report want every step (see notify_watchers below).
      perform notify_watchers(new);
      return new;
  end case;

  select * into v_project from projects where id = new.project_id;
  select text into v_text from feedback_items where id = new.feedback_id;
  if v_project.id is null then
    return new;
  end if;

  v_body := case
    when new.kind = 'reporter_reply' and coalesce(trim(new.body), '') <> '' then feedback_snippet(new.body)
    else feedback_snippet(v_text)
  end;

  perform notify_org_members(
    v_project.organization_id, v_project.id, new.feedback_id, v_kind,
    v_title || ' · ' || v_project.name,
    v_body,
    new.actor_user_id
  );
  return new;
end;
$$;
