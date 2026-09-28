-- Access tokens (fine-grained, project-scoped) and after-fix previews.
--
-- 1. `access_tokens` replaces `release_tokens`: one kind of token with
--    scopes, an optional expiry and, for a token issued to one agent run, a
--    single report it's limited to. A token is presented as the
--    `x-feedbackkit-token` header on ordinary PostgREST/Storage requests made
--    with the publishable (anon) key, and the RLS policies below identify it
--    from that header (`request_access_token()`), so tokens are enforced by
--    RLS exactly like members are, with no application-code permission
--    checks. (Tokens aren't auth users: the hosted project only allows GitHub
--    sign-in and signs sessions with a key only Supabase holds, so there's no
--    way to mint a session for a machine user. A request is either a member's
--    session or a token, never both: the helpers ignore the header whenever
--    auth.uid() is set.)
--
--    Scopes:
--      releases:write  announce builds (the ci-release Edge Function)
--      feedback:read   read reports, their timeline, prompts and screenshots
--      feedback:write  claim, post progress, link a fix (never verify)
--      reporter:ask    ask the reporter a question (reporter-visible)
--      previews:write  attach after-fix previews (the attach-preview function)
--      tokens:issue    issue short-lived tokens limited to one report — what
--                      CI workflows hand to a coding agent, so a leaked agent
--                      token is worth one report for an hour
--
--    Only a SHA-256 hash is stored; the plaintext is shown once. Existing
--    release tokens (`fkr_…`) move over with scope releases:write and keep
--    working; `release_tokens` stays as a view for already-deployed clients.
--
-- 2. `feedback_items.resolved_at`, set when a report is verified or its
--    status becomes resolved/wont_fix, cleared when it's reopened. After-fix
--    previews are deleted 14 days after it (or 90 days after upload, for
--    reports that never resolve) by the cleanup-previews Edge Function; see
--    `previews_to_expire()`.

-- ---------------------------------------------------------------- tokens

