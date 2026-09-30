-- Add 'backlog' value to feedback_status enum
-- Allows teams to triage feedback reports into a backlog when they are still needed
-- but not prioritized immediately.
alter type feedback_status add value if not exists 'backlog' after 'in_progress';
