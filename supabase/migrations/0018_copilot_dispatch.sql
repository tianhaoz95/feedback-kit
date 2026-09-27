-- Hand FeedbackKit issues to GitHub Copilot's coding agent.
--
-- Copilot starts when an issue is *assigned* to `copilot-swe-agent[bot]`, and
-- GitHub only accepts that assignment from a token acting as a user with a
-- Copilot seat (a PAT or a GitHub App user-to-server token) — never from the
-- installation token the rest of the GitHub integration uses. So a member
-- authorizes the FeedbackKit GitHub App once (github-user-auth Edge
-- Function), and create-github-issue assigns Copilot with *that member's*
-- token when they press "Send to agent". Copilot usage bills their seat.

alter table projects
  add column if not exists dispatch_copilot boolean not null default false;

-- One GitHub user token per dashboard user. Secrets: RLS is on with no
-- policies, so only the service role (Edge Functions) can read or write rows.
-- Members see their own connection through github_user_connection() below,
-- which never returns the tokens.
create table if not exists github_user_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  github_login text,
  access_token text not null,
  access_token_expires_at timestamptz,
  refresh_token text,
  refresh_token_expires_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table github_user_tokens enable row level security;

create or replace function github_user_connection()
returns table (github_login text, connected_at timestamptz, expired boolean)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  return query
    select t.github_login,
           t.updated_at,
           -- Unusable once the refresh token (or a non-expiring access token's
           -- absence of one) can no longer mint an access token.
           coalesce(t.refresh_token_expires_at < now(), false)
    from github_user_tokens t
    where t.user_id = auth.uid();
end;
$$;

create or replace function disconnect_github_user()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from github_user_tokens where user_id = auth.uid();
end;
$$;

grant execute on function github_user_connection() to authenticated;
grant execute on function disconnect_github_user() to authenticated;
