const statusStyles: Record<string, string> = {
  New: "bg-blue-50 text-blue-700",
  "In progress": "bg-amber-50 text-amber-700",
  Resolved: "bg-emerald-50 text-emerald-700",
};

const items = [
  { screen: "Checkout", text: "Subtotal doesn't match the cart total", status: "New" },
  { screen: "Onboarding", text: "Continue button is clipped on SE", status: "In progress" },
  { screen: "Profile", text: "Avatar upload spinner never stops", status: "Resolved" },
];

/** Illustrative mockup of the dashboard's feedback list + prompt panel. */
export function DashboardMockup() {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl">
      <div className="flex items-center gap-1.5 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-neutral-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-neutral-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-neutral-300" />
        <span className="ml-3 text-[11px] text-neutral-400">
          feedback-kit.app/projects/checkout-app
        </span>
      </div>
      <div className="grid grid-cols-5 text-sm">
        <div className="col-span-2 divide-y divide-neutral-100 border-r border-neutral-200">
          {items.map((item, i) => (
            <div
              key={item.text}
              className={`px-4 py-3 ${i === 0 ? "bg-neutral-50" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-neutral-500">{item.screen}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusStyles[item.status]}`}
                >
                  {item.status}
                </span>
              </div>
              <p className="mt-1 truncate text-[12px] text-neutral-700">{item.text}</p>
            </div>
          ))}
        </div>
        <div className="col-span-3 flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-neutral-500">Generated prompt</span>
            <span className="rounded-md bg-neutral-900 px-2.5 py-1 text-[10px] font-medium text-white">
              Copy for coding agent
            </span>
          </div>
          <div className="space-y-1.5 rounded-lg bg-neutral-50 p-3 font-mono text-[10.5px] leading-relaxed text-neutral-600">
            <p>
              <span className="text-neutral-400">screen:</span> Checkout
            </p>
            <p>
              <span className="text-neutral-400">device:</span> iPhone 16 Pro, iOS 18.2
            </p>
            <p>
              <span className="text-neutral-400">report:</span> &ldquo;Subtotal doesn&apos;t
              match the cart total&rdquo;
            </p>
            <p className="pt-1 text-neutral-400">
              Fix the bug shown in the attached screenshot, on the Checkout
              screen&hellip;
            </p>
          </div>
          <div className="h-16 rounded-lg border border-dashed border-neutral-200 bg-neutral-50/50" />
        </div>
      </div>
    </div>
  );
}
