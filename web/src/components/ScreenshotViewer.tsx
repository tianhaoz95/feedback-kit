import { useEffect, useRef, useState } from "react";
import { drawAnnotations } from "feedbackkit-web";
import type { FeedbackAnnotation, FeedbackEnvironment } from "@/lib/types";
import { ExternalLinkIcon } from "@/components/icons";

type Mode = "annotated" | "original";

/**
 * Shows a report's screenshot with an Annotated / Original switch. In
 * Original mode the markup can be overlaid live from the stored annotation
 * JSON — drawn by the web SDK's renderer (a port of the Swift
 * `AnnotationRenderer`), so the shapes line up the same way for iOS, macOS
 * and web reports alike, and can be toggled to see what's underneath.
 */
export function ScreenshotViewer({
  annotatedUrl,
  rawUrl,
  annotations,
  environment,
}: {
  annotatedUrl: string | null;
  rawUrl: string | null;
  annotations: FeedbackAnnotation[];
  environment: Partial<FeedbackEnvironment> | null;
}) {
  const [mode, setMode] = useState<Mode>("annotated");
  const [overlay, setOverlay] = useState(true);
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hasMarkup = annotations.length > 0;
  const src = mode === "original" && rawUrl ? rawUrl : annotatedUrl ?? rawUrl;
  const drawOverlay = mode === "original" && overlay && hasMarkup;

  useEffect(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;

    const draw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const width = img.clientWidth;
      const height = img.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!drawOverlay || !img.naturalWidth) return;
      // Annotations are normalized against the capture's size in points/CSS
      // px (stroke widths and font sizes are in that space too), so draw in
      // that space and scale it onto the displayed image.
      const scale = environment?.screenScale || 1;
      const target = {
        width: environment?.screenWidthPoints || img.naturalWidth / scale,
        height: environment?.screenHeightPoints || img.naturalHeight / scale,
      };
      const k = (width * dpr) / target.width;
      ctx.setTransform(k, 0, 0, k, 0, 0);
      drawAnnotations(ctx, annotations as Parameters<typeof drawAnnotations>[1], target);
    };

    draw();
    img.addEventListener("load", draw);
    const observer = new ResizeObserver(draw);
    observer.observe(img);
    return () => {
      img.removeEventListener("load", draw);
      observer.disconnect();
    };
  }, [drawOverlay, annotations, environment, src]);

  if (!src) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 bg-neutral-50/70 px-4 py-2">
        <div className="inline-flex rounded-md border border-neutral-200 bg-white p-0.5 text-[11px] font-medium">
          {(["annotated", "original"] as const).map((m) => (
            <button
              key={m}
              type="button"
              disabled={m === "original" && !rawUrl}
              onClick={() => setMode(m)}
              className={`rounded px-2 py-0.5 transition-colors disabled:opacity-40 ${
                mode === m ? "bg-neutral-900 text-white" : "text-neutral-500 hover:text-neutral-900"
              }`}
            >
              {m === "annotated" ? "Annotated" : "Original"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {mode === "original" && hasMarkup && (
            <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-neutral-500">
              <input
                type="checkbox"
                checked={overlay}
                onChange={(e) => setOverlay(e.target.checked)}
                className="h-3 w-3 accent-neutral-900"
              />
              Overlay markup ({annotations.length})
            </label>
          )}
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-500 hover:text-neutral-900"
          >
            Full size
            <ExternalLinkIcon className="h-3 w-3" />
          </a>
        </div>
      </div>
      <div className="flex items-center justify-center bg-neutral-900/5 p-4">
        <div className="relative">
          <img
            ref={imgRef}
            src={src}
            alt={mode === "annotated" ? "Annotated screenshot" : "Original screenshot"}
            className="block max-h-[520px] w-auto rounded-lg object-contain shadow-xs"
          />
          <canvas ref={canvasRef} className="pointer-events-none absolute left-0 top-0 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
