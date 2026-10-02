-- Two self-serve plans for solo developers and small teams, replacing the
-- per-seat Team plan (0016) and the Free limits in 0019:
--
--   Free   1 project, 1 member, 50 readable reports a month. Reports past
--          that are still stored but *locked* (hidden by RLS) until the
--          organization upgrades, instead of being refused with a 402, so a
--          reporter's feedback is never lost. Screenshots and attachments
--          are deleted after 90 days (cleanup-previews, daily).
--   Indie  Flat $9/month or $79/year: unlimited projects and reports, up to
--          3 members, a 25 GB fair-use storage cap (past it, new reports
--          keep their text but not their media).
--   Larger teams are priced case by case: `plan = 'team'` (or the legacy
--   'pro') set by hand / by a custom Stripe price, or `limits_exempt`, and
--   are unlimited.
--
-- Every new organization starts with a 14-day Indie trial
-- (`trial_ends_at`) and drops to Free afterwards.
--
-- The numbers live in plan_limit(plan, name) and are mirrored by hand in
-- web/src/lib/pricing.ts (FREE_LIMITS / INDIE_LIMITS), the terms page and
-- the Portal's TeamView.

alter type billing_plan add value if not exists 'indie';

alter table organization_billing
  add column if not exists trial_ends_at timestamptz;
-- New organizations only; existing ones keep whatever plan they're on.
alter table organization_billing
  alter column trial_ends_at set default now() + interval '14 days';

alter table feedback_items
  add column if not exists locked boolean not null default false,
  -- Set when the Free plan's retention deleted this report's screenshots and attachment.
  add column if not exists media_expired_at timestamptz;

create index if not exists feedback_items_locked_idx on feedback_items (project_id) where locked;

-- ------------------------------------------------------------------ plans

-- The plan an organization's limits come from: 'free', 'indie' (paid or in
-- its trial) or 'unlimited' (team/pro/exempt). Only `plan`, not `status`,
-- decides, as before: stripe-webhook moves `plan` back to 'free' when a
-- subscription ends.
create or replace function organization_plan(p_org_id uuid)
returns text
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v organization_billing;
begin
  select * into v from organization_billing where organization_id = p_org_id;
  if v.organization_id is null then
    return 'free';
  end if;
  if v.limits_exempt or v.plan::text in ('team', 'pro') then
    return 'unlimited';
  end if;
  if v.plan::text = 'indie' or (v.trial_ends_at is not null and v.trial_ends_at > now()) then
    return 'indie';
  end if;
  return 'free';
end;
$$;

-- null = unlimited.
create or replace function plan_limit(p_plan text, p_name text)
returns integer
language sql
immutable
as $$
  select case p_plan
    when 'free' then case p_name
      when 'projects' then 1
      when 'members' then 1
      when 'reports_per_month' then 50
      when 'retention_days' then 90
    end
    when 'indie' then case p_name
      when 'members' then 3
      when 'storage_mb' then 25600
    end
  end;
$$;

-- 0019's one-argument form, kept for anything still calling it: the Free numbers.
create or replace function plan_limit(p_name text)
returns integer
language sql
immutable
as $$
  select plan_limit('free', p_name);
$$;

create or replace function organization_limit(p_org_id uuid, p_name text)
returns integer
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  return plan_limit(organization_plan(p_org_id), p_name);
end;
$$;

