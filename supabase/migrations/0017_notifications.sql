-- In-app notifications, plus (dormant) push to the iOS Developer Portal.
--
-- 1. `notifications` — one row per recipient. Database triggers write them,
--    so every writer (ingest-feedback, reporter-updates, github-webhook, the
--    CLI, the dashboard) produces them without knowing notifications exist:
--
--      new report                           → new_feedback   (every member)
--      reporter replies from their device   → reporter_reply (every member)
--      reporter says "still broken"         → reopened       (every member)
--      reporter confirms the fix            → verified       (every member)
--      PR merged / fix commit on main       → fix_merged     (every member)
--      someone accepts an invitation        → member_joined  (owners)
--
--    The person who caused an event is never notified about it. The web
--    dashboard reads this table through Realtime; the Portal polls it.
--
-- 2. `notification_preferences` — per-user muted kinds and a push switch.
--
-- 3. `push_devices` + a trigger that asks the `send-push` Edge Function to
--    deliver each new notification over APNs. It does nothing until the
--    project is configured, the same "dormant until switched on" pattern as
--    billing (0009): two Vault secrets tell the database where the function
--    is and how to authenticate to it, and the function itself needs the
--    APNs key. See supabase/functions/send-push/index.ts for the steps.

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  feedback_id uuid references feedback_items(id) on delete cascade,
  kind text not null check (kind in (
    'new_feedback', 'reporter_reply', 'reopened', 'verified', 'fix_merged', 'member_joined'
  )),
  title text not null,
  body text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists notifications_user_idx on notifications (user_id, created_at desc);
create index if not exists notifications_user_unread_idx on notifications (user_id) where read_at is null;

alter table notifications enable row level security;

create policy "users can read their notifications"
  on notifications for select
  using (user_id = auth.uid());

create policy "users can mark their notifications read"
  on notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users can delete their notifications"
  on notifications for delete
  using (user_id = auth.uid());

-- Only `read_at` is client-writable; everything else is set by the triggers.
revoke update on notifications from authenticated;
grant update (read_at) on notifications to authenticated;

create table if not exists notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  muted_kinds text[] not null default '{}',
  push_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table notification_preferences enable row level security;

create policy "users can manage their notification preferences"
  on notification_preferences for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Live updates for the dashboard's bell (Realtime applies the select policy).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
     ) then
    alter publication supabase_realtime add table notifications;
  end if;
end;
$$;

-- ------------------------------------------------------------------ fan-out

create or replace function notify_org_members(
  p_org_id uuid,
  p_project_id uuid,
  p_feedback_id uuid,
  p_kind text,
  p_title text,
  p_body text,
  p_exclude_user_id uuid default null,
  p_owners_only boolean default false,
  p_data jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into notifications (user_id, organization_id, project_id, feedback_id, kind, title, body, data)
  select m.user_id, p_org_id, p_project_id, p_feedback_id, p_kind, p_title, p_body, coalesce(p_data, '{}'::jsonb)
  from memberships m
  left join notification_preferences np on np.user_id = m.user_id
  where m.organization_id = p_org_id
    and (p_exclude_user_id is null or m.user_id <> p_exclude_user_id)
    and (not p_owners_only or m.role = 'owner')
    and not (p_kind = any (coalesce(np.muted_kinds, '{}')));
end;
$$;

revoke all on function notify_org_members(uuid, uuid, uuid, text, text, text, uuid, boolean, jsonb) from public;

-- A one-line preview of a report for notification bodies.
create or replace function feedback_snippet(p_text text)
returns text
language sql
immutable
as $$
  select case
    when coalesce(trim(p_text), '') = '' then '(no description)'
    when length(trim(p_text)) > 120 then left(trim(p_text), 117) || '…'
    else trim(p_text)
  end;
$$;

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
  perform notify_org_members(
    v_project.organization_id, v_project.id, new.id, 'new_feedback',
    'New feedback in ' || v_project.name,
    feedback_snippet(new.text)
  );
  return new;
end;
$$;

drop trigger if exists on_feedback_created_notify on feedback_items;
create trigger on_feedback_created_notify
  after insert on feedback_items
  for each row execute function notify_new_feedback();

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
    when 'verified' then v_kind := 'verified'; v_title := 'Reporter confirmed the fix';
    when 'pr_merged' then v_kind := 'fix_merged'; v_title := 'Fix merged';
    when 'fix_committed' then v_kind := 'fix_merged'; v_title := 'Fix committed';
    else return new;
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

drop trigger if exists on_feedback_event_notify on feedback_events;
create trigger on_feedback_event_notify
  after insert on feedback_events
  for each row execute function notify_feedback_event();

create or replace function notify_member_joined()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_org_name text;
begin
  select coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'user_name', email)
    into v_name from auth.users where id = new.user_id;
  select name into v_org_name from organizations where id = new.organization_id;
  perform notify_org_members(
    new.organization_id, null, null, 'member_joined',
    coalesce(v_name, 'Someone') || ' joined ' || coalesce(v_org_name, 'your organization'),
    null,
    new.user_id,
    true
  );
  return new;
