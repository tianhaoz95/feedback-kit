-- Add archive support for feedback items and delete policy for screenshots/attachments.

alter table feedback_items
  add column if not exists is_archived boolean not null default false;

create index if not exists feedback_items_project_id_is_archived_idx
  on feedback_items(project_id, is_archived);

-- Allow organization members to delete screenshots and attachments for feedback in their orgs.
create policy "members can delete their org's screenshots"
  on storage.objects for delete
  using (
    bucket_id = 'feedback-screenshots'
    and try_cast_uuid((storage.foldername(name))[1]) in (
      select id from projects where organization_id in (select auth_organization_ids())
    )
  );
