import test from "node:test";
import assert from "node:assert/strict";
import { computeRangeSelection } from "./rangeSelection.ts";

test("computeRangeSelection toggles an unselected item on when clicked without shift", () => {
  const visible = ["a", "b", "c", "d"];
  const res = computeRangeSelection(visible, null, "b", new Set(), false);
  assert.deepEqual(Array.from(res.nextSelectedIds), ["b"]);
  assert.equal(res.nextLastSelectedId, "b");
});

test("computeRangeSelection toggles an already selected item off when clicked without shift", () => {
  const visible = ["a", "b", "c", "d"];
  const res = computeRangeSelection(visible, "b", "b", new Set(["b"]), false);
  assert.deepEqual(Array.from(res.nextSelectedIds), []);
  assert.equal(res.nextLastSelectedId, "b");
});

test("computeRangeSelection selects forward range with shift key", () => {
  const visible = ["a", "b", "c", "d", "e"];
  const res = computeRangeSelection(visible, "b", "d", new Set(["b"]), true);
  assert.deepEqual(Array.from(res.nextSelectedIds).sort(), ["b", "c", "d"]);
  assert.equal(res.nextLastSelectedId, "d");
});

test("computeRangeSelection selects backward range with shift key", () => {
  const visible = ["a", "b", "c", "d", "e"];
  const res = computeRangeSelection(visible, "d", "b", new Set(["d"]), true);
  assert.deepEqual(Array.from(res.nextSelectedIds).sort(), ["b", "c", "d"]);
  assert.equal(res.nextLastSelectedId, "b");
});

test("computeRangeSelection deselects range when target item is already selected with shift key", () => {
  const visible = ["a", "b", "c", "d", "e"];
  const res = computeRangeSelection(visible, "b", "d", new Set(["a", "b", "c", "d", "e"]), true);
  assert.deepEqual(Array.from(res.nextSelectedIds).sort(), ["a", "e"]);
  assert.equal(res.nextLastSelectedId, "d");
});

test("computeRangeSelection falls back to normal toggle if lastSelectedId is not in visible items", () => {
  const visible = ["c", "d", "e"];
  const res = computeRangeSelection(visible, "a", "d", new Set(), true);
  assert.deepEqual(Array.from(res.nextSelectedIds), ["d"]);
  assert.equal(res.nextLastSelectedId, "d");
});

test("computeRangeSelection falls back to normal toggle if lastSelectedId is null with shift key", () => {
  const visible = ["a", "b", "c"];
  const res = computeRangeSelection(visible, null, "b", new Set(), true);
  assert.deepEqual(Array.from(res.nextSelectedIds), ["b"]);
  assert.equal(res.nextLastSelectedId, "b");
});
