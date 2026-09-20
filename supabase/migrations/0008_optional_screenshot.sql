-- The SDK now lets the user toggle the screenshot off before submitting (an
-- "include screenshot" switch in the iOS/macOS annotate UI, for reports that
-- are pure description). Both path columns become optional to allow that.
alter table feedback_items alter column screenshot_raw_path drop not null;
alter table feedback_items alter column screenshot_annotated_path drop not null;
