import test from "node:test";
import assert from "node:assert/strict";
import { expiryDate, liveRunTokens, suggestedSecret, tokenState, type AccessToken } from "./accessTokens.ts";

const now = new Date("2026-09-28T12:00:00Z");
const token = (over: Partial<AccessToken>): AccessToken => ({
  id: "t",
  project_id: "p",
  name: "n",
  token_prefix: "fkt_1234",
  scopes: ["feedback:read"],
  expires_at: null,
  parent_id: null,
  feedback_id: null,
  created_at: now.toISOString(),
  last_used_at: null,
  revoked_at: null,
  ...over,
});

test("computes expiry from the picker", () => {
  assert.equal(expiryDate("never", now), null);
  assert.equal(expiryDate("30", now)?.toISOString(), "2026-10-28T12:00:00.000Z");
});

test("knows revoked and expired tokens", () => {
  assert.equal(tokenState(token({}), now), "active");
  assert.equal(tokenState(token({ revoked_at: now.toISOString() }), now), "revoked");
  assert.equal(tokenState(token({ expires_at: "2026-09-28T11:59:00Z" }), now), "expired");
  assert.equal(tokenState(token({ expires_at: "2026-09-28T12:01:00Z" }), now), "active");
});

test("counts a parent's live run tokens", () => {
  const tokens = [
    token({ id: "a", parent_id: "p1", expires_at: "2026-09-28T13:00:00Z" }),
    token({ id: "b", parent_id: "p1", expires_at: "2026-09-28T11:00:00Z" }),
    token({ id: "c", parent_id: "p2", expires_at: "2026-09-28T13:00:00Z" }),
  ];
  assert.equal(liveRunTokens(tokens, "p1", now), 1);
});

test("suggests the secret the workflows read", () => {
  assert.equal(suggestedSecret(["releases:write"]), "FEEDBACKKIT_RELEASE_TOKEN");
  assert.equal(suggestedSecret(["feedback:read", "tokens:issue"]), "FEEDBACKKIT_AGENT_TOKEN");
  assert.equal(suggestedSecret(["feedback:read"]), "FEEDBACKKIT_TOKEN");
});
