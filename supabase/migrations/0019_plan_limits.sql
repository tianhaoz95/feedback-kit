-- Free plan limits. Every paid plan (anything but 'free') is unlimited.
--
--   Free: 1 project, 3 members, 50 reports per calendar month (UTC), with the
--   whole fix loop included — verification is the product, so it's never
--   gated; volume is.
--
-- Benchmarks when this was set (Sep 2026): Shake free = 20 reports/month,
-- 1 app, 3 seats; Jam free = 30/month; Userback free = 2 seats, 2 projects.
-- Keep the numbers in step with web/src/lib/pricing.ts (FREE_LIMITS).
--
-- Enforced where the write happens, so no client can skip it: triggers on
-- projects/memberships (covering SECURITY DEFINER paths like
-- accept_invitation too), and ingest-feedback asks
-- project_accepts_report() before storing a report. Existing rows over a
-- limit are left alone; only new ones are refused.

alter table organization_billing
  add column if not exists limits_exempt boolean not null default false;

create or replace function plan_limit(p_name text)
returns integer
language sql
immutable
as $$
  select case p_name
    when 'projects' then 1
    when 'members' then 3
    when 'reports_per_month' then 50
  end;
$$;

-- True when the organization is on Free and not exempt. PL/pgSQL (never
-- inlined) and SECURITY DEFINER, like every helper that reads tables with
-- their own RLS policies (see 0004/0005).
create or replace function organization_is_limited(p_org_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  return coalesce(
    (select b.plan = 'free' and not b.limits_exempt from organization_billing b where b.organization_id = p_org_id),
    true
  );
end;
$$;

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
      and f.received_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc'
  );
end;
$$;

create or replace function enforce_project_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if organization_is_limited(new.organization_id)
     and (select count(*) from projects where organization_id = new.organization_id) >= plan_limit('projects') then
    raise exception 'The Free plan includes % project. Upgrade to Team for more.', plan_limit('projects')
      using errcode = 'P0001', hint = 'plan_limit_projects';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_project_limit on projects;
create trigger enforce_project_limit
  before insert on projects
  for each row execute function enforce_project_limit();

create or replace function enforce_member_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if organization_is_limited(new.organization_id)
     and (select count(*) from memberships where organization_id = new.organization_id) >= plan_limit('members') then
    raise exception 'The Free plan includes % members. Upgrade to Team to add more.', plan_limit('members')
      using errcode = 'P0001', hint = 'plan_limit_members';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_member_limit on memberships;
create trigger enforce_member_limit
  before insert on memberships
  for each row execute function enforce_member_limit();

-- Refuse the invitation up front rather than letting the invitee hit the
-- membership trigger: members + pending (unexpired, unused) invitations.
create or replace function enforce_invitation_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if organization_is_limited(new.organization_id)
     and (select count(*) from memberships where organization_id = new.organization_id)
       + (select count(*) from organization_invitations
          where organization_id = new.organization_id and accepted_at is null and revoked_at is null and expires_at > now())
       >= plan_limit('members') then
    raise exception 'The Free plan includes % members, counting pending invitations. Upgrade to Team to invite more.', plan_limit('members')
      using errcode = 'P0001', hint = 'plan_limit_members';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_invitation_limit on organization_invitations;
create trigger enforce_invitation_limit
  before insert on organization_invitations
  for each row execute function enforce_invitation_limit();

-- Asked by ingest-feedback (service role) before storing a report.
create or replace function project_accepts_report(p_project_id uuid)
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
  if v_org is null or not organization_is_limited(v_org) then
    return true;
  end if;
  return organization_reports_this_month(v_org) < plan_limit('reports_per_month');
end;
$$;

-- What the dashboard shows on Billing and in the near-limit banner.
create or replace function organization_usage(p_org_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if p_org_id not in (select auth_organization_ids()) then
    raise exception 'not a member of this organization' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'limited', organization_is_limited(p_org_id),
    'reports_this_month', organization_reports_this_month(p_org_id),
    'projects', (select count(*) from projects where organization_id = p_org_id),
    'members', (select count(*) from memberships where organization_id = p_org_id),
    'limits', jsonb_build_object(
      'projects', plan_limit('projects'),
      'members', plan_limit('members'),
      'reports_per_month', plan_limit('reports_per_month')
    )
  );
end;
$$;

revoke execute on function project_accepts_report(uuid) from public, anon, authenticated;
grant execute on function organization_usage(uuid) to authenticated;

-- FeedbackKit's own team dogfoods the product (web/src/lib/feedbackkit.ts,
-- DeveloperApp/Sources/App/PortalDogfood.swift) and is exempt. No-op on a
-- local stack without that project.
update organization_billing
set limits_exempt = true
where organization_id in (select organization_id from projects where project_key = 'pk_cde764e9b97ba261cdd084e7e3e4cf04ce31');
