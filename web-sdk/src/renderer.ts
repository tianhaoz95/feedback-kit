import type { FeedbackAnnotation, NormalizedPoint } from "./types";

/**
 * Canvas port of the Swift SDK's `AnnotationRenderer`
 * (Sources/FeedbackKit/Annotation/AnnotationRenderer.swift). Same stroke
 * width, arrowhead geometry, text-bubble metrics, scale/rotation math and
 * hit-testing, so a report annotated in a browser renders the same way a
 * native one does — and the dashboard can use this one file to redraw
 * annotations from any platform on top of the raw screenshot.
 *
 * All sizes are in the *target's* coordinate space (CSS pixels on the web,
 * points on iOS/macOS); callers scale the context for device pixels.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

/** Anything with `measureText` — lets hit-testing run without a real canvas in tests. */
export interface TextMeasurer {
  font: string;
  measureText(text: string): { width: number };
}

export const STROKE_WIDTH = 4;
export const HIT_TEST_TOLERANCE = 16;
const HEAD_LENGTH = 18;
const HEAD_ANGLE = Math.PI / 7;
const BASE_FONT_SIZE = 16;
const TEXT_PADDING = 8;
/** UIFont.boldSystemFont's line height is ~1.19× its point size; match it so bubbles are the same height. */
const LINE_HEIGHT_RATIO = 1.19;
const FALLBACK_COLOR = "#FF0000";

export function textFont(scale = 1): string {
  return `bold ${BASE_FONT_SIZE * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`;
}

/** Accepts both the `[x, y]` wire shape and a legacy/defensive `{x, y}` object. */
export function readPoint(p: NormalizedPoint | Point | unknown): Point {
  if (Array.isArray(p)) return { x: Number(p[0]) || 0, y: Number(p[1]) || 0 };
  if (p && typeof p === "object") {
    const o = p as Record<string, unknown>;
    return { x: Number(o.x) || 0, y: Number(o.y) || 0 };
  }
  return { x: 0, y: 0 };
}

export function denormalize(annotation: FeedbackAnnotation, size: Size): Point[] {
  return (annotation.points ?? []).map((p) => {
    const { x, y } = readPoint(p);
    return { x: x * size.width, y: y * size.height };
  });
}

export function normalizeColor(hex: string | undefined): string {
  if (!hex) return FALLBACK_COLOR;
  const cleaned = hex.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{6}$/.test(cleaned) || /^[0-9a-fA-F]{8}$/.test(cleaned)) return `#${cleaned}`;
  return FALLBACK_COLOR;
}

export function drawAnnotations(
  ctx: CanvasRenderingContext2D,
  annotations: readonly FeedbackAnnotation[],
  size: Size,
): void {
  for (const annotation of annotations) drawAnnotation(ctx, annotation, size);
}

export function drawAnnotation(ctx: CanvasRenderingContext2D, annotation: FeedbackAnnotation, size: Size): void {
  const color = normalizeColor(annotation.colorHex);
  const points = denormalize(annotation, size);
  const scale = annotation.scale ?? 1;
  const rotation = annotation.rotation ?? 0;

  switch (annotation.kind) {
    case "freehand":
      drawFreehand(ctx, points, color);
      break;
    case "rectangle":
      if (points.length === 2) drawRectangle(ctx, points[0], points[1], color, scale, rotation);
      break;
    case "arrow":
      if (points.length === 2) drawArrow(ctx, points[0], points[1], color, scale, rotation);
      break;
    case "text":
      if (points.length >= 1 && annotation.label) drawText(ctx, annotation.label, points[0], color, scale);
      break;
  }
}

function drawFreehand(ctx: CanvasRenderingContext2D, points: Point[], color: string): void {
  if (points.length === 0) return;
  ctx.save();
  ctx.lineWidth = STROKE_WIDTH;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  // A single tap still leaves a visible dot, like a zero-length CGPath stroke with round caps.
  if (points.length === 1) ctx.lineTo(points[0].x + 0.01, points[0].y);
  for (const p of points.slice(1)) ctx.lineTo(p.x, p.y);
  ctx.stroke();
  ctx.restore();
}

function drawRectangle(
  ctx: CanvasRenderingContext2D,
  start: Point,
  end: Point,
  color: string,
  scale: number,
  rotation: number,
): void {
  const center = midpoint(start, end);
  const corners = rectangleCorners(
    center,
    (Math.abs(end.x - start.x) / 2) * scale,
    (Math.abs(end.y - start.y) / 2) * scale,
    rotation,
  );
  ctx.save();
  ctx.lineWidth = STROKE_WIDTH;
  ctx.lineJoin = "miter";
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (const c of corners.slice(1)) ctx.lineTo(c.x, c.y);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  rawStart: Point,
  rawEnd: Point,
  color: string,
  scale: number,
  rotation: number,
): void {
  const { start, end, left, right } = arrowGeometry(rawStart, rawEnd, scale, rotation);
  ctx.save();
  ctx.lineWidth = STROKE_WIDTH;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.lineTo(left.x, left.y);
  ctx.moveTo(end.x, end.y);
  ctx.lineTo(right.x, right.y);
  ctx.stroke();
  ctx.restore();
}

