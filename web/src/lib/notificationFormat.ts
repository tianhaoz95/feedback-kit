import type { AppNotification, NotificationKind } from "@/lib/types";

export const NOTIFICATION_KIND_LABEL: Record<NotificationKind, string> = {
  new_feedback: "New feedback",
  reporter_reply: "Reporter replies",
  reopened: "Reports reopened",
  verified: "Fixes verified",
  fix_merged: "Fixes merged",
  member_joined: "People joining",
};

/** Where clicking a notification goes. */
export function notificationHref(n: Pick<AppNotification, "kind" | "project_id" | "feedback_id">): string {
  if (n.project_id && n.feedback_id) return `/projects/${n.project_id}/feedback/${n.feedback_id}`;
  if (n.project_id) return `/projects/${n.project_id}`;
  if (n.kind === "member_joined") return "/team";
  return "/notifications";
}

/** "3m ago"-style relative time for notification lists. */
export function timeAgo(iso: string, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
