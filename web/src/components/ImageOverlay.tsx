import { useEffect, type ReactNode, type RefObject } from "react";
import { ExternalLinkIcon, XIcon } from "@/components/icons";

export interface ImageOverlayProps {
  src: string;
  alt?: string;
  caption?: string | null;
  isVideo?: boolean;
  ariaLabel?: string;
  onClose: () => void;
  imgRef?: RefObject<HTMLImageElement | null>;
  children?: ReactNode;
}

export function ImageOverlay({
  src,
  alt = "Image overlay",
  caption,
  isVideo = false,
  ariaLabel = "Image overlay",
  onClose,
  imgRef,
  children,
}: ImageOverlayProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-neutral-950/85 backdrop-blur-xs p-4 sm:p-6 animate-overlay-fade"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute top-4 right-4 z-10 flex items-center gap-3">
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900/80 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
        >
          Full size
          <ExternalLinkIcon className="h-3.5 w-3.5" />
        </a>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close overlay"
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900/80 text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors cursor-pointer"
        >
          <XIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex max-h-[90vh] max-w-[90vw] items-center justify-center animate-overlay-zoom">
        {isVideo ? (
          <video
            src={src}
            controls
            autoPlay
            playsInline
            className="max-h-[85vh] max-w-[90vw] w-auto rounded-lg bg-black shadow-2xl"
          />
        ) : (
          <>
            <img
              ref={imgRef}
              src={src}
              alt={alt}
              className="max-h-[85vh] max-w-[90vw] w-auto rounded-lg object-contain shadow-2xl"
            />
            {children}
          </>
        )}
      </div>
      {caption ? (
        <p className="mt-3 text-center text-xs text-neutral-400 max-w-lg">{caption}</p>
      ) : null}
    </div>
  );
}
