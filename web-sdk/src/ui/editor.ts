import type { CapturedScreenshot } from "../capture";
import { drawAnnotation, drawAnnotations, hitTest, type Point } from "../renderer";
import type { FeedbackAnnotation, NormalizedPoint } from "../types";

export type Tool = "pen" | "rectangle" | "arrow" | "text" | "move";

/** Same palette as the native toolbar: systemRed, systemYellow, systemGreen, systemBlue, label. */
export const COLORS = ["#FF3B30", "#FFCC00", "#34C759", "#007AFF", "#000000"] as const;

const MIN_SCALE = 0.3;
const MAX_SCALE = 5;

interface Gesture {
  index: number;
  startDistance: number;
  startAngle: number;
  startScale: number;
  startRotation: number;
}

interface Drag {
  index: number;
  last: Point;
  moved: boolean;
}

/**
 * The annotation canvas: the screenshot, plus an "ink" canvas on top that
 * the user draws on. Everything is stored in the capture's own coordinate
 * space (viewport CSS pixels) and normalized to 0...1 on the way out, so the
 * on-screen display size never leaks into the report — same contract as
 * the native `AnnotationCanvasView`.
 */
export class AnnotationEditor {
  readonly element: HTMLDivElement;
  annotations: FeedbackAnnotation[] = [];
  tool: Tool = "pen";
  color: string = COLORS[0];
  onChange: () => void = () => {};

  private readonly base: HTMLCanvasElement;
  private readonly ink: HTMLCanvasElement;
  private readonly inkCtx: CanvasRenderingContext2D;
  private history: FeedbackAnnotation[][] = [];
  private draft: FeedbackAnnotation | null = null;
  private draftStart: Point | null = null;
  private pointers = new Map<number, Point>();
  private drag: Drag | null = null;
  private gesture: Gesture | null = null;
  private selected: number | null = null;
  private textInput: HTMLInputElement | null = null;
  private displayScale = 1;

  constructor(private readonly shot: CapturedScreenshot) {
    this.element = document.createElement("div");
    this.element.className = "fk-canvas-box";
    this.base = document.createElement("canvas");
    this.ink = document.createElement("canvas");
    this.ink.className = "fk-ink";
    this.ink.setAttribute("role", "img");
    this.ink.setAttribute("aria-label", "Screenshot — draw on it to highlight the problem");
    this.element.append(this.base, this.ink);
    const ctx = this.ink.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D is unavailable");
    this.inkCtx = ctx;

    this.ink.addEventListener("pointerdown", (e) => this.onPointerDown(e));
    this.ink.addEventListener("pointermove", (e) => this.onPointerMove(e));
    this.ink.addEventListener("pointerup", (e) => this.onPointerUp(e));
    this.ink.addEventListener("pointercancel", (e) => this.onPointerUp(e));
    this.ink.addEventListener("wheel", (e) => this.onWheel(e), { passive: false });
  }

