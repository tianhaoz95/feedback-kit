-- "Mark verified" (web/src/components/FixLoopPanel.tsx) lets a teammate
-- close a shipped fix the reporter can't or won't confirm. It records a
-- `verified` event as that user, so the notification must not claim the
-- reporter confirmed it. Same function as 0017, one case changed.

create or replace function notify_feedback_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text;
  v_title text;
  v_project projects;
  v_text text;
  v_body text;
begin
  case new.kind
    when 'reporter_reply' then v_kind := 'reporter_reply'; v_title := 'The reporter replied';
    when 'reopened' then v_kind := 'reopened'; v_title := 'Reporter says it''s still broken';
    when 'verified' then
      v_kind := 'verified';
      -- A teammate's "Mark verified" (FixLoopPanel) isn't the reporter's word.
      v_title := case when new.actor_type = 'reporter' then 'Reporter confirmed the fix' else 'Fix marked verified' end;
    when 'pr_merged' then v_kind := 'fix_merged'; v_title := 'Fix merged';
    when 'fix_committed' then v_kind := 'fix_merged'; v_title := 'Fix committed';
    else return new;
  end case;

  select * into v_project from projects where id = new.project_id;
  select text into v_text from feedback_items where id = new.feedback_id;
  if v_project.id is null then
    return new;
  end if;

  v_body := case
    when new.kind = 'reporter_reply' and coalesce(trim(new.body), '') <> '' then feedback_snippet(new.body)
    else feedback_snippet(v_text)
  end;

  perform notify_org_members(
    v_project.organization_id, v_project.id, new.feedback_id, v_kind,
    v_title || ' · ' || v_project.name,
    v_body,
    new.actor_user_id
  );
  return new;
end;
$$;
