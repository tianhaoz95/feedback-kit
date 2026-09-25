import type { CaptureMode } from "./types";

/**
 * Viewport screenshot capture.
 *
 * Default (`"dom"`) re-renders the page's own DOM into an image with
 * `modern-screenshot` (SVG `foreignObject`, so the browser itself lays out
 * every modern CSS feature — no hand-written CSS engine like html2canvas,
 * which can't even parse Tailwind v4's `oklch()` colors). Same idea as the
 * native SDKs' window-level capture: render our own view hierarchy rather
 * than read the screen buffer, so no permission prompt is ever shown.
 *
 * What the user saw is the *viewport*, not the whole document, so the root
 * is clipped to `innerWidth × innerHeight` and shifted by the scroll offset
 * (`restoreScrollPosition`). Shifting the document puts a transform on
 * `<body>`, which silently turns it into the containing block for every
 * `position: fixed` descendant — so fixed and sticky elements (headers,
 * toasts, floating buttons) are re-pinned in the clone at the exact spot
 * they occupied on screen. See `pinFixedAndSticky`.
 */

export interface CapturedScreenshot {
  canvas: HTMLCanvasElement;
  /** Viewport size in CSS pixels — the space annotations are normalized against. */
  width: number;
  height: number;
  pixelRatio: number;
}

export interface CaptureInternalOptions {
  mode?: CaptureMode;
  maxPixelRatio?: number;
  /** Elements to leave out of the image (the widget itself). */
  exclude?: (node: Node) => boolean;
}

export async function captureViewport(options: CaptureInternalOptions = {}): Promise<CapturedScreenshot> {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, options.maxPixelRatio ?? 2);
  if (options.mode === "display") {
    try {
      const display = await captureDisplay(pixelRatio);
      if (display) return display;
    } catch {
      // Declined picker / unsupported → fall back to DOM rendering below.
    }
  }
  return captureDom(pixelRatio, options.exclude);
}

const PIN_ATTR = "data-feedbackkit-pin";

interface PinInfo {
  kind: "fixed" | "sticky";
  top: number;
  left: number;
  width: number;
  height: number;
}

async function captureDom(pixelRatio: number, exclude?: (node: Node) => boolean): Promise<CapturedScreenshot> {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const pins = pinFixedAndSticky(exclude);
  const root = document.documentElement;
  const bodyBackground = getComputedStyle(document.body).backgroundColor;
  const rootBackground = getComputedStyle(root).backgroundColor;
  const background = isTransparent(rootBackground)
    ? isTransparent(bodyBackground)
      ? "#ffffff"
      : bodyBackground
    : rootBackground;

  try {
    // Loaded on first capture, so pages that only ever show the trigger
    // button don't pay for the DOM renderer up front.
    const { domToCanvas } = await import("modern-screenshot");
    const canvas = await domToCanvas(root, {
      width,
      height,
      scale: pixelRatio,
      backgroundColor: background,
      filter: exclude ? (node) => !exclude(node) : null,
      features: { restoreScrollPosition: true },
      timeout: 8000,
      onCloneEachNode: (cloned) => {
        if (!(cloned instanceof HTMLElement)) return;
        // Keep <body> transformed even when the page isn't scrolled, so it's
        // the containing block for pinned fixed elements either way.
        if (cloned.tagName === "BODY" && !cloned.style.transform) cloned.style.transform = "translate(0px, 0px)";
        const id = cloned.getAttribute(PIN_ATTR);
        if (id === null) return;
        cloned.removeAttribute(PIN_ATTR);
        const pin = pins.info.get(id);
        if (!pin) return;
        const s = cloned.style;
        if (pin.kind === "sticky") {
          s.setProperty("position", "relative", "important");
          s.setProperty("inset", "auto", "important");
          s.setProperty("top", `${pin.top}px`, "important");
          s.setProperty("left", `${pin.left}px`, "important");
        } else {
          s.setProperty("position", "fixed", "important");
          s.setProperty("inset", "auto", "important");
          s.setProperty("top", `${pin.top}px`, "important");
          s.setProperty("left", `${pin.left}px`, "important");
          s.setProperty("width", `${pin.width}px`, "important");
          s.setProperty("height", `${pin.height}px`, "important");
          s.setProperty("margin", "0", "important");
          s.setProperty("box-sizing", "border-box", "important");
          s.setProperty("transform", "none", "important");
          s.setProperty("translate", "none", "important");
        }
      },
    });
    return { canvas, width, height, pixelRatio };
  } finally {
    pins.cleanup();
  }
}

