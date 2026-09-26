-- Push-to-main workflow (see DESIGN.md §8): coding agents commit straight to
-- the default branch, every push ships a beta build, and the owner promotes
-- a verified beta to production in App Store Connect (or wherever).
--
-- 1. `fix_committed` timeline events — a fix linked from a `FeedbackKit: <id>`
--    commit trailer on a push to the default branch (github-webhook), the
--    PR-less counterpart of `pr_merged`.
-- 2. Release channels: a release is a `beta` build (every push) until the
--    owner marks it promoted to production.
-- 3. Release tokens: a project-scoped, revocable secret CI uses to record
--    releases (`feedbackkit release --token`, the `ci-release` Edge
--    Function) — a CI job has no dashboard session to act as. Only a SHA-256
--    hash is stored; the plaintext is shown once, at creation.

alter table feedback_events drop constraint if exists feedback_events_kind_check;
alter table feedback_events add constraint feedback_events_kind_check check (kind in (
  'comment', 'question', 'reporter_reply', 'claimed', 'dispatched',
  'pr_opened', 'pr_merged', 'pr_closed', 'fix_committed',
  'shipped', 'verified', 'reopened', 'status_changed', 'after_screenshot', 'promoted'
));

alter table releases
  add column if not exists channel text not null default 'beta' check (channel in ('beta', 'production')),
  add column if not exists source text not null default 'cli' check (source in ('cli', 'ci')),
  add column if not exists promoted_at timestamptz,
  add column if not exists promoted_by uuid references auth.users(id) on delete set null;

-- ---------------------------------------------------------------- tokens

create table if not exists release_tokens (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  -- sha256(token), hex. The token itself is never stored.
  token_hash text not null unique,
  -- First characters of the token, so a user can tell tokens apart.
  token_prefix text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists release_tokens_project_idx on release_tokens (project_id);

alter table release_tokens enable row level security;

create policy "members can read release tokens in their orgs"
  on release_tokens for select
  using (project_id in (select id from projects where organization_id in (select auth_organization_ids())));

-- Revoking is an update of revoked_at. Inserts go through create_release_token
-- (so the plaintext is generated server-side and only its hash is kept).
create policy "members can revoke release tokens in their orgs"
  on release_tokens for update
  using (project_id in (select id from projects where organization_id in (select auth_organization_ids())))
  with check (project_id in (select id from projects where organization_id in (select auth_organization_ids())));

-- Returns the plaintext token exactly once. SECURITY DEFINER to insert past
-- the (absent) insert policy, so it checks membership itself — through the
-- PL/pgSQL helper, never a direct query on memberships (see 0004/0005).
create or replace function create_release_token(p_project_id uuid, p_name text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_token text;
begin
  if not exists (
    select 1 from projects
    where id = p_project_id and organization_id in (select auth_organization_ids())
  ) then
    raise exception 'project not found or access denied' using errcode = '42501';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'name is required' using errcode = '22023';
  end if;

  v_token := 'fkr_' || encode(gen_random_bytes(24), 'hex');
  insert into release_tokens (project_id, name, token_hash, token_prefix, created_by)
    values (p_project_id, trim(p_name), encode(digest(v_token, 'sha256'), 'hex'), left(v_token, 10), auth.uid());
  return v_token;
end;
$$;

revoke all on function create_release_token(uuid, text) from public;
grant execute on function create_release_token(uuid, text) to authenticated;

-- ---------------------------------------------------------------- CI release

-- The ci-release Edge Function's write path (service role only): same effect
-- as record_release, but with no signed-in user — the actor is the token.
create or replace function record_release_system(
  p_project_id uuid,
  p_build text,
  p_version text,
  p_commit_sha text,
  p_product_key text,
  p_channel text,
  p_feedback_ids uuid[],
  p_actor_label text
)
returns setof uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_release_id uuid;
begin
  insert into releases (project_id, build, version, commit_sha, product_key, channel, source)
    values (p_project_id, p_build, p_version, p_commit_sha, p_product_key, coalesce(p_channel, 'beta'), 'ci')
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
    insert into feedback_events (feedback_id, project_id, kind, actor_type, actor_label, body, data, visible_to_reporter)
      select s.id, p_project_id, 'shipped', 'system', p_actor_label,
             'Fixed in build ' || p_build || coalesce(' (' || p_version || ')', ''),
             jsonb_build_object('build', p_build, 'version', p_version, 'commit_sha', p_commit_sha,
                                'release_id', v_release_id, 'channel', coalesce(p_channel, 'beta')),
             true
        from shipped s
      returning feedback_id
  )
  select feedback_id from events;
end;
$$;

revoke all on function record_release_system(uuid, text, text, text, text, text, uuid[], text) from public, anon, authenticated;
grant execute on function record_release_system(uuid, text, text, text, text, text, uuid[], text) to service_role;

-- The dashboard's release-readiness view: releases with their shipped
-- reports' verification state, one query. security invoker → RLS applies.
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
  count(f.id) filter (where f.fix_stage = 'shipped') as awaiting,
  count(f.id) filter (where f.fix_stage = 'shipped' and f.reporter_id is null) as unreachable
from releases r
left join feedback_items f
  on f.project_id = r.project_id and f.fixed_in_build = r.build
  and (r.product_key is null or f.product_keys = '{}' or r.product_key = any(f.product_keys))
group by r.id;
