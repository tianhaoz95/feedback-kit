import test from "node:test";
import assert from "node:assert/strict";
import { afterPreviews, previewDeletionDate, previewRetentionNote } from "./previews.ts";
import type { FeedbackEvent } from "./types.ts";

const event = (over: Partial<FeedbackEvent>): FeedbackEvent => ({
  id: "e",
  feedback_id: "f",
  project_id: "p",
  kind: "after_screenshot",
  actor_type: "agent",
  actor_user_id: null,
  actor_label: "claude-code",
  body: "After",
  data: {},
  visible_to_reporter: false,
  created_at: "2026-09-28T10:00:00Z",
  ...over,
});

test("reads images, videos, legacy PNGs and expired previews from the timeline", () => {
  const list = afterPreviews([
    event({ id: "v", created_at: "2026-09-28T11:00:00Z", data: { media_path: "p/f/after/2.mp4", media_type: "video/mp4", duration_seconds: 12 } }),
    event({ id: "legacy", data: { screenshot_path: "p/f/after/1.png" } }),
    event({ id: "gone", created_at: "2026-09-28T12:00:00Z", data: { media_type: "image/png", expired_at: "2026-10-20T00:00:00Z" } }),
    event({ id: "other", kind: "comment" }),
  ]);
  assert.deepEqual(list.map((p) => p.eventId), ["legacy", "v", "gone"]);
  assert.deepEqual([list[0].path, list[0].mediaType, list[0].isVideo], ["p/f/after/1.png", "image/png", false]);
  assert.deepEqual([list[1].isVideo, list[1].durationSeconds], [true, 12]);
  assert.deepEqual([list[2].path, list[2].expiredAt], [null, "2026-10-20T00:00:00Z"]);
});

test("explains retention", () => {
  assert.equal(previewDeletionDate(null), null);
  assert.equal(previewDeletionDate("2026-09-01T00:00:00Z")?.toISOString(), "2026-09-15T00:00:00.000Z");
  assert.match(previewRetentionNote(null), /kept until 14 days after this report is resolved/);
  assert.match(previewRetentionNote("2026-09-20T00:00:00Z", new Date("2026-09-28T00:00:00Z")), /deleted on/);
  assert.match(previewRetentionNote("2026-09-01T00:00:00Z", new Date("2026-09-28T00:00:00Z")), /due for deletion/);
});