create or replace function organization_is_limited(p_org_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  return organization_plan(p_org_id) = 'free';
end;
$$;

-- Bytes the organization's reports occupy in the feedback-screenshots bucket.
create or replace function organization_storage_bytes(p_org_id uuid)
returns bigint
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  return (
    select coalesce(sum((o.metadata ->> 'size')::bigint), 0)
    from storage.objects o
    where o.bucket_id = 'feedback-screenshots'
      and try_cast_uuid((storage.foldername(o.name))[1]) in (select id from projects where organization_id = p_org_id)
  );
end;
$$;

-- ------------------------------------------------------------------ limits

create or replace function enforce_project_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := organization_limit(new.organization_id, 'projects');
begin
  if v_limit is not null
     and (select count(*) from projects where organization_id = new.organization_id) >= v_limit then
    raise exception 'The Free plan includes % project. Upgrade to Indie for unlimited projects.', v_limit
      using errcode = 'P0001', hint = 'plan_limit_projects';
  end if;
  return new;
end;
$$;

create or replace function member_limit_message(p_org_id uuid, p_limit integer)
returns text
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if organization_plan(p_org_id) = 'free' then
    return 'The Free plan is for one person. Upgrade to Indie to work with up to '
      || plan_limit('indie', 'members') || ' members.';
  end if;
  return 'The Indie plan includes ' || p_limit || ' members. For a larger team, email info@hejitechllc.com.';
end;
$$;

create or replace function enforce_member_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := organization_limit(new.organization_id, 'members');
begin
  if v_limit is not null
     and (select count(*) from memberships where organization_id = new.organization_id) >= v_limit then
    raise exception '%', member_limit_message(new.organization_id, v_limit)
      using errcode = 'P0001', hint = 'plan_limit_members';
  end if;
  return new;
end;
$$;

create or replace function enforce_invitation_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := organization_limit(new.organization_id, 'members');
begin
  if v_limit is not null
     and (select count(*) from memberships where organization_id = new.organization_id)
       + (select count(*) from organization_invitations
          where organization_id = new.organization_id and accepted_at is null and revoked_at is null and expires_at > now())
       >= v_limit then
    raise exception '%', member_limit_message(new.organization_id, v_limit)
      using errcode = 'P0001', hint = 'plan_limit_members';
  end if;
  return new;
end;
$$;

-- What ingest-feedback does with a new report: `locked` once a Free
-- organization has used this month's reports, `store_media` false once an
-- organization is past its storage cap.
create or replace function report_admission(p_project_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_org uuid;
  v_reports integer;
  v_storage_mb integer;
begin
  select organization_id into v_org from projects where id = p_project_id;
  if v_org is null then
    return jsonb_build_object('locked', false, 'store_media', true);
  end if;
  v_reports := organization_limit(v_org, 'reports_per_month');
  v_storage_mb := organization_limit(v_org, 'storage_mb');
  return jsonb_build_object(
    'locked', v_reports is not null and organization_reports_this_month(v_org) >= v_reports,
    'store_media', v_storage_mb is null or organization_storage_bytes(v_org) < v_storage_mb::bigint * 1024 * 1024
  );
end;
$$;

revoke execute on function report_admission(uuid) from public, anon, authenticated;
grant execute on function report_admission(uuid) to service_role;

-- 0019's check. Reports aren't refused any more (they're locked instead),
-- so an ingest-feedback deploy older than this migration accepts everything.
create or replace function project_accepts_report(p_project_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  return true;
end;
$$;

-- ------------------------------------------------------------------ locked reports

-- Restrictive, so it applies on top of every permissive policy: members and
-- access tokens alike can't read a locked report. Service-role functions
-- (ingest, reporter-updates) still can.
drop policy if exists "locked reports are hidden" on feedback_items;
create policy "locked reports are hidden"
  on feedback_items as restrictive for select
  using (not locked);

-- Upgrading (or being exempted) unlocks everything the organization has.
create or replace function unlock_reports_on_upgrade()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if organization_plan(new.organization_id) <> 'free' then
    update feedback_items set locked = false
    where locked and project_id in (select id from projects where organization_id = new.organization_id);
  end if;
  return new;
end;
$$;

drop trigger if exists unlock_reports_on_upgrade on organization_billing;
create trigger unlock_reports_on_upgrade
  after update of plan, limits_exempt, trial_ends_at on organization_billing
  for each row execute function unlock_reports_on_upgrade();

-- A locked report's notification says that it arrived, not what it says.
create or replace function notify_new_feedback()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project projects;
begin
  select * into v_project from projects where id = new.project_id;
  if v_project.id is null then
    return new;
  end if;
  if new.locked then
    perform notify_org_members(
      v_project.organization_id, v_project.id, null, 'new_feedback',
      'Locked report in ' || v_project.name,
      'This month''s ' || plan_limit('free', 'reports_per_month') || ' Free reports are used. Upgrade to Indie to read it.'
    );
    return new;
  end if;
  perform notify_org_members(
    v_project.organization_id, v_project.id, new.id, 'new_feedback',
    'New feedback in ' || v_project.name,
    feedback_snippet(new.text)
  );
  return new;
end;
$$;

-- ------------------------------------------------------------------ retention

-- Free organizations' screenshots and attachments older than the retention
-- window. cleanup-previews deletes the files and clears the paths.
create or replace function free_media_to_expire(p_limit integer default 200)
returns table (feedback_id uuid, paths text[])
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
  select f.id,
         array_remove(array[f.screenshot_raw_path, f.screenshot_annotated_path, f.attachment_path], null)
  from feedback_items f
  join projects p on p.id = f.project_id
  where f.media_expired_at is null
    and (f.screenshot_raw_path is not null or f.screenshot_annotated_path is not null or f.attachment_path is not null)
    and f.received_at < now() - make_interval(days => plan_limit('free', 'retention_days'))
    and organization_plan(p.organization_id) = 'free'
  order by f.received_at
  limit p_limit;
end;
$$;

revoke all on function free_media_to_expire(integer) from public, anon, authenticated;
grant execute on function free_media_to_expire(integer) to service_role;

-- ------------------------------------------------------------------ usage

create or replace function organization_usage(p_org_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_plan text;
begin
  if p_org_id not in (select auth_organization_ids()) then
    raise exception 'not a member of this organization' using errcode = '42501';
  end if;
  v_plan := organization_plan(p_org_id);
  return jsonb_build_object(
    'plan', v_plan,
    'limited', v_plan = 'free',
    'trial_ends_at', (select trial_ends_at from organization_billing where organization_id = p_org_id),
    'reports_this_month', organization_reports_this_month(p_org_id),
    'locked_reports', (
      select count(*) from feedback_items f join projects p on p.id = f.project_id
      where p.organization_id = p_org_id and f.locked
    ),
    'projects', (select count(*) from projects where organization_id = p_org_id),
    'members', (select count(*) from memberships where organization_id = p_org_id),
    'storage_bytes', organization_storage_bytes(p_org_id),
    'limits', jsonb_build_object(
      'projects', plan_limit(v_plan, 'projects'),
      'members', plan_limit(v_plan, 'members'),
      'reports_per_month', plan_limit(v_plan, 'reports_per_month'),
      'storage_mb', plan_limit(v_plan, 'storage_mb'),
      'retention_days', plan_limit(v_plan, 'retention_days')
    )
  );
end;
$$;

grant execute on function organization_usage(uuid) to authenticated;
