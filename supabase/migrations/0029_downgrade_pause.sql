-- What a downgrade (or the end of the Indie trial) does to an organization
-- that grew past the Free limits while it was on Indie. Nothing is deleted
-- or taken away; the extras are *paused* until it upgrades again, so a
-- downgraded organization gets what any Free organization gets
-- (DESIGN.md §11):
--
--   Projects  One stays active: `organization_billing.active_project_id`,
--             picked by an owner on Billing (set_active_project), or else
--             the oldest. The rest are paused: their history stays
--             readable, their SDKs keep sending, but new reports arrive
--             locked (report_admission) and don't use up the active
--             project's 50 a month.
--   Members   The first owner keeps full access; everyone past the plan's
--             member limit is read-only (restrictive RLS on the tables
--             members write) until an upgrade or the owner removes them.
--   Media     Free retention (90 days, 0028) counts from whichever is later:
--             the report's arrival or the moment the organization became
--             Free (`free_since`, or a trial's end), so a downgrade never
--             strips an old customer's screenshots overnight.
--
-- Upgrading lifts all of it at once: plan limits go away, and
-- unlock_reports_on_upgrade (0028) unlocks every locked report.

alter table organization_billing
  add column if not exists active_project_id uuid references projects(id) on delete set null,
  -- When the organization last moved from a paid or exempt plan to Free.
  add column if not exists free_since timestamptz;

-- ------------------------------------------------------------------ free_since

create or replace function stamp_free_since()
returns trigger
language plpgsql
as $$
begin
  if (old.plan::text <> 'free' or old.limits_exempt)
     and new.plan::text = 'free' and not new.limits_exempt then
    new.free_since := now();
  end if;
  return new;
end;
$$;

drop trigger if exists stamp_free_since on organization_billing;
create trigger stamp_free_since
  before update of plan, limits_exempt on organization_billing
  for each row execute function stamp_free_since();

-- When the organization's current stretch on Free began, or null if it has
-- always been on Free (no grace needed: nothing was kept longer before).
create or replace function organization_free_since(p_org_id uuid)
returns timestamptz
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v organization_billing;
begin
  select * into v from organization_billing where organization_id = p_org_id;
  return greatest(v.free_since, case when v.trial_ends_at <= now() then v.trial_ends_at end);
end;
$$;

-- ------------------------------------------------------------------ paused projects

-- The organization's projects past its plan's project limit: everything but
-- the active project (or the oldest), on Free. Empty on any other plan.
create or replace function organization_paused_project_ids(p_org_id uuid)
returns uuid[]
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_limit integer := organization_limit(p_org_id, 'projects');
  v_active uuid;
begin
  if v_limit is null then
    return '{}';
  end if;
  select active_project_id into v_active from organization_billing where organization_id = p_org_id;
  return coalesce((
    select array_agg(id) from (
      select id, row_number() over (order by (id = v_active) desc nulls last, created_at, id) as rank
      from projects where organization_id = p_org_id
    ) ranked
    where rank > v_limit
  ), '{}');
end;
$$;

create or replace function project_is_paused(p_project_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_org uuid;
begin
  select organization_id into v_org from projects where id = p_project_id;
  return v_org is not null and p_project_id = any (organization_paused_project_ids(v_org));
end;
$$;

-- Owners choose which project stays active on Free.
create or replace function set_active_project(p_org_id uuid, p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_org_owner(p_org_id) then
    raise exception 'only an owner can choose the active project' using errcode = '42501';
  end if;
  if not exists (select 1 from projects where id = p_project_id and organization_id = p_org_id) then
    raise exception 'that project is not in this organization' using errcode = '22023';
  end if;
  update organization_billing set active_project_id = p_project_id where organization_id = p_org_id;
end;
$$;

grant execute on function set_active_project(uuid, uuid) to authenticated;

-- Only readable reports count toward the month's limit: reports locked
-- because their project is paused mustn't use up the active project's.
create or replace function organization_reports_this_month(p_org_id uuid)
returns integer
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  return (
    select count(*)::integer
    from feedback_items f
    join projects p on p.id = f.project_id
    where p.organization_id = p_org_id
      and not f.locked
      and f.received_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc'
  );
end;
$$;

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
  v_paused boolean;
begin
  select organization_id into v_org from projects where id = p_project_id;
  if v_org is null then
    return jsonb_build_object('locked', false, 'store_media', true, 'paused', false);
  end if;
  v_reports := organization_limit(v_org, 'reports_per_month');
  v_storage_mb := organization_limit(v_org, 'storage_mb');
  v_paused := project_is_paused(p_project_id);
  return jsonb_build_object(
    'locked', v_paused or (v_reports is not null and organization_reports_this_month(v_org) >= v_reports),
    'paused', v_paused,
    'store_media', v_storage_mb is null or organization_storage_bytes(v_org) < v_storage_mb::bigint * 1024 * 1024
  );
end;
$$;

revoke execute on function report_admission(uuid) from public, anon, authenticated;
grant execute on function report_admission(uuid) to service_role;

-- ------------------------------------------------------------------ read-only members

-- Whether a member may change things: everyone on an unlimited plan; on a
-- limited one, the first members up to the limit, owners first, then by
-- when they joined. PL/pgSQL + SECURITY DEFINER because it reads
-- memberships (see 0004/0005).
create or replace function member_can_write(p_org_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_limit integer := organization_limit(p_org_id, 'members');
begin
  if v_limit is null then
    return true;
  end if;
  return auth.uid() in (
    select user_id from memberships
    where organization_id = p_org_id
    order by (role = 'owner') desc, created_at, user_id
    limit v_limit
  );
end;
$$;

create or replace function member_can_write_project(p_project_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  return member_can_write((select organization_id from projects where id = p_project_id));
end;
$$;

grant execute on function member_can_write(uuid) to authenticated;

-- Restrictive, authenticated only: they narrow the members' existing write
-- policies and leave reads, access tokens (anon) and the service role alone.
do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('projects', 'member_can_write(organization_id)'),
      ('feedback_items', 'member_can_write_project(project_id)'),
      ('feedback_events', 'member_can_write_project(project_id)'),
      ('products', 'member_can_write_project(project_id)'),
      ('prompt_templates', 'member_can_write_project(project_id)'),
      ('releases', 'member_can_write_project(project_id)'),
      ('access_tokens', 'member_can_write_project(project_id)')
    ) as v(tbl, expr)
  loop
    execute format('drop policy if exists "read-only members can''t insert" on %I', t.tbl);
    execute format('drop policy if exists "read-only members can''t update" on %I', t.tbl);
    execute format('drop policy if exists "read-only members can''t delete" on %I', t.tbl);
    execute format('create policy "read-only members can''t insert" on %I as restrictive for insert to authenticated with check (%s)', t.tbl, t.expr);
    execute format('create policy "read-only members can''t update" on %I as restrictive for update to authenticated using (%s)', t.tbl, t.expr);
    execute format('create policy "read-only members can''t delete" on %I as restrictive for delete to authenticated using (%s)', t.tbl, t.expr);
  end loop;
end;
$$;

-- ------------------------------------------------------------------ retention grace

create or replace function free_media_to_expire(p_limit integer default 200)
returns table (feedback_id uuid, paths text[])
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_window interval := make_interval(days => plan_limit('free', 'retention_days'));
begin
  return query
  select f.id,
         array_remove(array[f.screenshot_raw_path, f.screenshot_annotated_path, f.attachment_path], null)
  from feedback_items f
  join projects p on p.id = f.project_id
  where f.media_expired_at is null
    and (f.screenshot_raw_path is not null or f.screenshot_annotated_path is not null or f.attachment_path is not null)
    and f.received_at < now() - v_window
    and organization_plan(p.organization_id) = 'free'
    and coalesce(organization_free_since(p.organization_id) < now() - v_window, true)
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
  v_free_since timestamptz;
  v_retention integer;
begin
  if p_org_id not in (select auth_organization_ids()) then
    raise exception 'not a member of this organization' using errcode = '42501';
  end if;
  v_plan := organization_plan(p_org_id);
  v_free_since := organization_free_since(p_org_id);
  v_retention := plan_limit(v_plan, 'retention_days');
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
    'paused_project_ids', to_jsonb(organization_paused_project_ids(p_org_id)),
    'active_project_id', (select active_project_id from organization_billing where organization_id = p_org_id),
    'can_write', member_can_write(p_org_id),
    'free_since', v_free_since,
    -- Until when media from before the downgrade is kept (null: no grace running).
    'media_grace_until', case
      when v_retention is not null and v_free_since is not null
           and v_free_since + make_interval(days => v_retention) > now()
      then v_free_since + make_interval(days => v_retention)
    end,
    'limits', jsonb_build_object(
      'projects', plan_limit(v_plan, 'projects'),
      'members', plan_limit(v_plan, 'members'),
      'reports_per_month', plan_limit(v_plan, 'reports_per_month'),
      'storage_mb', plan_limit(v_plan, 'storage_mb'),
      'retention_days', v_retention
    )
  );
end;
$$;

grant execute on function organization_usage(uuid) to authenticated;

-- ------------------------------------------------------------------ notifications

-- 0028's version, with the reason a report is locked: a paused project, or
-- the month's Free reports being used.
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
      case when project_is_paused(v_project.id)
        then 'This project is paused on the Free plan. Upgrade to Indie to read it.'
        else 'This month''s ' || plan_limit('free', 'reports_per_month') || ' Free reports are used. Upgrade to Indie to read it.'
      end
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
