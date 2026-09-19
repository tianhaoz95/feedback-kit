import demoScreenshot from "@/assets/demo-feedback-screen.png";

/**
 * A real screenshot captured from the demo app (DemoApp/), mid-flow through
 * FeedbackKit's own annotate screen — not a mockup. The phone bezel and
 * Dynamic Island seen here are drawn by FeedbackViewController itself
 * (Sources/FeedbackKit/UI/FeedbackViewController.swift), not by this page.
 */
export function PhoneMockup() {
  return (
    <div className="mx-auto w-full max-w-[320px] select-none overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl">
      <img
        src={demoScreenshot}
        alt="FeedbackKit's annotate screen in the demo app: a screenshot of the Home tab with a rectangle drawn around the Add button, captured mid-report"
        className="block w-full"
      />
    </div>
  );
}
