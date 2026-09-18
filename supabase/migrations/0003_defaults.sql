-- Every project gets a sensible default prompt template so the "copy for
-- coding agent" feature works immediately, before a developer has ever
-- touched the template editor.

create function create_default_prompt_template()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into prompt_templates (project_id, template_text) values (
    new.id,
    E'You are fixing an issue reported by a real user of this app. If it reads as a feature request rather than a bug, implement the requested behavior instead.\n\n'
    || E'## User''s report\n{{feedback_text}}\n\n'
    || E'## Screen\n{{screen_name}}\n\n'
    || E'## Environment\n- OS: {{os_name}} {{os_version}}\n- Device: {{device_model}}\n- App version: {{app_version}} ({{app_build}})\n- Locale: {{locale}}\n\n'
    || E'## Screenshot\nAn annotated screenshot highlighting the issue is at: {{screenshot_url}}\n\n'
    || E'## Task\nInvestigate the code for the "{{screen_name}}" screen, identify the root cause, and implement a minimal, style-consistent fix.'
  );
  return new;
end;
$$;

create trigger on_project_created
  after insert on projects
  for each row execute function create_default_prompt_template();
