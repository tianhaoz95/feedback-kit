import { describe, expect, it } from "vitest";
import {
  arrowGeometry,
  distanceToSegment,
  hitTest,
  normalizeColor,
  readPoint,
  rectangleCorners,
  textBubbleRect,
  type TextMeasurer,
} from "../src/renderer";
import type { FeedbackAnnotation } from "../src/types";

/** Deterministic stand-in for canvas text metrics: 8px per character at scale 1. */
const measurer: TextMeasurer = {
  font: "",
  measureText(text: string) {
    const size = Number(/(\d+(?:\.\d+)?)px/.exec(this.font)?.[1] ?? 16);
    return { width: text.length * size * 0.5 };
  },
};

const size = { width: 400, height: 800 };

function annotation(partial: Partial<FeedbackAnnotation>): FeedbackAnnotation {
  return { kind: "rectangle", points: [], colorHex: "#FF3B30", scale: 1, rotation: 0, ...partial };
}

describe("rectangleCorners (ported from AnnotationRendererTests.swift)", () => {
  it("centers an unrotated rectangle on its center", () => {
    const corners = rectangleCorners({ x: 100, y: 100 }, 40, 20, 0);
    expect(corners).toEqual([
      { x: 60, y: 80 },
      { x: 140, y: 80 },
      { x: 140, y: 120 },
      { x: 60, y: 120 },
    ]);
  });

  it("rotating 90° swaps width and height", () => {
    const corners = rectangleCorners({ x: 0, y: 0 }, 40, 10, Math.PI / 2);
    const xs = corners.map((c) => c.x);
    const ys = corners.map((c) => c.y);
    expect((Math.max(...xs) - Math.min(...xs)) / 2).toBeCloseTo(10, 2);
    expect((Math.max(...ys) - Math.min(...ys)) / 2).toBeCloseTo(40, 2);
  });
});

describe("arrowGeometry", () => {
  it("keeps endpoints for scale 1 / rotation 0 and puts the head behind the tip", () => {
    const g = arrowGeometry({ x: 0, y: 0 }, { x: 100, y: 0 });
    expect(g.start).toEqual({ x: 0, y: 0 });
    expect(g.end).toEqual({ x: 100, y: 0 });
    expect(g.left.x).toBeLessThan(100);
    expect(g.right.x).toBeLessThan(100);
    expect(g.left.y).toBeCloseTo(-g.right.y, 6);
  });

  it("scales around the midpoint", () => {
    const g = arrowGeometry({ x: 0, y: 0 }, { x: 100, y: 0 }, 2);
    expect(g.start.x).toBeCloseTo(-50);
    expect(g.end.x).toBeCloseTo(150);
  });
});

describe("hitTest", () => {
  it("grabs a rectangle inside its tolerance-padded box", () => {
    const rect = annotation({ kind: "rectangle", points: [[0.25, 0.25], [0.5, 0.5]] });
    expect(hitTest(rect, { x: 150, y: 300 }, size, measurer)).toBe(true);
    expect(hitTest(rect, { x: 100 - 10, y: 200 }, size, measurer)).toBe(true);
    expect(hitTest(rect, { x: 100 - 30, y: 200 }, size, measurer)).toBe(false);
  });

  it("grabs an arrow near its shaft only", () => {
    const arrow = annotation({ kind: "arrow", points: [[0, 0.5], [1, 0.5]] });
    expect(hitTest(arrow, { x: 200, y: 410 }, size, measurer)).toBe(true);
    expect(hitTest(arrow, { x: 200, y: 450 }, size, measurer)).toBe(false);
  });

  it("grabs text within its bubble", () => {
    const text = annotation({ kind: "text", points: [[0.1, 0.1]], label: "hello" });
    expect(hitTest(text, { x: 50, y: 90 }, size, measurer)).toBe(true);
    expect(hitTest(text, { x: 300, y: 90 }, size, measurer)).toBe(false);
  });

  it("never grabs freehand strokes (same as native)", () => {
    const stroke = annotation({ kind: "freehand", points: [[0.5, 0.5], [0.6, 0.6]] });
    expect(hitTest(stroke, { x: 200, y: 400 }, size, measurer)).toBe(false);
  });
});

describe("helpers", () => {
  it("text bubble grows with scale", () => {
    const small = textBubbleRect(measurer, "abc", { x: 0, y: 0 }, 1);
    const big = textBubbleRect(measurer, "abc", { x: 0, y: 0 }, 2);
    expect(big.width).toBeCloseTo(small.width * 2);
    expect(big.height).toBeCloseTo(small.height * 2);
  });

  it("reads both the [x, y] wire shape and {x, y}", () => {
    expect(readPoint([0.1, 0.2])).toEqual({ x: 0.1, y: 0.2 });
    expect(readPoint({ x: 0.3, y: 0.4 })).toEqual({ x: 0.3, y: 0.4 });
    expect(readPoint(null)).toEqual({ x: 0, y: 0 });
  });

  it("falls back to red for malformed colors", () => {
    expect(normalizeColor("#34C759")).toBe("#34C759");
    expect(normalizeColor("34C759FF")).toBe("#34C759FF");
    expect(normalizeColor("nope")).toBe("#FF0000");
  });

  it("measures distance to a segment, clamped to its ends", () => {
    expect(distanceToSegment({ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(5);
    expect(distanceToSegment({ x: -3, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(5);
  });
});
