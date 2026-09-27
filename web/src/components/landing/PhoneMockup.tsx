import type { ReactNode } from "react";
import demoScreenshot from "@/assets/demo-feedback-screen.webp";

/**
 * A real screenshot captured from the demo app (DemoApp/), mid-flow through
 * FeedbackKit's own annotate screen — not a mockup — wrapped in a CSS-drawn
 * iPhone hardware frame for presentation. The *inner* phone bezel and
 * Dynamic Island visible partway down the screenshot are drawn by
 * FeedbackViewController itself (Sources/FeedbackKit/UI/FeedbackViewController.swift),
 * not by this page — this component only adds the outer device frame.
 *
 * Every dimension is a percentage of the phone's width (padding percentages
 * resolve against width; `aspect-ratio` does the rest), so the frame keeps
 * iPhone proportions at any rendered size. Corner radii are written as
 * `horizontal% / vertical%` because a plain percentage would stretch into an
 * ellipse on a tall box; the vertical value is the horizontal one scaled by
 * the box's aspect ratio (~0.46), which keeps the corners circular.
 */
export function PhoneMockup({
  className = "mx-auto max-w-[300px]",
  overlay,
}: {
  className?: string;
  /** Drawn over the screen, inside its rounded corners (e.g. a sheet sliding up). */
  overlay?: ReactNode;
}) {
  return (
    <div className={`relative w-full select-none ${className}`}>
      {/* Hardware buttons: action + volume on the left, side button on the right. */}
      <span className="absolute left-[-1%] top-[16%] h-[3.5%] w-[1.3%] rounded-l-full bg-gradient-to-r from-neutral-500 to-neutral-700" />
      <span className="absolute left-[-1%] top-[23%] h-[6.5%] w-[1.3%] rounded-l-full bg-gradient-to-r from-neutral-500 to-neutral-700" />
      <span className="absolute left-[-1%] top-[31%] h-[6.5%] w-[1.3%] rounded-l-full bg-gradient-to-r from-neutral-500 to-neutral-700" />
      <span className="absolute right-[-1%] top-[25%] h-[10%] w-[1.3%] rounded-r-full bg-gradient-to-l from-neutral-500 to-neutral-700" />

      {/* Titanium rim */}
      <div className="rounded-[16%/7.4%] bg-gradient-to-br from-neutral-400 via-neutral-700 to-neutral-500 p-[1.1%] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.45),0_10px_20px_-10px_rgba(0,0,0,0.3)]">
        {/* Black bezel */}
        <div className="rounded-[15%/7%] bg-black p-[3.2%] ring-1 ring-inset ring-white/10">
          {/* Screen */}
          <div className="relative overflow-hidden rounded-[11.5%/5.3%] bg-white">
            <img
              src={demoScreenshot}
              alt="FeedbackKit's iOS annotate screen in the demo app: a screenshot of the Home tab with a rectangle drawn around the first Add button, the description 'The first Add button doesn't do anything.', and 'Notify me' turned on from the composer's + menu"
              className="block w-full"
            />
            {overlay}
            {/* Dynamic Island, over the screenshot's own (real) status bar */}
            <div className="pointer-events-none absolute left-1/2 top-[1.3%] aspect-[3.4/1] w-[31%] -translate-x-1/2 rounded-full bg-black" />
          </div>
        </div>
      </div>
    </div>
  );
}
