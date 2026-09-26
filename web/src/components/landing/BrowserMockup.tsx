import demoWebScreenshot from "@/assets/demo-web-feedback.webp";

/**
 * A real screenshot of the web SDK's annotate dialog (web-sdk/, captured in
 * Chromium over a small demo storefront with a rectangle drawn around the
 * first "Add to cart" button), in a CSS-drawn browser window. The dialog,
 * toolbar and composer are the SDK's own UI, not a mockup; only the window
 * chrome around it is drawn by this page.
 */
export function BrowserMockup({ className = "" }: { className?: string }) {
  return (
    <div className={`select-none overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-2xl ${className}`}>
      <div className="flex items-center gap-1.5 border-b border-neutral-200 bg-neutral-100 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
        <span className="ml-3 flex-1 truncate rounded-md bg-white px-2.5 py-0.5 text-center text-[10px] text-neutral-500 ring-1 ring-neutral-200">
          shop.acme-outfitters.com
        </span>
        <span className="w-10" />
      </div>
      <img
        src={demoWebScreenshot}
        alt="FeedbackKit's web SDK dialog on a demo store: the page screenshot with a rectangle drawn around the first Add to cart button, and the description 'Add to cart does nothing on the headphones'"
        className="block w-full"
      />
    </div>
  );
}
