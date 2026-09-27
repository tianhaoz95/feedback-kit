-- First-party product analytics: what people do in the dashboard, and how far
-- each organization gets through the loop. No third-party tracker, no
-- cookies, no IP addresses — see the privacy notice (web/src/pages/PrivacyPage.tsx).
--
-- The dashboard writes events (web/src/lib/analytics.ts); nobody can read
-- them back except the service role, which scripts/analytics_report.mjs uses.
-- Signed-out visitors can only record page views, without a user.

create table if not exists analytics_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete cascade,
  organization_id uuid references organizations(id) on delete set null,
  -- Random per browser tab (sessionStorage), to count visits; not persistent.
  session_id text check (char_length(session_id) <= 64),
  name text not null check (name ~ '^[a-z][a-z0-9_]{0,63}$'),
  path text check (char_length(path) <= 300),
  properties jsonb not null default '{}'::jsonb check (pg_column_size(properties) <= 2048)
);

create index if not exists analytics_events_created_idx on analytics_events (created_at desc);
create index if not exists analytics_events_name_idx on analytics_events (name, created_at desc);

alter table analytics_events enable row level security;

create policy "members record their own events"
  on analytics_events for insert to authenticated
  with check (
    user_id = auth.uid()
    and (organization_id is null or organization_id in (select auth_organization_ids()))
  );

create policy "visitors record page views"
  on analytics_events for insert to anon
  with check (user_id is null and organization_id is null and name = 'page_view');

-- The activation funnel, per organization created since p_since, from the
-- product's own tables (not from events, so it can't drift). Service role only.
create or replace function analytics_funnel(p_since timestamptz default now() - interval '30 days')
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_orgs uuid[];
begin
  select coalesce(array_agg(id), '{}') into v_orgs from organizations where created_at >= p_since;
  return jsonb_build_object(
    'since', p_since,
    'signups', (select count(*) from auth.users where created_at >= p_since),
    'funnel', jsonb_build_object(
      'organizations', cardinality(v_orgs),
      'created_project', (select count(distinct organization_id) from projects where organization_id = any(v_orgs)),
      'received_report', (select count(distinct p.organization_id) from feedback_items f join projects p on p.id = f.project_id where p.organization_id = any(v_orgs)),
      'sent_to_agent', (select count(distinct p.organization_id) from feedback_events e join projects p on p.id = e.project_id
                          where p.organization_id = any(v_orgs) and e.kind in ('claimed', 'dispatched')),
      'linked_fix', (select count(distinct p.organization_id) from feedback_events e join projects p on p.id = e.project_id
                       where p.organization_id = any(v_orgs) and e.kind in ('pr_opened', 'pr_merged', 'fix_committed')),
      'announced_build', (select count(distinct p.organization_id) from releases r join projects p on p.id = r.project_id where p.organization_id = any(v_orgs)),
      'reporter_verified', (select count(distinct p.organization_id) from feedback_events e join projects p on p.id = e.project_id
                              where p.organization_id = any(v_orgs) and e.kind = 'verified')
    ),
    'active_users_7d', (select count(distinct user_id) from analytics_events where created_at >= now() - interval '7 days' and user_id is not null),
    'active_users_30d', (select count(distinct user_id) from analytics_events where created_at >= now() - interval '30 days' and user_id is not null),
    'visitor_sessions_30d', (select count(distinct session_id) from analytics_events where created_at >= now() - interval '30 days' and user_id is null),
    'events_30d', (select coalesce(jsonb_object_agg(name, n), '{}'::jsonb) from (
      select name, count(*) as n from analytics_events
      where created_at >= now() - interval '30 days' and name <> 'page_view'
      group by name order by n desc limit 30) t),
    'top_pages_30d', (select coalesce(jsonb_object_agg(path, n), '{}'::jsonb) from (
      select path, count(*) as n from analytics_events
      where created_at >= now() - interval '30 days' and name = 'page_view' and path is not null
      group by path order by n desc limit 15) t)
  );
end;
$$;

revoke execute on function analytics_funnel(timestamptz) from public, anon, authenticated;
