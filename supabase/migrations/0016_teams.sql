-- Teams: more than one person per organization, and more than one
-- organization per person.
--
-- The schema always allowed both (memberships is many-to-many, see
-- 0001_init.sql), but nothing could add a second member. This adds:
--
-- 1. Invitations. An owner creates one (optionally locked to an email
--    address) and shares its link; whoever opens it signs in and accepts.
--    There's no email delivery, so sharing the link is the owner's job.
--    Links are single-use and expire after 7 days.
-- 2. Member management through SECURITY DEFINER functions instead of the old
--    "owners can manage memberships" `for all` policy, so the rules live in
--    one place: only owners change roles or remove people, anyone can leave,
--    and an organization always keeps at least one owner.
-- 3. Creating, renaming and deleting organizations, for the dashboard's and
--    Portal's organization switcher.
-- 4. A `team` billing plan priced per member (seat), and a `seats` column the
--    Stripe webhook fills from the subscription quantity.
--
-- Every helper reads memberships through the PL/pgSQL functions from
-- 0004/0005 (or its own SECURITY DEFINER body), never a policy subquery on
-- memberships itself — see CLAUDE.md's note on RLS recursion.

-- ------------------------------------------------------------- organizations

alter table organizations
  add column if not exists created_by uuid references auth.users(id) on delete set null;

create policy "owners can rename their orgs"
  on organizations for update
  using (id in (select auth_owner_organization_ids()))
  with check (id in (select auth_owner_organization_ids()));

-- Membership writes now only happen inside the functions below (and the
-- sign-up trigger), so the broad owner policy goes. Members keep read access
-- through "members can read memberships in their orgs".
drop policy if exists "owners can manage memberships in their orgs" on memberships;

