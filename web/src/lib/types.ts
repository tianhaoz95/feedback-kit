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
  screenshot_raw_path: string;
  screenshot_annotated_path: string;
  annotations: FeedbackAnnotation[];
  environment: FeedbackEnvironment;
  status: FeedbackStatus;
  edited_prompt: string | null;
  created_at: string;
}