export function arrowGeometry(rawStart: Point, rawEnd: Point, scale = 1, rotation = 0) {
  const center = midpoint(rawStart, rawEnd);
  const start = rotate(scaled(rawStart, scale, center), rotation, center);
  const end = rotate(scaled(rawEnd, scale, center), rotation, center);
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const left = {
    x: end.x - HEAD_LENGTH * Math.cos(angle - HEAD_ANGLE),
    y: end.y - HEAD_LENGTH * Math.sin(angle - HEAD_ANGLE),
  };
  const right = {
    x: end.x - HEAD_LENGTH * Math.cos(angle + HEAD_ANGLE),
    y: end.y - HEAD_LENGTH * Math.sin(angle + HEAD_ANGLE),
  };
  return { start, end, left, right };
}

function drawText(ctx: CanvasRenderingContext2D, text: string, point: Point, color: string, scale: number): void {
  const rect = textBubbleRect(ctx, text, point, scale);
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  roundedRectPath(ctx, rect.x, rect.y, rect.width, rect.height, 8);
  ctx.fill();
  ctx.font = textFont(scale);
  ctx.fillStyle = "#FFFFFF";
  ctx.textBaseline = "top";
  // Matches Swift, which insets by the *unscaled* padding when drawing but
  // sizes the bubble with the scaled one.
  ctx.fillText(text, rect.x + TEXT_PADDING, rect.y + TEXT_PADDING + (BASE_FONT_SIZE * scale * (LINE_HEIGHT_RATIO - 1)) / 2);
  ctx.restore();
}

function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function textBubbleRect(measurer: TextMeasurer, text: string, point: Point, scale = 1) {
  const previous = measurer.font;
  measurer.font = textFont(scale);
  const width = measurer.measureText(text).width;
  measurer.font = previous;
  const height = BASE_FONT_SIZE * scale * LINE_HEIGHT_RATIO;
  const padding = TEXT_PADDING * scale;
  return { x: point.x, y: point.y, width: width + padding * 2, height: height + padding * 2 };
}

export function rectangleCorners(center: Point, halfWidth: number, halfHeight: number, rotation: number): Point[] {
  return [
    { x: center.x - halfWidth, y: center.y - halfHeight },
    { x: center.x + halfWidth, y: center.y - halfHeight },
    { x: center.x + halfWidth, y: center.y + halfHeight },
    { x: center.x - halfWidth, y: center.y + halfHeight },
  ].map((p) => rotate(p, rotation, center));
}

/**
 * Whether a pointer at `point` grabs `annotation` for a drag. Freehand
 * strokes are intentionally not draggable, same as native.
 */
export function hitTest(
  annotation: FeedbackAnnotation,
  point: Point,
  size: Size,
  measurer: TextMeasurer,
): boolean {
  const points = denormalize(annotation, size);
  const scale = annotation.scale ?? 1;
  switch (annotation.kind) {
    case "rectangle": {
      if (points.length !== 2) return false;
      // Scaled-but-unrotated bounding box, same approximation as native.
      const center = midpoint(points[0], points[1]);
      const hw = (Math.abs(points[1].x - points[0].x) / 2) * scale + HIT_TEST_TOLERANCE;
      const hh = (Math.abs(points[1].y - points[0].y) / 2) * scale + HIT_TEST_TOLERANCE;
      return Math.abs(point.x - center.x) <= hw && Math.abs(point.y - center.y) <= hh;
    }
    case "arrow": {
      if (points.length !== 2) return false;
      const center = midpoint(points[0], points[1]);
      return (
        distanceToSegment(point, scaled(points[0], scale, center), scaled(points[1], scale, center)) <=
        HIT_TEST_TOLERANCE
      );
    }
    case "text": {
      if (points.length < 1 || !annotation.label) return false;
      const rect = textBubbleRect(measurer, annotation.label, points[0], scale);
      const t = HIT_TEST_TOLERANCE / 2;
      return (
        point.x >= rect.x - t &&
        point.x <= rect.x + rect.width + t &&
        point.y >= rect.y - t &&
        point.y <= rect.y + rect.height + t
      );
    }
    case "freehand":
      return false;
  }
}

export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function rotate(p: Point, angle: number, center: Point): Point {
  const dx = p.x - center.x;
  const dy = p.y - center.y;
  return {
    x: center.x + dx * Math.cos(angle) - dy * Math.sin(angle),
    y: center.y + dx * Math.sin(angle) + dy * Math.cos(angle),
  };
}

export function scaled(p: Point, scale: number, center: Point): Point {
  return { x: center.x + (p.x - center.x) * scale, y: center.y + (p.y - center.y) * scale };
}

export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
