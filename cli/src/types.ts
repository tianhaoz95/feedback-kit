// Mirrors web/src/lib/types.ts — kept in sync by hand, same as the other
// wire-format duplications in this repo (see CLAUDE.md's note on
// FeedbackReport/IngestPayload). Only the fields the CLI/MCP tools actually
// use are included.

export type FeedbackStatus = "new" | "in_progress" | "resolved" | "wont_fix";

export interface Project {
  id: string;
  organization_id: string;
  name: string;
  project_key: string;
  created_at: string;
}

export interface PromptTemplate {
  id: string;
  project_id: string;
  template_text: string;
  updated_at: string;
}

export interface FeedbackEnvironment {
  osName: string;
  osVersion: string;
  deviceModel: string;
  appVersion: string;
  appBuild: string;
  bundleIdentifier: string;
  screenName?: string | null;
  locale: string;
  screenWidthPoints: number;
  screenHeightPoints: number;
  screenScale: number;
}

export interface FeedbackItem {
  id: string;
  project_id: string;
  text: string;
  /** Null if the user toggled the screenshot off before submitting. */
  screenshot_raw_path: string | null;
  screenshot_annotated_path: string | null;
  environment: FeedbackEnvironment;
  status: FeedbackStatus;
  edited_prompt: string | null;
  created_at: string;
  attachment_path: string | null;
  attachment_filename: string | null;
  attachment_mime_type: string | null;
}