/**
 * Tags every fixed/sticky element with its on-screen geometry, expressed
 * relative to the containing block it will have in the shifted clone.
 * Only attributes are touched on the live page (and removed right after);
 * styles are rewritten on the clone only.
 */
function pinFixedAndSticky(exclude?: (node: Node) => boolean): { info: Map<string, PinInfo>; cleanup: () => void } {
  const info = new Map<string, PinInfo>();
  const tagged: Element[] = [];
  const body = document.body;
  if (!body) return { info, cleanup: () => {} };

  const walker = document.createTreeWalker(body, NodeFilter.SHOW_ELEMENT, {
    acceptNode: (node) => (exclude?.(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  let counter = 0;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const el = node as HTMLElement;
    const style = getComputedStyle(el);
    if (style.position !== "fixed" && style.position !== "sticky") continue;
    if (style.display === "none") continue;
    const rect = el.getBoundingClientRect();
    const id = String(counter++);

    if (style.position === "sticky") {
      // Where it would sit if it weren't stuck: measure once with sticky off.
      // Synchronous (no frame is painted in between), so nothing flickers.
      const previous = el.style.getPropertyValue("position");
      const previousPriority = el.style.getPropertyPriority("position");
      el.style.setProperty("position", "static", "important");
      const natural = el.getBoundingClientRect();
      el.style.setProperty("position", previous, previousPriority);
      if (!previous) el.style.removeProperty("position");
      const dy = rect.top - natural.top;
      const dx = rect.left - natural.left;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
      // `relative` offsets are relative to its *own* normal position, and
      // its sticky `top`/`left` are dropped, so the delta alone is enough.
      info.set(id, { kind: "sticky", top: dy, left: dx, width: rect.width, height: rect.height });
    } else {
      const block = containingBlockInClone(el);
      const blockRect = block.getBoundingClientRect();
      info.set(id, {
        kind: "fixed",
        top: rect.top - (blockRect.top + block.clientTop),
        left: rect.left - (blockRect.left + block.clientLeft),
        width: rect.width,
        height: rect.height,
      });
    }
    el.setAttribute(PIN_ATTR, id);
    tagged.push(el);
  }
  return {
    info,
    cleanup: () => {
      for (const el of tagged) el.removeAttribute(PIN_ATTR);
    },
  };
}

/**
 * The element a fixed-position node will be positioned against in the
 * clone: the nearest ancestor that already creates a containing block for
 * fixed descendants (transform/filter/etc.), or one the scroll-shift will
 * transform (a direct child of a scrolled element), falling back to <body>.
 */
function containingBlockInClone(el: HTMLElement): HTMLElement {
  for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
    const s = getComputedStyle(node);
    if (
      s.transform !== "none" ||
      s.filter !== "none" ||
      s.perspective !== "none" ||
      (s as CSSStyleDeclaration & { backdropFilter?: string }).backdropFilter !== undefined &&
        (s as CSSStyleDeclaration & { backdropFilter?: string }).backdropFilter !== "none" ||
      /paint|layout|strict|content/.test(s.contain) ||
      /transform|filter|perspective/.test(s.willChange)
    ) {
      return node;
    }
    const parent = node.parentElement;
    if (parent && (parent.scrollTop !== 0 || parent.scrollLeft !== 0)) return node;
  }
  return document.body;
}

function isTransparent(color: string): boolean {
  return !color || color === "transparent" || /rgba\(\s*0,\s*0,\s*0,\s*0\s*\)/.test(color);
}

interface DisplayMediaOptionsWithCurrentTab extends DisplayMediaStreamOptions {
  preferCurrentTab?: boolean;
  selfBrowserSurface?: "include" | "exclude";
}

/**
 * Pixel-exact capture via the Screen Capture API. Shows the browser's own
 * picker (Chromium preselects this tab with `preferCurrentTab`). Grabs a
 * single frame, then stops the stream immediately.
 */
async function captureDisplay(pixelRatio: number): Promise<CapturedScreenshot | null> {
  if (!navigator.mediaDevices?.getDisplayMedia) return null;
  const options: DisplayMediaOptionsWithCurrentTab = {
    video: { displaySurface: "browser" } as MediaTrackConstraints,
    audio: false,
    preferCurrentTab: true,
    selfBrowserSurface: "include",
  };
  const stream = await navigator.mediaDevices.getDisplayMedia(options);
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    await video.play();
    // Give the picker's own UI a moment to disappear from the captured tab.
    await new Promise((r) => setTimeout(r, 250));
    const width = window.innerWidth;
    const height = window.innerHeight;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return { canvas, width, height, pixelRatio };
  } finally {
    for (const track of stream.getTracks()) track.stop();
  }
}

export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Failed to encode screenshot"))), "image/png");
  });
}