  /** Fits the screenshot inside `maxWidth × maxHeight` (CSS px) keeping its aspect ratio. */
  layout(maxWidth: number, maxHeight: number): void {
    const scale = Math.max(0.05, Math.min(maxWidth / this.shot.width, maxHeight / this.shot.height, 1));
    this.displayScale = scale;
    const w = Math.round(this.shot.width * scale);
    const h = Math.round(this.shot.height * scale);
    const dpr = window.devicePixelRatio || 1;
    for (const canvas of [this.base, this.ink]) {
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const baseCtx = this.base.getContext("2d");
    if (baseCtx) {
      baseCtx.imageSmoothingQuality = "high";
      baseCtx.drawImage(this.shot.canvas, 0, 0, this.base.width, this.base.height);
    }
    this.cancelTextInput();
    this.render();
  }

  setTool(tool: Tool): void {
    this.commitTextInput();
    this.tool = tool;
    this.selected = null;
    this.ink.style.cursor = tool === "move" ? "grab" : tool === "text" ? "text" : "crosshair";
    this.render();
  }

  undo(): void {
    this.commitTextInput();
    const previous = this.history.pop();
    if (!previous) return;
    this.annotations = previous;
    this.selected = null;
    this.changed();
  }

  clear(): void {
    if (this.annotations.length === 0) return;
    this.snapshot();
    this.annotations = [];
    this.selected = null;
    this.changed();
  }

  get canUndo(): boolean {
    return this.history.length > 0;
  }

  /** Deletes the annotation last moved/selected with the move tool. */
  deleteSelected(): boolean {
    if (this.selected === null || !this.annotations[this.selected]) return false;
    this.snapshot();
    this.annotations.splice(this.selected, 1);
    this.selected = null;
    this.changed();
    return true;
  }

  /** The screenshot at full capture resolution with every annotation burned in. */
  flatten(): HTMLCanvasElement {
    this.commitTextInput();
    const out = document.createElement("canvas");
    out.width = this.shot.canvas.width;
    out.height = this.shot.canvas.height;
    const ctx = out.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D is unavailable");
    ctx.drawImage(this.shot.canvas, 0, 0);
    ctx.scale(out.width / this.shot.width, out.height / this.shot.height);
    drawAnnotations(ctx, this.annotations, { width: this.shot.width, height: this.shot.height });
    return out;
  }

  commitTextInput(): void {
    const input = this.textInput;
    if (!input) return;
    this.textInput = null;
    const label = input.value.trim();
    const origin = JSON.parse(input.dataset.origin ?? "[0,0]") as NormalizedPoint;
    input.remove();
    if (!label) return;
    this.snapshot();
    this.annotations.push({ kind: "text", points: [origin], colorHex: this.color, label, scale: 1, rotation: 0 });
    this.changed();
  }

  cancelTextInput(): void {
    this.textInput?.remove();
    this.textInput = null;
  }

  // ---------------------------------------------------------------- drawing

  render(): void {
    const ctx = this.inkCtx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.ink.width, this.ink.height);
    const k = this.ink.width / this.shot.width;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    const size = { width: this.shot.width, height: this.shot.height };
    drawAnnotations(ctx, this.annotations, size);
    if (this.draft) drawAnnotation(ctx, this.draft, size);
  }

  private changed(): void {
    this.render();
    this.onChange();
  }

  private snapshot(): void {
    this.history.push(this.annotations.map((a) => ({ ...a, points: a.points.map((p) => [p[0], p[1]] as NormalizedPoint) })));
    if (this.history.length > 100) this.history.shift();
  }

  // ---------------------------------------------------------------- input

