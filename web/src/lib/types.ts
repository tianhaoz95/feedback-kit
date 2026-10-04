export type FeedbackStatus = "new" | "in_progress" | "backlog" | "resolved" | "wont_fix";

/**
 * Where a report's fix is in the closed loop (report → agent → PR → release →
 * reporter verifies). Separate from `status` — see 0014_closed_loop.sql.
 * Null = nothing has happened yet.
 */
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
  | "fix_committed"
  | "shipped"
  | "verified"
  | "reopened"
  | "status_changed"
  | "after_screenshot"
  | "promoted";

/** One row of a report's timeline — mirrors `feedback_events` (0014_closed_loop.sql). */
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

/** `preview` = a build of one pull request, for branch delivery (0024_delivery_modes.sql). */
export type ReleaseChannel = "beta" | "production" | "preview";

/**
 * How a project delivers fixes (0024): `batch` = agents may push to main and
 * betas ship merged fixes; `branch` = agents open PRs, previews ship them, and
 * the PR's "FeedbackKit" check turns green once they're verified.
 */
export type DeliveryMode = "batch" | "branch";

/** Mirrors `releases` (0014 + 0015) — one per `feedbackkit release`. */
export interface Release {
  id: string;
  project_id: string;
  build: string;
  version: string | null;
  commit_sha: string | null;
  product_key: string | null;
  channel: ReleaseChannel;
  source: "cli" | "ci";
  promoted_at: string | null;
  created_at: string;
}

/** Mirrors the `release_readiness` view (0015): a release plus its fixes' verification state. */
export interface ReleaseReadiness {
  release_id: string;
  project_id: string;
  build: string;
  version: string | null;
  commit_sha: string | null;
  product_key: string | null;
  channel: ReleaseChannel;
  source: "cli" | "ci";
  created_at: string;
  promoted_at: string | null;
  fixes: number;
  verified: number;
  reopened: number;
  awaiting: number;
  /** Shipped fixes whose reports have no reporter id (older SDKs) — nobody will verify these on device. */
  unreachable: number;
  /** The pull request a preview release was built from. */
  pr_number?: number | null;
}

/** Mirrors `release_tokens` (0015). The token itself is never readable — only a prefix. */
/** `FeedbackKit.setUser(...)` from the reporter's app, if set. Opaque camelCase JSONB. */
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
  /** Web origins allowed to submit with this project's key; empty = any. See 0013_web_sdk.sql. */
  allowed_origins?: string[];
  /** Labels added to GitHub issues to trigger a coding agent (0014_closed_loop.sql). */
  dispatch_labels?: string[];
  /** Comment posted on new GitHub issues to trigger a coding agent, e.g. "@claude fix this". */
  dispatch_comment?: string | null;
  /** Assign new GitHub issues to Copilot's coding agent, as the member who sends them (0018_copilot_dispatch.sql). */
  dispatch_copilot?: boolean;
  delivery_mode?: DeliveryMode;
}

export interface PromptTemplate {
  id: string;
  project_id: string;
  template_text: string;
  updated_at: string;
}

/**
 * A 0...1-normalized point, stored as `[x, y]` — that's how Swift's `CGPoint`
 * encodes through `Codable`, and the web SDK matches it.
 */
export type NormalizedPoint = [number, number];

export interface FeedbackAnnotation {
  kind: "rectangle" | "arrow" | "freehand" | "text";
  points: NormalizedPoint[];
  colorHex: string;
  label?: string;
  /** Uniform scale around the shape's center (rectangle/arrow) or font size
   * (text), set via a two-finger pinch in the SDK's drag tool. Defaults to 1. */
  scale?: number;
  /** Rotation in radians around the shape's center (rectangle/arrow only),
   * set via a two-finger twist in the SDK's drag tool. Defaults to 0. */
  rotation?: number;
}

/**
 * Mirrors `FeedbackEnvironment` in the Swift SDK (Sources/FeedbackKit/Model/FeedbackReport.swift)
 * and the web SDK (web-sdk/src/types.ts). The trailing optional fields are
 * set only by the web SDK.
 */
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
  /** `"web"` for web SDK reports; unset for native ones (infer from `osName`). */
  platform?: "web";
  pageUrl?: string;
  userAgent?: string;
  browserName?: string;
  browserVersion?: string;
  /** Web SDK inside a desktop shell: "tauri" or "electron". Unset in a browser. */
  runtime?: string;
  runtimeVersion?: string;
}

