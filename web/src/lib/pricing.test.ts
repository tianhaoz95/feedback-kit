import test from "node:test";
import assert from "node:assert/strict";
import { billableSeats, formatUsd, teamMonthlyTotal, TEAM_PRICE_PER_SEAT_USD } from "./pricing.ts";

test("team pricing charges one seat per member", () => {
  assert.equal(teamMonthlyTotal(1), TEAM_PRICE_PER_SEAT_USD);
  assert.equal(teamMonthlyTotal(4), 4 * TEAM_PRICE_PER_SEAT_USD);
});

test("team pricing never bills fewer than one seat", () => {
  assert.equal(billableSeats(0), 1);
  assert.equal(billableSeats(-3), 1);
});

test("formatUsd drops cents only for whole dollars", () => {
  assert.equal(formatUsd(60), "$60");
  assert.equal(formatUsd(12.5), "$12.50");
});

test("reportUsageShare is 0 when unlimited and capped at 1", async () => {
  const { reportUsageShare } = await import("./pricing.ts");
  const usage = { limited: true, reports_this_month: 40, projects: 1, members: 1, limits: { projects: 1, members: 3, reports_per_month: 50 } };
  assert.equal(reportUsageShare(usage), 0.8);
  assert.equal(reportUsageShare({ ...usage, reports_this_month: 70 }), 1);
  assert.equal(reportUsageShare({ ...usage, limited: false }), 0);
  assert.equal(reportUsageShare(null), 0);
});
