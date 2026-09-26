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
