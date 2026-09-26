import test from "node:test";
import assert from "node:assert/strict";
import { verdictFor } from "./releaseVerdict.ts";

const beta = { channel: "beta" as const, promoted_at: null };

test("a reopened fix blocks promotion", () => {
  assert.equal(verdictFor({ ...beta, fixes: 3, verified: 2, reopened: 1, awaiting: 0 }).tone, "red");
});

test("unverified fixes mean waiting on reporters", () => {
  const v = verdictFor({ ...beta, fixes: 3, verified: 1, reopened: 0, awaiting: 2 });
  assert.equal(v.tone, "amber");
  assert.equal(v.label, "1/3 verified");
});

test("all verified is ready", () => {
  assert.equal(verdictFor({ ...beta, fixes: 2, verified: 2, reopened: 0, awaiting: 0 }).tone, "green");
});

test("a build with no fixes and production builds are neutral", () => {
  assert.equal(verdictFor({ ...beta, fixes: 0, verified: 0, reopened: 0, awaiting: 0 }).tone, "neutral");
  assert.equal(
    verdictFor({ channel: "production", promoted_at: "2026-09-26T00:00:00Z", fixes: 1, verified: 1, reopened: 0, awaiting: 0 }).tone,
    "neutral",
  );
});
