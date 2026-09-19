/**
 * Illustrative mockup of the SDK's annotate-and-describe screen — not a real
 * screenshot, since the SDK renders native UIKit, but a stand-in that shows
 * the shape of the flow (screenshot underneath, markup tools, description
 * field) for the marketing page.
 */
export function PhoneMockup() {
  return (
    <div className="relative mx-auto w-[280px] select-none">
      <div className="relative rounded-[2.5rem] border-[6px] border-neutral-900 bg-neutral-900 shadow-2xl">
        <div className="absolute left-1/2 top-0 z-10 h-5 w-28 -translate-x-1/2 rounded-b-2xl bg-neutral-900" />
        <div className="relative h-[560px] w-full overflow-hidden rounded-[2rem] bg-white">
          {/* Captured app screen underneath the annotation layer */}
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between px-4 pb-2 pt-8 text-[10px] font-medium text-neutral-400">
              <span>9:41</span>
              <span>Checkout</span>
            </div>
            <div className="flex-1 space-y-3 bg-neutral-50 px-4 pt-2">
              <div className="h-24 rounded-lg bg-neutral-200/70" />
              <div className="h-3 w-3/4 rounded bg-neutral-200" />
              <div className="h-3 w-1/2 rounded bg-neutral-200" />
              <div className="mt-4 h-9 w-full rounded-md bg-neutral-300/80" />
            </div>

            {/* Annotation overlay */}
            <svg
              className="pointer-events-none absolute inset-x-4 top-[218px] h-20 w-[calc(100%-2rem)]"
              viewBox="0 0 232 80"
              fill="none"
            >
              <rect
                x="4"
                y="4"
                width="140"
                height="72"
                rx="8"
                stroke="#ef4444"
                strokeWidth="3"
              />
              <path
                d="M 156 40 L 220 40"
                stroke="#ef4444"
                strokeWidth="3"
                markerEnd="url(#arrowhead)"
              />
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="8"
                  markerHeight="8"
                  refX="6"
                  refY="4"
                  orient="auto"
                >
                  <path d="M0,0 L8,4 L0,8 Z" fill="#ef4444" />
                </marker>
              </defs>
              <text x="150" y="12" fill="#ef4444" fontSize="11" fontWeight="600">
                total is wrong
              </text>
            </svg>

            {/* Compose sheet */}
            <div className="border-t border-neutral-200 bg-white px-3 py-3">
              <div className="mb-2 flex items-center gap-2">
                {["Pen", "Rect", "Arrow", "Text"].map((tool, i) => (
                  <span
                    key={tool}
                    className={`flex h-6 w-6 items-center justify-center rounded-md text-[9px] font-semibold ${
                      i === 1
                        ? "bg-neutral-900 text-white"
                        : "bg-neutral-100 text-neutral-500"
                    }`}
                  >
                    {tool[0]}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2 rounded-full border border-neutral-200 px-3 py-2">
                <span className="flex-1 truncate text-[11px] text-neutral-400">
                  The subtotal doesn&apos;t match the cart&hellip;
                </span>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-[10px] text-white">
                  &rarr;
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