end;
$$;

drop trigger if exists on_membership_created_notify on memberships;
create trigger on_membership_created_notify
  after insert on memberships
  for each row execute function notify_member_joined();

-- --------------------------------------------------------------------- push

create table if not exists push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- APNs device token, hex.
  token text not null unique,
  platform text not null default 'ios' check (platform in ('ios')),
  -- Which APNs gateway issued the token: development builds (Xcode) get
  -- sandbox tokens, TestFlight/App Store builds get production ones.
  environment text not null default 'production' check (environment in ('sandbox', 'production')),
  bundle_id text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists push_devices_user_idx on push_devices (user_id);

alter table push_devices enable row level security;

create policy "users can see their push devices"
  on push_devices for select
  using (user_id = auth.uid());

create policy "users can remove their push devices"
  on push_devices for delete
  using (user_id = auth.uid());

-- A token belongs to whoever signed in on that device most recently, so
-- registering moves it between users; that's why this is a function rather
-- than an upsert under RLS.
create or replace function register_push_device(p_token text, p_environment text default 'production', p_bundle_id text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if coalesce(p_token, '') !~ '^[0-9a-fA-F]{32,200}$' then
    raise exception 'invalid device token' using errcode = '22023';
  end if;

  insert into push_devices (user_id, token, environment, bundle_id)
    values (auth.uid(), lower(p_token), coalesce(p_environment, 'production'), p_bundle_id)
  on conflict (token) do update
    set user_id = excluded.user_id,
        environment = excluded.environment,
        bundle_id = excluded.bundle_id,
        last_seen_at = now();
end;
$$;

create or replace function unregister_push_device(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from push_devices where token = lower(p_token) and user_id = auth.uid();
end;
$$;

revoke all on function register_push_device(text, text, text) from public;
revoke all on function unregister_push_device(text) from public;
grant execute on function register_push_device(text, text, text) to authenticated;
grant execute on function unregister_push_device(text) to authenticated;

create extension if not exists pg_net with schema extensions;

-- Hands a new notification to the send-push Edge Function. Never fails the
-- insert: with no device, push turned off, or the Vault secrets missing, it
-- simply returns. To switch it on (hosted project, SQL editor):
--
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1', 'feedbackkit_functions_url');
--   select vault.create_secret('<random string>', 'feedbackkit_push_secret');
--
-- and set the same random string as the function's PUSH_WEBHOOK_SECRET.
create or replace function dispatch_push_notification()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (select 1 from push_devices where user_id = new.user_id) then
    return new;
  end if;
  if exists (select 1 from notification_preferences where user_id = new.user_id and not push_enabled) then
    return new;
  end if;

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'feedbackkit_functions_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'feedbackkit_push_secret';
  if v_url is null or v_secret is null then
    return new;
  end if;

  perform net.http_post(
    url := rtrim(v_url, '/') || '/send-push',
    body := jsonb_build_object('notification_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret)
  );
  return new;
exception when others then
  -- Push is best-effort; the in-app notification row is what matters.
  return new;
end;
$$;

drop trigger if exists on_notification_created_push on notifications;
create trigger on_notification_created_push
  after insert on notifications
  for each row execute function dispatch_push_notification();
