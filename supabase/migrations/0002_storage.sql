-- Screenshot storage. Objects are stored at
-- `{project_id}/{feedback_id}/raw.png` and `{project_id}/{feedback_id}/annotated.png`.
-- The ingestion edge function writes here using the service-role key (bypasses
-- RLS, since the uploader is an anonymous iOS device, not a dashboard user).
-- The dashboard reads via short-lived signed URLs, gated by this policy so a
-- developer can only ever sign URLs for their own org's screenshots.

insert into storage.buckets (id, name, public)
values ('feedback-screenshots', 'feedback-screenshots', false)
on conflict (id) do nothing;

-- Postgres does not guarantee left-to-right short-circuiting of `and` in a
-- policy's USING clause, so casting the folder name to uuid inline could
-- throw on rows from an unrelated bucket with a non-uuid path. This wraps the
-- cast so a non-uuid folder name just fails to match instead of erroring.
create function try_cast_uuid(value text)
returns uuid
language plpgsql
immutable
as $$
begin
  return value::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

create policy "members can read their org's screenshots"
  on storage.objects for select
  using (
    bucket_id = 'feedback-screenshots'
    and try_cast_uuid((storage.foldername(name))[1]) in (
      select id from projects where organization_id in (select auth_organization_ids())
    )
  );
