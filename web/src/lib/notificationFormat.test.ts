import test from "node:test";
import assert from "node:assert/strict";
import { notificationHref, timeAgo } from "./notificationFormat.ts";

test("notificationHref opens the report when there is one", () => {
  assert.equal(notificationHref({ kind: "reopened", project_id: "p1", feedback_id: "f1" }), "/projects/p1/feedback/f1");
});

test("notificationHref falls back to the project, then the team page", () => {
  assert.equal(notificationHref({ kind: "new_feedback", project_id: "p1", feedback_id: null }), "/projects/p1");
  assert.equal(notificationHref({ kind: "member_joined", project_id: null, feedback_id: null }), "/team");
});

test("timeAgo uses short relative units", () => {
  const now = Date.parse("2026-09-26T12:00:00Z");
  assert.equal(timeAgo("2026-09-26T11:59:30Z", now), "just now");
  assert.equal(timeAgo("2026-09-26T11:55:00Z", now), "5m ago");
  assert.equal(timeAgo("2026-09-26T09:00:00Z", now), "3h ago");
  assert.equal(timeAgo("2026-09-24T12:00:00Z", now), "2d ago");
});
