-- Fixes "infinite recursion detected in policy for relation memberships",
-- surfaced as a 500 from PostgREST on any query touching `memberships`
-- (including indirectly, e.g. selecting `projects` via `auth_organization_ids()`).
--
-- `auth_organization_ids()` was `language sql`, a plain SQL-language
-- SECURITY DEFINER function. Postgres can inline simple SQL-language
-- functions into the calling query's plan as an optimization. Once inlined,
-- the function body's own `select ... from memberships` no longer runs in a
-- separate execution context under the function owner's BYPASSRLS privilege
-- — it becomes part of the caller's query, so it's subject to the very same
-- "members can read memberships in their orgs" policy that's calling this
-- function to evaluate itself, recursing forever.
--
-- PL/pgSQL functions are never inlined by the planner, so switching the
-- language (keeping the exact same SECURITY DEFINER/STABLE/search_path and
-- logic) makes the owner-privilege bypass actually take effect.
--
-- (This alone turned out not to be sufficient — see 0005, which fixes the
-- actual remaining cause.)
create or replace function auth_organization_ids()
returns setof uuid
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  return query select organization_id from memberships where user_id = auth.uid();
end;
$$;
