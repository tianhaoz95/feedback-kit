-- Two ways to deliver a fix, chosen per project (Settings → Delivery):
--
--   batch  (default; how every project worked before): agents may commit to
--          the default branch; a beta built from main ships every merged fix
--          in it; reporters verify; the team promotes the beta.
--   branch (verify before merge): agents always open a pull request; CI
--          builds a preview of the PR and ships its fixes to a `preview`
--          release (`feedbackkit release --channel preview --pr <n>`); the
--          report is verified on the preview (by the reporter, a tester or
--          the team); a "FeedbackKit" commit status on the PR goes green once
--          every linked report is verified, and branch protection can
--          require it before merging.
--
-- The PR's status is posted by the Edge Functions (supabase/functions/
-- _shared/prStatus.ts) — github-webhook, ci-release, reporter-updates and
-- pr-status — never from the database.

alter table projects
  add column if not exists delivery_mode text not null default 'batch'
  check (delivery_mode in ('batch', 'branch'));

alter table releases drop constraint if exists releases_channel_check;
alter table releases add constraint releases_channel_check check (channel in ('beta', 'production', 'preview'));

-- The pull request a preview release was built from.
alter table releases add column if not exists pr_number integer;

-- Same view as 0023, plus the PR a preview was built from.
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
  count(f.id) filter (where f.fix_stage = 'shipped' and f.reporter_id is not null and f.notify_reporter is distinct from false) as awaiting,
  count(f.id) filter (where f.fix_stage = 'shipped' and (f.reporter_id is null or f.notify_reporter = false)) as unreachable,
  r.pr_number
from releases r
left join feedback_items f
  on f.project_id = r.project_id and f.fixed_in_build = r.build
  and (r.product_key is null or f.product_keys = '{}' or r.product_key = any(f.product_keys))
group by r.id;
