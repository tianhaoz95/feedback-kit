import { useEffect, useRef, useState } from "react";
import { drawAnnotations } from "feedbackkit-web";
import type { FeedbackAnnotation, FeedbackEnvironment } from "@/lib/types";
import { previewRetentionNote } from "@/lib/previews";
import type { SignedPreview } from "@/lib/useAfterPreviews";
import { ExternalLinkIcon } from "@/components/icons";

type Mode = "annotated" | "original" | "after";

/**
 * Shows a report's screenshot with an Annotated / Original switch. In
 * Original mode the markup can be overlaid live from the stored annotation
 * JSON — drawn by the web SDK's renderer (a port of the Swift
 * `AnnotationRenderer`), so the shapes line up the same way for iOS, macOS
 * and web reports alike, and can be toggled to see what's underneath.
 *
 * After shows the after-fix previews a coding agent attached (screenshots or
 * short videos, 0025), so the team can compare without running the build.
 */
export function ScreenshotViewer({
  annotatedUrl,
  rawUrl,
  annotations,
  environment,
  previews = [],
  resolvedAt = null,
}: {
  annotatedUrl: string | null;
  rawUrl: string | null;
  annotations: FeedbackAnnotation[];
  environment: Partial<FeedbackEnvironment> | null;
  previews?: SignedPreview[];
  resolvedAt?: string | null;
}) {
  const hasScreenshot = Boolean(annotatedUrl ?? rawUrl);
  const [chosenMode, setMode] = useState<Mode | null>(null);
  const mode: Mode = chosenMode ?? (hasScreenshot ? "annotated" : "after");
  // null = the latest preview.
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const preview = previews.length > 0 ? previews[previewIndex ?? previews.length - 1] ?? previews[previews.length - 1] : null;
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

  if (!src && previews.length === 0) return null;
  const linkUrl = mode === "after" ? preview?.url ?? null : src;
  const modes: Mode[] = ["annotated", "original", ...(previews.length > 0 ? (["after"] as const) : [])];

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 bg-neutral-50/70 px-4 py-2">
        <div className="inline-flex rounded-md border border-neutral-200 bg-white p-0.5 text-[11px] font-medium">
          {modes.map((m) => (
            <button
              key={m}
              type="button"
              disabled={(m === "original" && !rawUrl) || (m === "annotated" && !annotatedUrl && !rawUrl)}
              onClick={() => setMode(m)}
              className={`rounded px-2 py-0.5 transition-colors disabled:opacity-40 ${
                mode === m ? "bg-neutral-900 text-white" : "text-neutral-500 hover:text-neutral-900"
              }`}
            >
              {m === "annotated" ? "Annotated" : m === "original" ? "Original" : `After${previews.length > 1 ? ` (${previews.length})` : ""}`}
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
          {linkUrl ? (
          <a
            href={linkUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-500 hover:text-neutral-900"
          >
            Full size
            <ExternalLinkIcon className="h-3 w-3" />
          </a>
          ) : null}
        </div>
      </div>
      {mode === "after" && preview ? (
        <AfterView
          previews={previews}
          preview={preview}
          onPick={(i) => setPreviewIndex(i)}
          resolvedAt={resolvedAt}
        />
      ) : (
      <div className="flex items-center justify-center bg-neutral-900/5 p-4">
        <div className="relative">
          <img
            ref={imgRef}
            src={src ?? undefined}
            alt={mode === "annotated" ? "Annotated screenshot" : "Original screenshot"}
            className="block max-h-[520px] w-auto rounded-lg object-contain shadow-xs"
          />
          <canvas ref={canvasRef} className="pointer-events-none absolute left-0 top-0 rounded-lg" />
        </div>
      </div>
      )}
    </div>
  );
}

function AfterView({
  previews,
  preview,
  onPick,
  resolvedAt,
}: {
  previews: SignedPreview[];
  preview: SignedPreview;
  onPick: (index: number) => void;
  resolvedAt: string | null;
}) {
  const current = previews.indexOf(preview);
  return (
    <div>
      <div className="flex min-h-40 items-center justify-center bg-neutral-900/5 p-4">
        {preview.expiredAt || !preview.path ? (
          <p className="px-6 py-10 text-center text-xs text-neutral-500">
            Preview expired: it was deleted {new Date(preview.expiredAt ?? preview.createdAt).toLocaleDateString()}, 14 days
            after the report was resolved.
          </p>
        ) : !preview.url ? (
          <div className="h-64 w-full animate-pulse rounded-lg bg-neutral-100" />
        ) : preview.isVideo ? (
          <video
            key={preview.eventId}
            src={preview.url}
            controls
            playsInline
            className="block max-h-[520px] w-auto rounded-lg bg-black shadow-xs"
          />
        ) : (
          <img
            src={preview.url}
            alt={preview.caption ?? "After the fix"}
            className="block max-h-[520px] w-auto rounded-lg object-contain shadow-xs"
          />
        )}
      </div>
      <div className="space-y-1.5 border-t border-neutral-100 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-neutral-500">
          {preview.caption ? <span className="font-medium text-neutral-800">{preview.caption}</span> : null}
          <span>
            Captured by {preview.actor} · {new Date(preview.createdAt).toLocaleString()}
            {preview.durationSeconds ? ` · ${preview.durationSeconds}s` : ""}
          </span>
          {previews.length > 1 ? (
            <span className="ml-auto inline-flex items-center gap-1">
              {previews.map((p, i) => (
                <button
                  key={p.eventId}
                  type="button"
                  onClick={() => onPick(i)}
                  aria-label={`Preview ${i + 1}`}
                  aria-current={i === current}
                  className={`h-5 min-w-5 rounded px-1 text-[10px] font-medium ${
                    i === current ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </span>
          ) : null}
        </div>
        <p className="text-[11px] text-neutral-400">
          An agent&apos;s capture, not a confirmation: the report is only verified by its reporter or your team.{" "}
          {previewRetentionNote(resolvedAt)}
        </p>
      </div>
    </div>
  );
}
