-- GitHub App integration: store connected GitHub repository and installation ID on projects,
-- and store converted GitHub issue URLs and issue numbers on feedback_items.

alter table projects
  add column if not exists github_repo text,
  add column if not exists github_installation_id bigint;

alter table feedback_items
  add column if not exists github_issue_url text,
  add column if not exists github_issue_number integer;
