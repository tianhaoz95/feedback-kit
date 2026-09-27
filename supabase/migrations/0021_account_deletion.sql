-- Self-service account deletion (dashboard Account page and the Portal app —
-- Apple requires in-app deletion for apps with sign-in, guideline 5.1.1(v)).
--
-- Deletes the auth user, which cascades to memberships, CLI sessions,
-- notifications, push tokens, GitHub user tokens and analytics events, and
-- nulls the user on shared history (report events, releases, invitations).
-- Organizations where they're the only member go with them. Refused while it
-- would leave an organization without an owner, or would orphan a live paid
-- subscription. Storage files of deleted projects are removed by the client
-- first (direct deletes on storage.objects aren't allowed), like
-- DeleteProjectCard does.

create or replace function delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  r record;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  for r in
    select o.id, o.name,
           exists (select 1 from memberships x where x.organization_id = o.id and x.user_id <> v_uid) as has_others,
           exists (select 1 from memberships x where x.organization_id = o.id and x.user_id <> v_uid and x.role = 'owner') as has_other_owner
    from memberships m
    join organizations o on o.id = m.organization_id
    where m.user_id = v_uid
  loop
    if r.has_others and not r.has_other_owner
       and exists (select 1 from memberships where organization_id = r.id and user_id = v_uid and role = 'owner') then
      raise exception 'Make someone else an owner of "%" first, or remove its other members.', r.name
        using errcode = '22023';
    end if;
    if not r.has_others and exists (
      select 1 from organization_billing b
      where b.organization_id = r.id and b.plan <> 'free' and b.status in ('active', 'trialing', 'past_due')
    ) then
      raise exception 'Cancel the paid plan for "%" on the Billing page first.', r.name
        using errcode = '22023';
    end if;
  end loop;

  delete from organizations o
  where o.id in (select organization_id from memberships where user_id = v_uid)
    and not exists (select 1 from memberships x where x.organization_id = o.id and x.user_id <> v_uid);

  delete from auth.users where id = v_uid;
end;
$$;

revoke execute on function delete_my_account() from public, anon;
grant execute on function delete_my_account() to authenticated;

-- The storage paths the client should remove before deleting: every file of
-- every project in an organization that will be deleted with the account.
create or replace function my_sole_organization_storage_paths()
returns setof text
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  return query
    with sole as (
      select m.organization_id from memberships m
      where m.user_id = auth.uid()
        and not exists (select 1 from memberships x where x.organization_id = m.organization_id and x.user_id <> auth.uid())
    ), items as (
      select f.* from feedback_items f join projects p on p.id = f.project_id
      where p.organization_id in (select organization_id from sole)
    )
    select x from items, unnest(array[items.screenshot_raw_path, items.screenshot_annotated_path, items.attachment_path]) as x where x is not null
    union
    select e.data->>'screenshot_path' from feedback_events e join projects p on p.id = e.project_id
    where p.organization_id in (select organization_id from sole) and e.data ? 'screenshot_path'
    union
    select e.data->>'screenshot_annotated_path' from feedback_events e join projects p on p.id = e.project_id
    where p.organization_id in (select organization_id from sole) and e.data ? 'screenshot_annotated_path'
    union
    select e.data->>'screenshot_raw_path' from feedback_events e join projects p on p.id = e.project_id
    where p.organization_id in (select organization_id from sole) and e.data ? 'screenshot_raw_path';
end;
$$;

grant execute on function my_sole_organization_storage_paths() to authenticated;
