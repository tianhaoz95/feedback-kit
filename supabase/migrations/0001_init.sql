-- FeedbackKit dashboard schema.
--
-- Multi-tenancy model: an `organization` is a developer account. Any number
-- of `auth.users` can belong to an organization via `memberships` (with a
-- role), so accounts support teams from day one. Everything below hangs off
-- organization_id and is protected by RLS keyed on membership, so one
-- organization can never see another's projects or feedback.

create extension if not exists "pgcrypto";

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create type membership_role as enum ('owner', 'member');

create table memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role membership_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  -- Public-ish routing key embedded in the iOS app (like a Stripe publishable
  -- key). Identifies which project/org feedback belongs to; not a secret.
  project_key text not null unique default ('pk_' || encode(gen_random_bytes(18), 'hex')),
  created_at timestamptz not null default now()
);

create table prompt_templates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  -- Mustache-style template, e.g. "Fix the following bug reported by a user:\n\n{{feedback_text}}\n\nScreen: {{screen_name}}\n..."
  template_text text not null,
  updated_at timestamptz not null default now(),
  unique (project_id)
);

create type feedback_status as enum ('new', 'in_progress', 'resolved', 'wont_fix');

create table feedback_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  text text not null,
  -- Storage object paths, not signed URLs (those are generated on read).
  screenshot_raw_path text not null,
  screenshot_annotated_path text not null,
  annotations jsonb not null default '[]'::jsonb,
  environment jsonb not null default '{}'::jsonb,
  status feedback_status not null default 'new',
  -- The developer's edited version of the generated coding-agent prompt, if
  -- they've customized it away from the template default.
  edited_prompt text,
  created_at timestamptz not null default now()
);

create index feedback_items_project_id_idx on feedback_items(project_id);
create index memberships_user_id_idx on memberships(user_id);

-- Helper: organizations the current user belongs to. `security definer` so
-- it can read `memberships` even though callers only have RLS-filtered access.
create function auth_organization_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select organization_id from memberships where user_id = auth.uid();
$$;

alter table organizations enable row level security;
alter table memberships enable row level security;
alter table projects enable row level security;
alter table prompt_templates enable row level security;
alter table feedback_items enable row level security;

create policy "members can read their orgs"
  on organizations for select
  using (id in (select auth_organization_ids()));

create policy "members can read memberships in their orgs"
  on memberships for select
  using (organization_id in (select auth_organization_ids()));

create policy "owners can manage memberships in their orgs"
  on memberships for all
  using (
    organization_id in (
      select organization_id from memberships
      where user_id = auth.uid() and role = 'owner'
    )
  );

create policy "members can manage projects in their orgs"
  on projects for all
  using (organization_id in (select auth_organization_ids()))
  with check (organization_id in (select auth_organization_ids()));

create policy "members can manage prompt templates in their orgs"
  on prompt_templates for all
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

create policy "members can manage feedback in their orgs"
  on feedback_items for all
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

-- New users get their own organization automatically on sign-up, so the
-- dashboard has somewhere to put their first project immediately.
create function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
begin
  insert into organizations (name) values (coalesce(new.raw_user_meta_data->>'organization_name', 'My Team'))
    returning id into new_org_id;
  insert into memberships (organization_id, user_id, role) values (new_org_id, new.id, 'owner');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
