// After-fix previews (0025_access_tokens_and_previews.sql): screenshots or
// short videos a coding agent attaches after fixing a report, stored as
// `after_screenshot` timeline events. Mirrored in the Portal's
// `PortalFeedbackEvent` (media fields) and `AfterPreviewRetention`.
import type { FeedbackEvent } from "@/lib/types";

/** Keep in step with previews_to_expire() in the migration. */
export const PREVIEW_RETENTION_DAYS = 14;

export interface AfterPreview {
  eventId: string;
  /** Storage path; null once the preview expired and its file was deleted. */
  path: string | null;
  mediaType: string;
  isVideo: boolean;
  caption: string | null;
  actor: string;
  createdAt: string;
  expiredAt: string | null;
  durationSeconds: number | null;
}

export function afterPreviews(events: FeedbackEvent[]): AfterPreview[] {
  return events
    .filter((e) => e.kind === "after_screenshot")
    .map((e) => {
      const data = e.data ?? {};
      const path = (data.media_path ?? data.screenshot_path ?? null) as string | null;
      const mediaType = (data.media_type as string | undefined) ?? "image/png";
      return {
        eventId: e.id,
        path,
        mediaType,
        isVideo: mediaType.startsWith("video/"),
        caption: e.body,
        actor: e.actor_label ?? (e.actor_type === "agent" ? "Coding agent" : "Your team"),
        createdAt: e.created_at,
        expiredAt: (data.expired_at as string | undefined) ?? null,
        durationSeconds: typeof data.duration_seconds === "number" ? data.duration_seconds : null,
      };
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** When a resolved report's previews are deleted, or null while it's unresolved. */
export function previewDeletionDate(resolvedAt: string | null | undefined): Date | null {
  if (!resolvedAt) return null;
  return new Date(new Date(resolvedAt).getTime() + PREVIEW_RETENTION_DAYS * 86400e3);
}

/** The note under a preview, so nobody is surprised when it disappears. */
export function previewRetentionNote(resolvedAt: string | null | undefined, now = new Date()): string {
  const deletion = previewDeletionDate(resolvedAt);
  if (!deletion) {
    return `Previews are kept until ${PREVIEW_RETENTION_DAYS} days after this report is resolved (at most 90 days).`;
  }
  const when = deletion.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return deletion.getTime() <= now.getTime()
    ? `Previews are deleted ${PREVIEW_RETENTION_DAYS} days after a report is resolved; this one's are due for deletion.`
    : `This report is resolved, so its previews are deleted on ${when} (${PREVIEW_RETENTION_DAYS} days after).`;
}
