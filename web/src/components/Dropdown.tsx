import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * A button that toggles a panel below it, closing on outside click or
 * Escape. Just enough for the header's organization switcher and
 * notifications; the dashboard has no menu library.
 */
export function Dropdown({
  trigger,
  children,
  align = "left",
  panelClassName = "",
  label,
}: {
  trigger: (open: boolean) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
  panelClassName?: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center"
      >
        {trigger(open)}
      </button>
      {open ? (
        <div
          role="menu"
          className={`absolute top-full z-30 mt-2 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg ${
            align === "right" ? "right-0" : "left-0"
          } ${panelClassName}`}
        >
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  );
}
