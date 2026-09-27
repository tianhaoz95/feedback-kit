import test from "node:test";
import assert from "node:assert/strict";
import { loopChecklist, stuckHint, type LoopSignals } from "./loopHealth.ts";

const none: LoopSignals = {
  hasReport: false,
  hasReporterId: false,
  project: { github_repo: null, github_installation_id: null, dispatch_labels: [], dispatch_comment: null, dispatch_copilot: false },
  hasAgentActivity: false,
  hasLinkedFix: false,
  hasRelease: false,
  hasVerified: false,
};

test("loopChecklist marks each step from its own signal", () => {
  assert.deepEqual(loopChecklist(none).map((s) => s.done), [false, false, false, false, false, false, false]);
  const steps = loopChecklist({
    ...none,
    hasReport: true,
    project: { ...none.project, github_repo: "a/b", github_installation_id: 1, dispatch_copilot: true },
    hasRelease: true,
  });
  assert.deepEqual(
    Object.fromEntries(steps.map((s) => [s.id, s.done])),
    { report: true, verification: false, github: true, agent: true, linked: false, announced: true, verified: false },
  );
});

const day = 24 * 3600_000;
const ev = (kind: string, ageDays: number, now: number) => ({ kind, created_at: new Date(now - ageDays * day).toISOString() }) as never;

test("stuckHint flags merged fixes no build has announced", () => {
  const now = Date.parse("2026-09-26T12:00:00Z");
  assert.equal(stuckHint({ fix_stage: "merged", shipped_at: null, reporter_id: "r" }, [ev("pr_merged", 1, now)], now), null);
  assert.match(stuckHint({ fix_stage: "merged", shipped_at: null, reporter_id: "r" }, [ev("pr_merged", 5, now)], now)!.message, /Merged 5d ago/);
});

test("stuckHint offers Mark verified for silent reporters and unreachable ones", () => {
  const now = Date.parse("2026-09-26T12:00:00Z");
  const shipped = new Date(now - 10 * day).toISOString();
  assert.equal(stuckHint({ fix_stage: "shipped", shipped_at: shipped, reporter_id: "r" }, [], now)!.offerMarkVerified, true);
  assert.equal(stuckHint({ fix_stage: "shipped", shipped_at: new Date(now - day).toISOString(), reporter_id: "r" }, [], now), null);
  assert.equal(stuckHint({ fix_stage: "shipped", shipped_at: new Date(now - day).toISOString(), reporter_id: null }, [], now)!.offerMarkVerified, true);
});

test("stuckHint flags an agent claim with no PR after a day", () => {
  const now = Date.parse("2026-09-26T12:00:00Z");
  assert.match(stuckHint({ fix_stage: "agent_working", shipped_at: null, reporter_id: null }, [ev("claimed", 2, now)], now)!.message, /2d ago/);
});