  /** Pointer position in capture coordinates (viewport CSS px of the original page). */
  private toCapture(e: PointerEvent | WheelEvent): Point {
    const rect = this.ink.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(this.shot.width, (e.clientX - rect.left) / this.displayScale)),
      y: Math.max(0, Math.min(this.shot.height, (e.clientY - rect.top) / this.displayScale)),
    };
  }

  private normalize(p: Point): NormalizedPoint {
    return [round4(p.x / this.shot.width), round4(p.y / this.shot.height)];
  }

  private hitIndex(p: Point): number | null {
    const size = { width: this.shot.width, height: this.shot.height };
    for (let i = this.annotations.length - 1; i >= 0; i--) {
      if (hitTest(this.annotations[i], p, size, this.inkCtx)) return i;
    }
    return null;
  }

  private onPointerDown(e: PointerEvent): void {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.preventDefault();
    const p = this.toCapture(e);
    this.ink.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, p);

    if (this.tool === "move") {
      if (this.pointers.size === 2 && this.selected !== null) {
        this.drag = null;
        this.startGesture();
        return;
      }
      const index = this.hitIndex(p);
      this.selected = index;
      if (index !== null) {
        this.snapshot();
        this.drag = { index, last: p, moved: false };
        this.ink.style.cursor = "grabbing";
      }
      return;
    }

    if (this.pointers.size > 1) return;

    if (this.tool === "text") {
      this.commitTextInput();
      this.openTextInput(p);
      return;
    }

    this.draftStart = p;
    const n = this.normalize(p);
    this.draft = {
      kind: this.tool === "pen" ? "freehand" : this.tool,
      points: this.tool === "pen" ? [n] : [n, n],
      colorHex: this.color,
      scale: 1,
      rotation: 0,
    };
    this.render();
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.pointers.has(e.pointerId)) {
      if (this.tool === "move" && e.pointerType === "mouse") {
        this.ink.style.cursor = this.hitIndex(this.toCapture(e)) !== null ? "grab" : "default";
      }
      return;
    }
    const p = this.toCapture(e);
    this.pointers.set(e.pointerId, p);

    if (this.gesture) {
      this.updateGesture();
      return;
    }
    if (this.drag) {
      const dx = (p.x - this.drag.last.x) / this.shot.width;
      const dy = (p.y - this.drag.last.y) / this.shot.height;
      this.drag.last = p;
      this.drag.moved = true;
      const a = this.annotations[this.drag.index];
      a.points = a.points.map(([x, y]) => [round4(x + dx), round4(y + dy)] as NormalizedPoint);
      this.render();
      return;
    }
    if (!this.draft || !this.draftStart) return;
    const n = this.normalize(p);
    if (this.draft.kind === "freehand") {
      const last = this.draft.points[this.draft.points.length - 1];
      // Skip sub-pixel jitter so long strokes stay compact in the JSON.
      if (Math.hypot((n[0] - last[0]) * this.shot.width, (n[1] - last[1]) * this.shot.height) >= 1.5) {
        this.draft.points.push(n);
      }
    } else {
      this.draft.points = [this.draft.points[0], n];
    }
    this.render();
  }

  private onPointerUp(e: PointerEvent): void {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.delete(e.pointerId);
    if (this.ink.hasPointerCapture(e.pointerId)) this.ink.releasePointerCapture(e.pointerId);

    if (this.gesture) {
      if (this.pointers.size < 2) {
        this.gesture = null;
        this.onChange();
      }
      return;
    }
    if (this.drag) {
      if (!this.drag.moved) this.history.pop(); // A click without movement isn't an edit.
      this.drag = null;
      this.ink.style.cursor = "grab";
      this.onChange();
      return;
    }
    const draft = this.draft;
    this.draft = null;
    const start = this.draftStart;
    this.draftStart = null;
    if (!draft || !start) return;
    if (draft.kind !== "freehand") {
      const [a, b] = draft.points;
      const tiny = Math.hypot((b[0] - a[0]) * this.shot.width, (b[1] - a[1]) * this.shot.height) < 6;
      if (tiny) {
        this.render();
        return;
      }
    }
    this.snapshot();
    this.annotations.push(draft);
    this.changed();
  }

  /** Mouse/trackpad stand-in for pinch/twist: wheel scales, Shift/Alt+wheel rotates. */
  private onWheel(e: WheelEvent): void {
    if (this.tool !== "move") return;
    const p = this.toCapture(e);
    const index = this.hitIndex(p) ?? this.selected;
    if (index === null || !this.annotations[index]) return;
    e.preventDefault();
    const a = this.annotations[index];
    if (a.kind === "freehand") return;
    this.selected = index;
    if (e.shiftKey || e.altKey) {
      if (a.kind === "text") return;
      const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
      a.rotation = round4(a.rotation + delta * 0.004);
    } else {
      // ctrlKey is set for trackpad pinch gestures in Chromium/Firefox — same axis, finer steps.
      a.scale = round4(clamp(a.scale * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), MIN_SCALE, MAX_SCALE));
    }
    this.render();
    this.onChange();
  }

  private startGesture(): void {
    if (this.selected === null) return;
    const [a, b] = [...this.pointers.values()];
    const annotation = this.annotations[this.selected];
    this.snapshot();
    this.gesture = {
      index: this.selected,
      startDistance: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
      startAngle: Math.atan2(b.y - a.y, b.x - a.x),
      startScale: annotation.scale,
      startRotation: annotation.rotation,
    };
  }

  private updateGesture(): void {
    const g = this.gesture;
    if (!g || this.pointers.size < 2) return;
    const [a, b] = [...this.pointers.values()];
    const annotation = this.annotations[g.index];
    if (!annotation || annotation.kind === "freehand") return;
    const distance = Math.hypot(b.x - a.x, b.y - a.y);
    annotation.scale = round4(clamp(g.startScale * (distance / g.startDistance), MIN_SCALE, MAX_SCALE));
    if (annotation.kind !== "text") {
      annotation.rotation = round4(g.startRotation + (Math.atan2(b.y - a.y, b.x - a.x) - g.startAngle));
    }
    this.render();
  }

  private openTextInput(p: Point): void {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "fk-text-input";
    input.placeholder = "Add a note…";
    input.setAttribute("aria-label", "Annotation text");
    input.dataset.origin = JSON.stringify(this.normalize(p));
    input.style.left = `${Math.min(p.x * this.displayScale, this.shot.width * this.displayScale - 130)}px`;
    input.style.top = `${Math.min(p.y * this.displayScale, this.shot.height * this.displayScale - 36)}px`;
    input.style.borderColor = this.color;
    input.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") this.commitTextInput();
      else if (e.key === "Escape") this.cancelTextInput();
    });
    input.addEventListener("blur", () => this.commitTextInput());
    this.element.append(input);
    this.textInput = input;
    requestAnimationFrame(() => input.focus());
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

