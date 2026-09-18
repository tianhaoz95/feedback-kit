-- 0004 wasn't sufficient: `memberships` also has a `for all` policy ("owners
-- can manage memberships in their orgs"), which applies to SELECT too (`for
-- all` covers every command), and its `using` clause queried `memberships`
-- directly with no SECURITY DEFINER indirection at all:
--
--   using (organization_id in (
--     select organization_id from memberships
--     where user_id = auth.uid() and role = 'owner'
--   ))
--
-- Postgres OR's every applicable policy together for a given command, so
-- this unprotected policy still gets evaluated — and recurses — on every
-- SELECT against `memberships`, regardless of 0004's fix to the other
-- policy. Give it the same safe-helper-function treatment.
create function auth_owner_organization_ids()
returns setof uuid
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  return query select organization_id from memberships where user_id = auth.uid() and role = 'owner';
end;
$$;

drop policy "owners can manage memberships in their orgs" on memberships;

create policy "owners can manage memberships in their orgs"
  on memberships for all
  using (organization_id in (select auth_owner_organization_ids()));
