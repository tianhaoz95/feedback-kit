-- Bookkeeping for CLI/MCP-server logins (see cli/ and web/src/pages/CliAuthPage.tsx).
--
-- The CLI authenticates with a real Supabase session (access + refresh
-- token), handed to it via a browser-based login page — it is not a
-- separate credential type, and RLS on every other table keeps working
-- unchanged. This table exists only so a user can see which CLIs/agents are
-- signed in and flip `revoked_at` on one from the dashboard.
--
-- Revocation here is cooperative, not cryptographic: the CLI checks its own
-- row's `revoked_at` (via this same RLS-protected read) before doing work
-- and deletes its local credentials if set. This is deliberate rather than
-- an oversight — Supabase's own admin API has the identical limitation
-- (revoking a refresh token doesn't invalidate an already-issued access
-- token before it expires), so a real server-side revoke would need to
-- persist the raw access token to force it, which is a bigger secret to
-- hold than the problem justifies. `auth.jwt_expiry` (1 hour, see
-- supabase/config.toml) bounds how stale that cooperative check can be.
create table cli_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- The `session_id` claim from the access token handed to the CLI, decoded
  -- client-side at authorize time — for display only, not used to enforce
  -- anything (see note above).
  session_id uuid,
  -- Human-readable label the CLI supplies (e.g. its hostname), so the
  -- dashboard can show "CLI on tianhaos-macbook" rather than a bare id.
  label text not null default 'CLI',
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index cli_sessions_user_id_idx on cli_sessions(user_id);

alter table cli_sessions enable row level security;

-- Direct `user_id = auth.uid()` checks, not a subquery through
-- auth_organization_ids() or another table — this is a user-owned-row
-- table, so there's no cross-table recursion risk to guard against here
-- (see CLAUDE.md's note on the memberships RLS recursion incident).
create policy "users can view their own cli sessions"
  on cli_sessions for select
  using (user_id = auth.uid());

create policy "users can create their own cli sessions"
  on cli_sessions for insert
  with check (user_id = auth.uid());

create policy "users can revoke their own cli sessions"
  on cli_sessions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