/** One console message / uncaught error / failed request captured by the web SDK. */
export interface FeedbackLogEntry {
  level: "log" | "info" | "warn" | "error" | "debug" | "network";
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
  /** Null if the user toggled the screenshot off before submitting, or once the Free plan's retention removed it. */
  screenshot_raw_path: string | null;
  screenshot_annotated_path: string | null;
  /** When the Free plan's retention deleted this report's screenshots and attachment (0028). */
  media_expired_at?: string | null;
  annotations: FeedbackAnnotation[];
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
  /** Web SDK reports only; `[]` otherwise. See 0013_web_sdk.sql. */
  logs?: FeedbackLogEntry[];
  received_at?: string;
  // Closed loop (0014_closed_loop.sql).
  fix_stage?: FixStage | null;
  fix_pr_url?: string | null;
  fix_pr_number?: number | null;
  fix_commit_sha?: string | null;
  fix_summary?: string | null;
  fixed_in_build?: string | null;
  shipped_at?: string | null;
  verified_at?: string | null;
  /** When it was verified or its status became resolved/wont_fix (0025); previews are deleted 14 days later. */
  resolved_at?: string | null;
  reopen_count?: number;
  /** Anonymous per-install id — present means the reporter's device can be asked "is it fixed?". */
  reporter_id?: string | null;
  /**
   * The reporter's "Notify me when it's fixed" choice (0023). false = they
   * won't be shown fix updates or questions; null = sent by an SDK before the
   * option existed, which keeps the old behavior (they're asked).
   */
  notify_reporter?: boolean | null;
  reporter?: FeedbackReporter | null;
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

/**
 * `indie` is the self-serve paid plan (0028_indie_pricing.sql); `team` is a
 * larger team's custom deal, and `pro` predates both (0016_teams.sql).
 */
export type BillingPlan = "free" | "indie" | "pro" | "team";

/** Mirrors Stripe's own subscription statuses, plus "none" — see supabase/migrations/0009_billing.sql. */
export type BillingStatus =
  | "none"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete"
  | "incomplete_expired";

/** Mirrors supabase/migrations/0009_billing.sql. Always exists (one row per organization,
 * created by a trigger the moment the organization is), so there's no "no row yet" case to handle. */
export interface OrganizationBilling {
  organization_id: string;
  plan: BillingPlan;
  status: BillingStatus;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  /** Legacy per-seat quantity (0016); plans are flat now, so new subscriptions leave it null. */
  seats: number | null;
  /** End of the Indie trial every new organization starts with (0028); null for older ones. */
  trial_ends_at: string | null;
  /** Exempt from every plan limit (0019), e.g. the team's own dogfood organization. */
  limits_exempt?: boolean;
  updated_at: string;
}

export type MembershipRole = "owner" | "member";

/** An organization the signed-in user belongs to, with their role in it. */
export interface OrganizationSummary {
  id: string;
  name: string;
  role: MembershipRole;
}

/** A row from the `organization_members` RPC (0016_teams.sql). */
export interface OrganizationMember {
  user_id: string;
  role: MembershipRole;
  joined_at: string;
  email: string | null;
  full_name: string | null;
  user_name: string | null;
  avatar_url: string | null;
}

/** Mirrors `organization_invitations` (0016_teams.sql); readable by owners only. */
export interface OrganizationInvitation {
  id: string;
  organization_id: string;
  email: string | null;
  role: MembershipRole;
  token: string;
  created_by: string | null;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
  revoked_at: string | null;
}

/** What `get_invitation` returns for the invite page. */
export interface InvitationPreview {
  status: "pending" | "expired" | "revoked" | "accepted" | "not_found";
  organization_id?: string;
  organization_name?: string;
  inviter_name?: string | null;
  role?: MembershipRole;
  email?: string | null;
  expires_at?: string;
  already_member?: boolean;
}

/** Mirrors `notifications.kind` (0017_notifications.sql). */
export type NotificationKind =
  | "new_feedback"
  | "reporter_reply"
  | "reopened"
  | "verified"
  | "fix_merged"
  | "member_joined"
  /** A step on a report you watch (0023_notify_and_watchlist.sql). */
  | "watched_update";

export interface AppNotification {
  id: string;
  user_id: string;
  organization_id: string;
  project_id: string | null;
  feedback_id: string | null;
  kind: NotificationKind;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  created_at: string;
  read_at: string | null;
}

export interface NotificationPreferences {
  user_id: string;
  muted_kinds: NotificationKind[];
  push_enabled: boolean;
  updated_at: string;
}