create or replace function is_org_owner(p_org_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  return exists (
    select 1 from memberships
    where organization_id = p_org_id and user_id = auth.uid() and role = 'owner'
  );
end;
$$;

create or replace function create_organization(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'name is required' using errcode = '22023';
  end if;

  insert into organizations (name, created_by) values (trim(p_name), auth.uid())
    returning id into v_org_id;
  insert into memberships (organization_id, user_id, role) values (v_org_id, auth.uid(), 'owner');
  return v_org_id;
end;
$$;

-- Deleting cascades to every project, report and screenshot path in it, so
-- the dashboard asks the owner to type the organization's name first. A
-- person always keeps at least one organization to land in.
create or replace function delete_organization(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_org_owner(p_org_id) then
    raise exception 'only an owner can delete an organization' using errcode = '42501';
  end if;
  if (select count(*) from memberships where user_id = auth.uid()) <= 1 then
    raise exception 'you can''t delete your only organization' using errcode = '22023';
  end if;
  delete from organizations where id = p_org_id;
end;
$$;

-- ------------------------------------------------------------------- members

-- Members plus the profile fields GitHub sign-in stores in auth.users, which
-- no client can read directly.
create or replace function organization_members(p_org_id uuid)
returns table (
  user_id uuid,
  role membership_role,
  joined_at timestamptz,
  email text,
  full_name text,
  user_name text,
  avatar_url text
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if p_org_id not in (select auth_organization_ids()) then
    raise exception 'organization not found or access denied' using errcode = '42501';
  end if;

  return query
    select
      m.user_id,
      m.role,
      m.created_at,
      u.email::text,
      coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'),
      coalesce(u.raw_user_meta_data->>'user_name', u.raw_user_meta_data->>'preferred_username'),
      u.raw_user_meta_data->>'avatar_url'
    from memberships m
    join auth.users u on u.id = m.user_id
    where m.organization_id = p_org_id
    order by (m.role = 'owner') desc, m.created_at;
end;
$$;

create or replace function update_member_role(p_org_id uuid, p_user_id uuid, p_role membership_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current membership_role;
begin
  if not is_org_owner(p_org_id) then
    raise exception 'only an owner can change roles' using errcode = '42501';
  end if;

  select role into v_current from memberships
    where organization_id = p_org_id and user_id = p_user_id
    for update;
  if v_current is null then
    raise exception 'that person isn''t a member of this organization' using errcode = '22023';
  end if;

  if v_current = 'owner' and p_role <> 'owner' and (
    select count(*) from memberships where organization_id = p_org_id and role = 'owner'
  ) <= 1 then
    raise exception 'an organization needs at least one owner' using errcode = '22023';
  end if;

  update memberships set role = p_role where organization_id = p_org_id and user_id = p_user_id;
end;
$$;

-- Owners can remove anyone; everyone can remove themselves (leave).
create or replace function remove_member(p_org_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role membership_role;
begin
  if p_user_id <> auth.uid() and not is_org_owner(p_org_id) then
    raise exception 'only an owner can remove other members' using errcode = '42501';
  end if;

  select role into v_role from memberships
    where organization_id = p_org_id and user_id = p_user_id
    for update;
  if v_role is null then
    raise exception 'that person isn''t a member of this organization' using errcode = '22023';
  end if;

  if v_role = 'owner' and (
    select count(*) from memberships where organization_id = p_org_id and role = 'owner'
  ) <= 1 then
    raise exception 'an organization needs at least one owner — make someone else an owner first'
      using errcode = '22023';
  end if;

  delete from memberships where organization_id = p_org_id and user_id = p_user_id;
end;
$$;

-- --------------------------------------------------------------- invitations

create table if not exists organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  -- When set, only a signed-in user with this email can accept.
  email text,
  role membership_role not null default 'member',
  -- The link's secret. Stored in plain text (unlike release tokens) so an
  -- owner can copy a pending link again; it's short-lived, single-use, and
  -- only owners can read it.
  token text not null unique default ('fki_' || encode(extensions.gen_random_bytes(24), 'hex')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz
);

create index if not exists organization_invitations_org_idx
  on organization_invitations (organization_id, created_at desc);

alter table organization_invitations enable row level security;

create policy "owners can read invitations"
  on organization_invitations for select
  using (organization_id in (select auth_owner_organization_ids()));

-- Inserts, revokes and accepts all go through the functions below.

create or replace function create_invitation(p_org_id uuid, p_email text default null, p_role membership_role default 'member')
returns organization_invitations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite organization_invitations;
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
begin
  if not is_org_owner(p_org_id) then
    raise exception 'only an owner can invite people' using errcode = '42501';
  end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'that doesn''t look like an email address' using errcode = '22023';
  end if;

  insert into organization_invitations (organization_id, email, role, created_by)
    values (p_org_id, v_email, coalesce(p_role, 'member'), auth.uid())
    returning * into v_invite;
  return v_invite;
end;
$$;

create or replace function revoke_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  select organization_id into v_org_id from organization_invitations where id = p_invitation_id;
  if v_org_id is null or not is_org_owner(v_org_id) then
    raise exception 'invitation not found or access denied' using errcode = '42501';
  end if;
  update organization_invitations set revoked_at = now()
    where id = p_invitation_id and accepted_at is null and revoked_at is null;
end;
$$;

-- What the invite page shows before (and after) sign-in. Knowing the token is
-- the capability, the same way project_key is for creating reports, so this
-- is callable without a session.
create or replace function get_invitation(p_token text)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_invite organization_invitations;
  v_org_name text;
  v_inviter text;
begin
  select * into v_invite from organization_invitations where token = p_token;
  if v_invite.id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  select name into v_org_name from organizations where id = v_invite.organization_id;
  select coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'user_name', email)
    into v_inviter from auth.users where id = v_invite.created_by;

  return jsonb_build_object(
    'status', case
      when v_invite.revoked_at is not null then 'revoked'
      when v_invite.accepted_at is not null then 'accepted'
      when v_invite.expires_at < now() then 'expired'
      else 'pending'
    end,
    'organization_id', v_invite.organization_id,
    'organization_name', v_org_name,
    'inviter_name', v_inviter,
    'role', v_invite.role,
    'email', v_invite.email,
    'expires_at', v_invite.expires_at,
    'already_member', auth.uid() is not null and exists (
      select 1 from memberships where organization_id = v_invite.organization_id and user_id = auth.uid()
    )
  );
end;
$$;

create or replace function accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite organization_invitations;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'sign in to accept this invitation' using errcode = '42501';
  end if;

  select * into v_invite from organization_invitations where token = p_token for update;
  if v_invite.id is null then
    raise exception 'this invitation link isn''t valid' using errcode = '22023';
  end if;

  -- Someone already in the organization just lands there; the link stays
  -- usable for the person it was meant for.
  if exists (select 1 from memberships where organization_id = v_invite.organization_id and user_id = auth.uid()) then
    return v_invite.organization_id;
  end if;

  if v_invite.revoked_at is not null then
    raise exception 'this invitation was revoked' using errcode = '22023';
  end if;
  if v_invite.accepted_at is not null then
    raise exception 'this invitation was already used' using errcode = '22023';
  end if;
  if v_invite.expires_at < now() then
    raise exception 'this invitation has expired — ask for a new link' using errcode = '22023';
  end if;

  if v_invite.email is not null then
    select lower(email) into v_email from auth.users where id = auth.uid();
    if v_email is distinct from v_invite.email then
      raise exception 'this invitation is for %, but you''re signed in as %', v_invite.email, coalesce(v_email, 'an account without an email')
        using errcode = '42501';
    end if;
  end if;

  insert into memberships (organization_id, user_id, role)
    values (v_invite.organization_id, auth.uid(), v_invite.role);
  update organization_invitations set accepted_at = now(), accepted_by = auth.uid()
    where id = v_invite.id;
  return v_invite.organization_id;
end;
$$;

-- ------------------------------------------------------------------- billing

-- Per-seat Team plan. `pro` stays in the enum for any row already using it.
alter type billing_plan add value if not exists 'team';

alter table organization_billing
  add column if not exists seats integer;

-- ------------------------------------------------------------------- grants

revoke all on function is_org_owner(uuid) from public;
revoke all on function create_organization(text) from public;
revoke all on function delete_organization(uuid) from public;
revoke all on function organization_members(uuid) from public;
revoke all on function update_member_role(uuid, uuid, membership_role) from public;
revoke all on function remove_member(uuid, uuid) from public;
revoke all on function create_invitation(uuid, text, membership_role) from public;
revoke all on function revoke_invitation(uuid) from public;
revoke all on function get_invitation(text) from public;
revoke all on function accept_invitation(text) from public;

grant execute on function is_org_owner(uuid) to authenticated;
grant execute on function create_organization(text) to authenticated;
grant execute on function delete_organization(uuid) to authenticated;
grant execute on function organization_members(uuid) to authenticated;
grant execute on function update_member_role(uuid, uuid, membership_role) to authenticated;
grant execute on function remove_member(uuid, uuid) to authenticated;
grant execute on function create_invitation(uuid, text, membership_role) to authenticated;
grant execute on function revoke_invitation(uuid) to authenticated;
grant execute on function get_invitation(text) to anon, authenticated;
grant execute on function accept_invitation(text) to authenticated;
