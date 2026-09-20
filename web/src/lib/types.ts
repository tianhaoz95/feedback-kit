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

export interface FeedbackAnnotation {
  kind: "rectangle" | "arrow" | "freehand" | "text";
  points: { x: number; y: number }[];
  colorHex: string;
  label?: string;
  /** Uniform scale around the shape's center (rectangle/arrow) or font size
   * (text), set via a two-finger pinch in the SDK's drag tool. Defaults to 1. */
  scale?: number;
  /** Rotation in radians around the shape's center (rectangle/arrow only),
   * set via a two-finger twist in the SDK's drag tool. Defaults to 0. */
  rotation?: number;
}

/** Mirrors `FeedbackEnvironment` in the iOS SDK (Sources/FeedbackKit/Model/FeedbackReport.swift). */
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
  annotations: FeedbackAnnotation[];
  environment: FeedbackEnvironment;
  status: FeedbackStatus;
  edited_prompt: string | null;
  created_at: string;
  attachment_path: string | null;
  attachment_filename: string | null;
  attachment_mime_type: string | null;
}

/** Mirrors supabase/migrations/0007_cli_sessions.sql. */
export interface CliSession {
  id: string;
  user_id: string;
  session_id: string | null;
  label: string;
  created_at: string;
  revoked_at: string | null;
}
