-- Optional file attached from the report composer, separate from the
-- screenshot. Stored in the same `feedback-screenshots` bucket (under
-- `{project_id}/{feedback_id}/attachment/{filename}`) since the storage RLS
-- policy only keys off the first path segment (project_id), so no new
-- bucket/policy is needed.
alter table feedback_items
  add column attachment_path text,
  add column attachment_filename text,
  add column attachment_mime_type text;
