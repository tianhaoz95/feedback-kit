-- Run tokens for merged reports.
--
-- Several reports merged in the dashboard go to an agent as one issue, with a
-- `FeedbackKit: <id>` line per report (create-github-issue). A run token
-- (0025) was limited to one report, so agent workflows issued it for the
-- first id only and every update and preview landed on that report. A run
-- token can now cover the whole batch: `feedback_id` stays the first report
-- (the 0025 check and older CLIs' `whoami` read it), and `feedback_ids`
-- lists every report the token may touch.

alter table access_tokens add column if not exists feedback_ids uuid[];

-- The reports a token is limited to (null = the whole project).
create or replace function token_feedback_ids()
returns uuid[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_row access_tokens;
begin
  v_row := request_access_token();
  if v_row.feedback_id is null then
    return null;
  end if;
  return coalesce(v_row.feedback_ids, array[v_row.feedback_id]);
end;
$$;

grant execute on function token_feedback_ids() to anon, authenticated, service_role;

-- Same policies as 0025, matching any of the token's reports.

drop policy if exists "tokens can read reports" on feedback_items;
create policy "tokens can read reports"
  on feedback_items for select
  to anon
  using (
    project_id = (select token_project('feedback:read'))
    and ((select token_feedback_ids()) is null or id = any((select token_feedback_ids())::uuid[]))
  );

drop policy if exists "tokens can update reports" on feedback_items;
create policy "tokens can update reports"
  on feedback_items for update
  to anon
  using (
    project_id = (select token_project('feedback:write'))
    and ((select token_feedback_ids()) is null or id = any((select token_feedback_ids())::uuid[]))
  )
  with check (
    project_id = (select token_project('feedback:write'))
    and ((select token_feedback_ids()) is null or id = any((select token_feedback_ids())::uuid[]))
  );

drop policy if exists "tokens can read timelines" on feedback_events;
create policy "tokens can read timelines"
  on feedback_events for select
  to anon
  using (
    project_id = (select token_project('feedback:read'))
    and ((select token_feedback_ids()) is null or feedback_id = any((select token_feedback_ids())::uuid[]))
  );

drop policy if exists "tokens can add agent events" on feedback_events;
create policy "tokens can add agent events"
  on feedback_events for insert
  to anon
  with check (
    project_id = (select token_project('feedback:write'))
    and ((select token_feedback_ids()) is null or feedback_id = any((select token_feedback_ids())::uuid[]))
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

drop policy if exists "tokens can read their project's screenshots" on storage.objects;
create policy "tokens can read their project's screenshots"
  on storage.objects for select
  to anon
  using (
    bucket_id = 'feedback-screenshots'
    and try_cast_uuid((storage.foldername(name))[1]) = (select token_project('feedback:read'))
    and (
      (select token_feedback_ids()) is null
      or try_cast_uuid((storage.foldername(name))[2]) = any((select token_feedback_ids())::uuid[])
    )
  );

-- issue_access_token gains `p_feedback_ids`: the other reports of a merged
-- batch, all in the same project as `p_feedback_id`. Older CLIs call it with
-- the first three arguments only, which the default keeps working.
drop function if exists issue_access_token(uuid, integer, text);

create or replace function issue_access_token(
  p_feedback_id uuid,
  p_ttl_minutes integer default 60,
  p_name text default null,
  p_feedback_ids uuid[] default null
)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_parent access_tokens;
  v_project uuid;
  v_ids uuid[];
  v_scopes text[];
  v_agent_scopes text[] := array['feedback:read', 'feedback:write', 'reporter:ask', 'previews:write'];
  v_token text;
begin
  select project_id into v_project from feedback_items where id = p_feedback_id;
  if v_project is null then
    raise exception 'report not found or access denied' using errcode = '42501';
  end if;

  -- The first report, then the rest in the order given, without repeats.
  select array_agg(id order by ord) into v_ids
    from (
      select distinct on (id) id, ord
      from unnest(array[p_feedback_id] || coalesce(p_feedback_ids, '{}')) with ordinality as u(id, ord)
      where id is not null
      order by id, ord
    ) d;
  if cardinality(v_ids) > 50 then
    raise exception 'a run token covers at most 50 reports' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(v_ids) i
    where not exists (select 1 from feedback_items f where f.id = i and f.project_id = v_project)
  ) then
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
  insert into access_tokens (project_id, name, token_hash, token_prefix, scopes, expires_at, parent_id, feedback_id, feedback_ids, created_by)
    values (v_project,
            coalesce(nullif(trim(p_name), ''), coalesce(v_parent.name || ' → ', '') || 'report ' || left(p_feedback_id::text, 8)
              || case when cardinality(v_ids) > 1 then ' +' || (cardinality(v_ids) - 1) else '' end),
            encode(digest(v_token, 'sha256'), 'hex'), left(v_token, 10), v_scopes,
            now() + make_interval(mins => greatest(5, least(coalesce(p_ttl_minutes, 60), 720))),
            v_parent.id, p_feedback_id, v_ids, auth.uid());
  return v_token;
end;
$$;

revoke all on function issue_access_token(uuid, integer, text, uuid[]) from public;
grant execute on function issue_access_token(uuid, integer, text, uuid[]) to anon, authenticated;

-- `feedback_ids` added, for the CLI's `whoami`.
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
    'feedback_ids', case when v_row.feedback_id is null then null
                         else to_jsonb(coalesce(v_row.feedback_ids, array[v_row.feedback_id])) end,
    'scopes', to_jsonb(v_row.scopes),
    'expires_at', v_row.expires_at
  );
end;
$$;
