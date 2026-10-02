import test from "node:test";
import assert from "node:assert/strict";
import {
  annualMonthsFree,
  formatUsd,
  INDIE_PRICE_ANNUAL_USD,
  INDIE_PRICE_MONTHLY_USD,
  reportUsageShare,
  trialDaysLeft,
  type OrganizationUsage,
} from "./pricing.ts";

test("annual Indie is cheaper than twelve months", () => {
  assert.ok(INDIE_PRICE_ANNUAL_USD < INDIE_PRICE_MONTHLY_USD * 12);
  assert.equal(annualMonthsFree(), 3);
});

test("formatUsd drops cents only for whole dollars", () => {
  assert.equal(formatUsd(60), "$60");
  assert.equal(formatUsd(12.5), "$12.50");
});

const usage: OrganizationUsage = {
  plan: "free",
  limited: true,
  reports_this_month: 40,
  projects: 1,
  members: 1,
  limits: { projects: 1, members: 1, reports_per_month: 50 },
};

test("reportUsageShare is 0 when unlimited and capped at 1", () => {
  assert.equal(reportUsageShare(usage), 0.8);
  assert.equal(reportUsageShare({ ...usage, reports_this_month: 70 }), 1);
  assert.equal(reportUsageShare({ ...usage, limited: false }), 0);
  assert.equal(reportUsageShare({ ...usage, limits: { ...usage.limits, reports_per_month: null } }), 0);
  assert.equal(reportUsageShare(null), 0);
});

test("trialDaysLeft only counts an unpaid organization's running trial", () => {
  const now = Date.parse("2026-10-01T00:00:00Z");
  const trial = { ...usage, plan: "indie" as const, limited: false, trial_ends_at: "2026-10-03T12:00:00Z" };
  assert.equal(trialDaysLeft(trial, "free", now), 3);
  assert.equal(trialDaysLeft(trial, "indie", now), null);
  assert.equal(trialDaysLeft({ ...trial, trial_ends_at: "2026-09-30T00:00:00Z" }, "free", now), null);
  assert.equal(trialDaysLeft(usage, "free", now), null);
});