create table if not exists access_tokens (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  -- sha256(token), hex. The token itself is never stored.
  token_hash text not null unique,
  -- First characters of the token, so a user can tell tokens apart.
  token_prefix text not null,
  scopes text[] not null check (
    cardinality(scopes) > 0
    and scopes <@ array['releases:write', 'feedback:read', 'feedback:write', 'reporter:ask', 'previews:write', 'tokens:issue']
  ),
  expires_at timestamptz,
  -- A token issued for one agent run: limited to one report, short-lived,
  -- and dead as soon as its parent is revoked or expires.
  parent_id uuid references access_tokens(id) on delete cascade,
  feedback_id uuid references feedback_items(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  check (parent_id is null or (feedback_id is not null and expires_at is not null))
);

create index if not exists access_tokens_project_idx on access_tokens (project_id, created_at desc);
create index if not exists access_tokens_parent_idx on access_tokens (parent_id);

alter table access_tokens enable row level security;

create policy "members can read access tokens in their orgs"
  on access_tokens for select
  to authenticated
  using (project_id in (select id from projects where organization_id in (select auth_organization_ids())));

-- Revoking is an update of revoked_at. Inserts go through create_access_token
-- / issue_access_token (the plaintext is generated server-side).
create policy "members can revoke access tokens in their orgs"
  on access_tokens for update
  to authenticated
  using (project_id in (select id from projects where organization_id in (select auth_organization_ids())))
  with check (project_id in (select id from projects where organization_id in (select auth_organization_ids())));

-- Move release tokens over, then keep the old name as a view so the
-- ci-release function and CLI versions already deployed keep working.
do $$
begin
  if to_regclass('public.release_tokens') is not null
     and (select relkind from pg_class where oid = 'public.release_tokens'::regclass) = 'r' then
    insert into access_tokens (id, project_id, name, token_hash, token_prefix, scopes, created_by, created_at, last_used_at, revoked_at)
      select id, project_id, name, token_hash, token_prefix, array['releases:write'], created_by, created_at, last_used_at, revoked_at
        from release_tokens
      on conflict do nothing;
    drop table release_tokens;
  end if;
end $$;

create or replace view release_tokens
with (security_invoker = true)
as
select id, project_id, name, token_hash, token_prefix, created_by, created_at, last_used_at, revoked_at
from access_tokens
where 'releases:write' = any(scopes) and parent_id is null;

-- The token presented on this request, if any, and only if it's live. Never
-- a token when the caller is signed in (a member's session wins).
create or replace function request_access_token()
returns access_tokens
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_token text;
  v_row access_tokens;
begin
  if auth.uid() is not null then
    return null;
  end if;
  v_token := nullif(current_setting('request.headers', true), '')::json ->> 'x-feedbackkit-token';
  if v_token is null or v_token !~ '^fk[rt]_[0-9a-f]{48}$' then
    return null;
  end if;
  select t.* into v_row
    from access_tokens t
    where t.token_hash = encode(digest(v_token, 'sha256'), 'hex')
      and t.revoked_at is null
      and (t.expires_at is null or t.expires_at > now());
  if not found then
    return null;
  end if;
  if v_row.parent_id is not null and not exists (
    select 1 from access_tokens p
    where p.id = v_row.parent_id and p.revoked_at is null and (p.expires_at is null or p.expires_at > now())
  ) then
    return null;
  end if;
  return v_row;
end;
$$;

-- The token's project if it has `p_scope` (any scope when null). Policies
-- call these inside `(select …)` so they run once per statement, not per row.
create or replace function token_project(p_scope text)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_row access_tokens;
begin
  v_row := request_access_token();
  if v_row.id is null or (p_scope is not null and not p_scope = any(v_row.scopes)) then
    return null;
  end if;
  return v_row.project_id;
end;
$$;

-- The one report a token is limited to (null = the whole project).
create or replace function token_feedback()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return (request_access_token()).feedback_id;
end;
$$;

revoke all on function request_access_token() from public;
grant execute on function token_project(text), token_feedback() to anon, authenticated, service_role;

-- ------------------------------------------------------- token policies
-- All for `anon`: a token request carries the publishable key and no session.

create policy "tokens can read their project"
  on projects for select
  to anon
  using (id = (select token_project(null)));

create policy "tokens can read reports"
  on feedback_items for select
  to anon
  using (
    project_id = (select token_project('feedback:read'))
    and ((select token_feedback()) is null or id = (select token_feedback()))
  );

create policy "tokens can update reports"
  on feedback_items for update
  to anon
  using (
    project_id = (select token_project('feedback:write'))
    and ((select token_feedback()) is null or id = (select token_feedback()))
  )
  with check (
    project_id = (select token_project('feedback:write'))
    and ((select token_feedback()) is null or id = (select token_feedback()))
  );

create policy "tokens can read timelines"
  on feedback_events for select
  to anon
  using (
    project_id = (select token_project('feedback:read'))
    and ((select token_feedback()) is null or feedback_id = (select token_feedback()))
  );

-- Agent events only, never as a user, and never reporter/system/GitHub
-- kinds. A question for the reporter (or anything they'd see) needs
-- reporter:ask. After-fix previews are written by attach-preview.
create policy "tokens can add agent events"
  on feedback_events for insert
  to anon
  with check (
    project_id = (select token_project('feedback:write'))
    and ((select token_feedback()) is null or feedback_id = (select token_feedback()))
    and actor_type = 'agent'
    and actor_user_id is null
    and kind in ('comment', 'question', 'claimed', 'pr_opened', 'pr_merged', 'status_changed')
    and (
      (kind <> 'question' and visible_to_reporter = false)
      or project_id = (select token_project('reporter:ask'))
    )
    and exists (
      select 1 from feedback_items f where f.id = feedback_id and f.project_id = feedback_events.project_id
    )
  );

create policy "tokens can read prompt templates"
  on prompt_templates for select
  to anon
  using (project_id = (select token_project('feedback:read')));

create policy "tokens can read products"
  on products for select
  to anon
  using (project_id = (select token_project('feedback:read')));

create policy "tokens can read releases"
  on releases for select
  to anon
  using (project_id = (select token_project('feedback:read')));

create policy "tokens can read their project's screenshots"
  on storage.objects for select
  to anon
  using (
    bucket_id = 'feedback-screenshots'
    and try_cast_uuid((storage.foldername(name))[1]) = (select token_project('feedback:read'))
    and (
      (select token_feedback()) is null
      or try_cast_uuid((storage.foldername(name))[2]) = (select token_feedback())
    )
  );

-- A token may move a report along the agent's part of the loop, and nothing
-- else: not its text, screenshots or reporter, and never to shipped/verified
-- (releases and reporters do that).
create or replace function feedback_items_token_guard()
returns trigger
language plpgsql
as $$
declare
  v_allowed text[] := array['fix_stage', 'status', 'fix_pr_url', 'fix_pr_number', 'fix_commit_sha', 'fix_summary', 'resolved_at'];
begin
  if current_user <> 'anon' then
    return new;
  end if;
  if (to_jsonb(new) - v_allowed) is distinct from (to_jsonb(old) - v_allowed) then
    raise exception 'an access token can only change a report''s fix stage, status and fix details' using errcode = '42501';
  end if;
  if new.fix_stage is distinct from old.fix_stage
     and new.fix_stage not in ('agent_working', 'pr_open', 'merged') then
    raise exception 'an access token can''t move a report to %', new.fix_stage using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists feedback_items_token_guard on feedback_items;
create trigger feedback_items_token_guard
  before update on feedback_items
  for each row execute function feedback_items_token_guard();

-- ------------------------------------------------------- token functions

create or replace function new_token_plaintext(p_prefix text)
returns text
language sql
volatile
set search_path = public, extensions
as $$
  select p_prefix || encode(gen_random_bytes(24), 'hex');
$$;

revoke all on function new_token_plaintext(text) from public, anon, authenticated;

-- A member creates a token for one of their projects. Returns the plaintext
-- exactly once. SECURITY DEFINER to insert past the (absent) insert policy,
-- so it checks membership itself through the PL/pgSQL helper (see 0004/0005).
create or replace function create_access_token(
  p_project_id uuid,
  p_name text,
  p_scopes text[],
  p_expires_at timestamptz default null
)
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
  if coalesce(cardinality(p_scopes), 0) = 0 then
    raise exception 'pick at least one scope' using errcode = '22023';
  end if;
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'expiry must be in the future' using errcode = '22023';
  end if;

  v_token := new_token_plaintext('fkt_');
  insert into access_tokens (project_id, name, token_hash, token_prefix, scopes, expires_at, created_by)
    values (p_project_id, trim(p_name), encode(digest(v_token, 'sha256'), 'hex'), left(v_token, 10),
            (select array_agg(distinct s order by s) from unnest(p_scopes) s), p_expires_at, auth.uid());
  return v_token;
end;
$$;

revoke all on function create_access_token(uuid, text, text[], timestamptz) from public, anon;
grant execute on function create_access_token(uuid, text, text[], timestamptz) to authenticated;

-- Kept for CLI versions before access tokens: a release-only token in the
-- old `fkr_` format, which those versions check for.
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

  v_token := new_token_plaintext('fkr_');
  insert into access_tokens (project_id, name, token_hash, token_prefix, scopes, created_by)
    values (p_project_id, trim(p_name), encode(digest(v_token, 'sha256'), 'hex'), left(v_token, 10),
            array['releases:write'], auth.uid());
  return v_token;
end;
$$;

revoke all on function create_release_token(uuid, text) from public, anon;
grant execute on function create_release_token(uuid, text) to authenticated;

-- A token limited to one report, expiring in `p_ttl_minutes` (5 min – 12 h).
-- Callable with a token that has tokens:issue (CI, before starting the
-- agent) or by a member of the report's organization. It gets the agent
-- scopes the caller has; never releases:write or tokens:issue.
create or replace function issue_access_token(
  p_feedback_id uuid,
  p_ttl_minutes integer default 60,
  p_name text default null
)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_parent access_tokens;
  v_project uuid;
  v_scopes text[];
  v_agent_scopes text[] := array['feedback:read', 'feedback:write', 'reporter:ask', 'previews:write'];
  v_token text;
begin
  select project_id into v_project from feedback_items where id = p_feedback_id;
  if v_project is null then
    raise exception 'report not found or access denied' using errcode = '42501';
  end if;

  if auth.uid() is not null then
    if v_project not in (select id from projects where organization_id in (select auth_organization_ids())) then
      raise exception 'report not found or access denied' using errcode = '42501';
    end if;
    v_scopes := v_agent_scopes;
  else
    v_parent := request_access_token();
    if v_parent.id is null or not 'tokens:issue' = any(v_parent.scopes) or v_parent.project_id <> v_project
       or v_parent.feedback_id is not null then
      raise exception 'report not found or access denied' using errcode = '42501';
    end if;
    select coalesce(array_agg(s order by s), '{}') into v_scopes
      from unnest(v_parent.scopes) s where s = any(v_agent_scopes);
    if cardinality(v_scopes) = 0 then
      raise exception 'this token has no agent scopes to pass on' using errcode = '42501';
    end if;
    update access_tokens set last_used_at = now() where id = v_parent.id;
  end if;

  v_token := new_token_plaintext('fkt_');
  insert into access_tokens (project_id, name, token_hash, token_prefix, scopes, expires_at, parent_id, feedback_id, created_by)
    values (v_project,
            coalesce(nullif(trim(p_name), ''), coalesce(v_parent.name || ' → ', '') || 'report ' || left(p_feedback_id::text, 8)),
            encode(digest(v_token, 'sha256'), 'hex'), left(v_token, 10), v_scopes,
            now() + make_interval(mins => greatest(5, least(coalesce(p_ttl_minutes, 60), 720))),
            v_parent.id, p_feedback_id, auth.uid());
  return v_token;
end;
$$;

revoke all on function issue_access_token(uuid, integer, text) from public;
grant execute on function issue_access_token(uuid, integer, text) to anon, authenticated;

-- What the presented token is (the CLI's `whoami`, and how it finds its
-- project). Also records that the token was used.
create or replace function access_token_info()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_row access_tokens;
begin
  v_row := request_access_token();
  if v_row.id is null then
    return null;
  end if;
  update access_tokens set last_used_at = now() where id = v_row.id;
  return jsonb_build_object(
    'id', v_row.id,
    'name', v_row.name,
    'project_id', v_row.project_id,
    'project_name', (select name from projects where id = v_row.project_id),
    'feedback_id', v_row.feedback_id,
    'scopes', to_jsonb(v_row.scopes),
    'expires_at', v_row.expires_at
  );
end;
$$;

revoke all on function access_token_info() from public;
grant execute on function access_token_info() to anon;

-- ------------------------------------------------------- resolved_at

alter table feedback_items add column if not exists resolved_at timestamptz;

update feedback_items
  set resolved_at = coalesce(verified_at, now())
  where resolved_at is null and (fix_stage = 'verified' or status in ('resolved', 'wont_fix'));

create or replace function feedback_items_resolved_at()
returns trigger
language plpgsql
as $$
declare
  v_resolved boolean := coalesce(new.fix_stage = 'verified', false) or new.status in ('resolved', 'wont_fix');
begin
  if not v_resolved then
    new.resolved_at := null;
  elsif tg_op = 'INSERT' or old.resolved_at is null then
    new.resolved_at := now();
  else
    new.resolved_at := old.resolved_at;
  end if;
  return new;
end;
$$;

drop trigger if exists feedback_items_resolved_at on feedback_items;
create trigger feedback_items_resolved_at
  before insert or update of fix_stage, status on feedback_items
  for each row execute function feedback_items_resolved_at();

-- ------------------------------------------------------- preview retention

-- After-fix previews (after_screenshot events) whose file should go: 14 days
-- after the report resolved, or 90 days after upload. Service role only (the
-- cleanup-previews function deletes the files, which SQL can't).
create or replace function previews_to_expire(p_limit integer default 200)
returns table (event_id uuid, path text)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, coalesce(e.data ->> 'media_path', e.data ->> 'screenshot_path')
  from feedback_events e
  join feedback_items f on f.id = e.feedback_id
  where e.kind = 'after_screenshot'
    and coalesce(e.data ->> 'media_path', e.data ->> 'screenshot_path') is not null
    and not (e.data ? 'expired_at')
    and (
      e.created_at < now() - interval '90 days'
      or f.resolved_at < now() - interval '14 days'
    )
  order by e.created_at
  limit p_limit;
$$;

revoke all on function previews_to_expire(integer) from public, anon, authenticated;
grant execute on function previews_to_expire(integer) to service_role;
