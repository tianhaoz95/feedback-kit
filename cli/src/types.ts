// Mirrors web/src/lib/types.ts — kept in sync by hand, same as the other
// wire-format duplications in this repo (see CLAUDE.md's note on
// FeedbackReport/IngestPayload). Only the fields the CLI/MCP tools actually
// use are included.

export type FeedbackStatus = "new" | "in_progress" | "resolved" | "wont_fix";

/** Where a report's fix is in the closed loop — see 0014_closed_loop.sql. Null = nothing yet. */
export type FixStage = "agent_working" | "pr_open" | "merged" | "shipped" | "verified" | "reopened";

export type FeedbackEventKind =
  | "comment"
  | "question"
  | "reporter_reply"
  | "claimed"
  | "dispatched"
  | "pr_opened"
  | "pr_merged"
  | "pr_closed"
  | "shipped"
  | "verified"
  | "reopened"
  | "status_changed"
  | "after_screenshot";

/** One row of a report's timeline (`feedback_events`). */
export interface FeedbackEvent {
  id: string;
  feedback_id: string;
  project_id: string;
  kind: FeedbackEventKind;
  actor_type: "user" | "agent" | "reporter" | "system" | "github";
  actor_user_id: string | null;
  actor_label: string | null;
  body: string | null;
  data: Record<string, unknown>;
  visible_to_reporter: boolean;
  created_at: string;
}

/** `FeedbackKit.setUser(...)` on the reporter's device, if the host app set it. */
export interface FeedbackReporter {
  id?: string;
  email?: string;
  name?: string;
}

export interface Project {
  id: string;
  organization_id: string;
  name: string;
  project_key: string;
  created_at: string;
  github_repo?: string | null;
  github_installation_id?: number | null;
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
  /** Web SDK only (see web/src/lib/types.ts). */
  platform?: "web";
  pageUrl?: string;
  userAgent?: string;
  browserName?: string;
  browserVersion?: string;
}

/** One console message / uncaught error / failed request captured by the web SDK. */
export interface FeedbackLogEntry {
  level: string;
  message: string;
  timestamp: string;
}

export interface Product {
  id: string;
  project_id: string;
  key: string;
  name: string;
  description: string;
  is_default: boolean;
  created_at: string;
}

export interface FeedbackProduct {
  key: string;
  name: string;
  description?: string;
  is_default?: boolean;
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
  is_archived?: boolean;
  edited_prompt: string | null;
  created_at: string;
  attachment_path: string | null;
  attachment_filename: string | null;
  attachment_mime_type: string | null;
  github_issue_url?: string | null;
  github_issue_number?: number | null;
  products?: FeedbackProduct[];
  product_keys?: string[];
  /** Web SDK reports only; `[]` otherwise. */
  logs?: FeedbackLogEntry[];
  // Closed loop (0014_closed_loop.sql).
  fix_stage?: FixStage | null;
  fix_pr_url?: string | null;
  fix_pr_number?: number | null;
  fix_commit_sha?: string | null;
  fix_summary?: string | null;
  fixed_in_build?: string | null;
  shipped_at?: string | null;
  verified_at?: string | null;
  reopen_count?: number;
  reporter_id?: string | null;
  reporter?: FeedbackReporter | null;
}
