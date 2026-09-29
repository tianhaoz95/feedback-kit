import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { FIX_STAGE_META, FIX_STAGE_ORDER } from "@/lib/fixStageMeta";
import { LockIcon, CopyIcon, GitHubIcon } from "@/components/icons";

/**
 * Visuals for /docs/how-it-works: one bug report followed from the reporter's
 * device, through a coding agent, and back to the same device for "is it
 * fixed?". The scenes are illustrations, not screenshots, but every label in
 * them (fix stages, tool names, button text, CLI output) matches the real
 * product. Animations live in index.css (`lc-*`) and replay whenever a scene
 * remounts; all of them switch off under prefers-reduced-motion.
 */

export const LIFECYCLE_STEPS = [
  {
    title: "A user hits a bug",
    where: "In your app",
    caption: "They shake the phone, circle the broken Pay button, type one line, and send.",
  },
  {
    title: "It lands in your dashboard",
    where: "Dashboard",
    caption: "Screenshot, annotation, device, OS, build, and screen name arrive together.",
  },
  {
    title: "It becomes a prompt",
    where: "Dashboard or MCP",
    caption: "Your template's {{placeholders}} are filled from the report.",
  },
  {
    title: "Your coding agent fixes it",
    where: "Claude Code, Codex, Cursor…",
    caption: "Over MCP, the agent reads the report, claims it, fixes it, and tags the commit.",
  },
  {
    title: "The fix merges",
    where: "GitHub",
    caption: "The FeedbackKit: <id> trailer links the PR. Merging moves the report to Merged.",
  },
  {
    title: "You ship a build",
    where: "CI or your terminal",
    caption: "One release command marks every merged fix in that build as shipped.",
  },
  {
    title: "The reporter confirms",
    where: "The reporter's device",
    caption: "On build 42, the app shows them their own screenshot and asks whether it's fixed.",
  },
  {
    title: "You promote the release",
    where: "Releases tab",
    caption: "Every fix in the beta is verified by the person who reported it, so it's ready to promote.",
  },
] as const;

const STEP_MS = 6500;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function useInView<T extends Element>(threshold = 0.35) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold });
    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);
  return [ref, inView] as const;
}

const d = (seconds: number): CSSProperties => ({ animationDelay: `${seconds}s` });

// ---------------------------------------------------------------------------
// The loop diagram
// ---------------------------------------------------------------------------

const LOOP_PATH = "M80 50 H320 V270 H80 Z";
const LOOP_CORNERS = [
  [80, 50],
  [320, 50],
  [320, 270],
  [80, 270],
  [80, 50],
];
const LOOP_LENGTH = 920;
const LAP_MS = 10000;

function pointOnLoop(fraction: number) {
  let remaining = fraction * LOOP_LENGTH;
  for (let i = 0; i < 4; i++) {
    const [x1, y1] = LOOP_CORNERS[i];
    const [x2, y2] = LOOP_CORNERS[i + 1];
    const len = Math.abs(x2 - x1) + Math.abs(y2 - y1);
    if (remaining <= len) {
      const t = remaining / len;
      return [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t];
    }
    remaining -= len;
  }
  return [80, 50];
}

// Where each node sits along LOOP_PATH, as a fraction of one lap, so a node
// lights up while the travelling dot passes under it.
const LOOP_NODES = [
  { x: 80, y: 50, title: "Reporter's device", sub: "SDK", at: 0 },
  { x: 320, y: 50, title: "Dashboard", sub: "report + prompt", at: 240 / 920 },
  { x: 320, y: 160, title: "Coding agent", sub: "via MCP", at: 350 / 920 },
  { x: 320, y: 270, title: "GitHub", sub: "PR · merge", at: 460 / 920 },
  { x: 80, y: 270, title: "Release", sub: "build 42", at: 700 / 920 },
];

export function LifecycleLoop() {
  const reduced = usePrefersReducedMotion();
  const dotRef = useRef<SVGGElement>(null);
  const nodeRefs = useRef<(SVGRectElement | null)[]>([]);

  // One clock drives both the dot and the node highlights (SMIL and CSS
  // animations start at different times, so they drift apart). Writes go
  // straight to the DOM to avoid re-rendering 60 times a second.
  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const f = ((now - start) / LAP_MS) % 1;
      const [x, y] = pointOnLoop(f);
      dotRef.current?.setAttribute("transform", `translate(${x} ${y})`);
      nodeRefs.current.forEach((el, i) => {
        if (!el) return;
        const offset = (((f - LOOP_NODES[i].at) % 1) + 1.5) % 1 - 0.5;
        const lit = Math.abs(offset) * LOOP_LENGTH < 64;
        el.setAttribute("stroke", lit ? "#10b981" : "#d4d4d4");
        el.setAttribute("stroke-width", lit ? "3" : "1.5");
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  return (
    <figure className="rounded-xl border border-neutral-200 bg-gradient-to-b from-white to-neutral-50 p-4 shadow-sm">
      <svg viewBox="0 0 400 320" className="mx-auto block w-full max-w-md" role="img" aria-labelledby="lc-loop-title">
        <title id="lc-loop-title">
          The FeedbackKit loop: a report travels from the reporter's device to the dashboard, to a coding agent,
          to GitHub, into a release, and back to the same device to ask whether it's fixed.
        </title>
        <defs>
          <marker id="lc-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="#f87171" />
          </marker>
        </defs>
        <path d={LOOP_PATH} fill="none" stroke="#e5e5e5" strokeWidth="3" strokeLinejoin="round" />
        <path d={LOOP_PATH} fill="none" stroke="#a3a3a3" strokeWidth="1.5" strokeDasharray="4 6" strokeLinejoin="round" />

        {/* The "still broken" branch: back to the agent without a new report. */}
        <path d="M120 74 Q170 160 256 158" fill="none" stroke="#f87171" strokeWidth="1.5" strokeDasharray="5 4" markerEnd="url(#lc-arrow)" />
        <text x="140" y="140" fontSize="10" fill="#dc2626" textAnchor="middle">still broken?</text>
        <text x="140" y="153" fontSize="10" fill="#dc2626" textAnchor="middle">reopened</text>

        {/* What travels along each edge. */}
        <text x="200" y="40" fontSize="10" fill="#525252" textAnchor="middle">report</text>
        <text x="310" y="108" fontSize="10" fill="#525252" textAnchor="end">prompt</text>
        <text x="310" y="218" fontSize="10" fill="#525252" textAnchor="end">commit</text>
        <text x="200" y="290" fontSize="10" fill="#525252" textAnchor="middle">merged fix ships</text>
        <text x="90" y="208" fontSize="10" fontWeight="600" fill="#059669">is it</text>
        <text x="90" y="221" fontSize="10" fontWeight="600" fill="#059669">fixed?</text>

        {reduced ? null : (
          <g ref={dotRef} transform="translate(80 50)">
            <circle r="9" fill="#10b981" opacity="0.25" />
            <circle r="5" fill="#10b981" />
          </g>
        )}

        {LOOP_NODES.map((n, i) => (
          <g key={n.title}>
            <rect
              ref={(el) => {
                nodeRefs.current[i] = el;
              }}
              x={n.x - 58}
              y={n.y - 20}
              width="116"
              height="40"
              rx="10"
              fill="white"
              stroke="#d4d4d4"
              strokeWidth="1.5"
            />
            <text x={n.x} y={n.y - 2} fontSize="11.5" fontWeight="600" fill="#171717" textAnchor="middle">
              {n.title}
            </text>
            <text x={n.x} y={n.y + 12} fontSize="9.5" fill="#737373" textAnchor="middle">
              {n.sub}
            </text>
          </g>
        ))}

      </svg>
      <figcaption className="mt-2 text-center text-xs text-neutral-500">
        One report, one lap. It ends on the device where it started.
      </figcaption>
    </figure>
  );
}

// ---------------------------------------------------------------------------
// Small drawing helpers
// ---------------------------------------------------------------------------

/** A realistic, premium iPhone hardware frame (~1:2 proportions). */
function Phone({ children }: { children: ReactNode }) {
  return (
    <div className="relative h-[380px] w-[190px] shrink-0 select-none">
      {/* Hardware side buttons */}
      <span className="absolute -left-[2px] top-[58px] h-4 w-[2.5px] rounded-l-[2px] bg-neutral-400" />
      <span className="absolute -left-[2px] top-[84px] h-7 w-[2.5px] rounded-l-[2px] bg-neutral-400" />
      <span className="absolute -left-[2px] top-[118px] h-7 w-[2.5px] rounded-l-[2px] bg-neutral-400" />
      <span className="absolute -right-[2px] top-[92px] h-10 w-[2.5px] rounded-r-[2px] bg-neutral-400" />

      {/* Titanium outer frame with gradient rim and realistic shadow */}
      <div className="relative h-full w-full rounded-[2.3rem] bg-gradient-to-b from-neutral-200 via-neutral-400 to-neutral-500 p-[1.5px] shadow-[0_20px_45px_-12px_rgba(0,0,0,0.32),0_0_0_1px_rgba(0,0,0,0.06)]">
        {/* Inner black bezel */}
        <div className="relative h-full w-full rounded-[2.2rem] bg-neutral-950 p-[5px] ring-1 ring-white/10">
          {/* Glass display */}
          <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[1.9rem] bg-white">
            {/* iOS Status Bar */}
            <div className="relative z-20 flex h-7 items-center justify-between px-3 text-[9px] font-semibold text-neutral-800">
              <span className="tabular-nums tracking-tight">9:41</span>
              {/* Dynamic Island */}
              <div className="absolute left-1/2 top-1.5 z-30 flex h-3.5 w-16 -translate-x-1/2 items-center justify-end rounded-full bg-black pr-1.5 ring-1 ring-neutral-800">
                <span className="h-1.5 w-1.5 rounded-full bg-[#111827] ring-1 ring-neutral-700/60" />
              </div>
              <div className="flex items-center gap-1 opacity-80">
                {/* Cellular */}
                <svg className="h-2 w-2.5 fill-current" viewBox="0 0 16 12">
                  <rect x="0" y="8" width="2.5" height="4" rx="0.5" />
                  <rect x="4" y="6" width="2.5" height="6" rx="0.5" />
                  <rect x="8" y="3" width="2.5" height="9" rx="0.5" />
                  <rect x="12" y="0" width="2.5" height="12" rx="0.5" />
                </svg>
                {/* Battery */}
                <div className="relative flex h-2 w-3.5 items-center rounded-[2px] border border-current p-[0.5px]">
                  <div className="h-full w-2.5 rounded-[1px] bg-current" />
                  <div className="absolute -right-[2px] top-1/2 h-1 w-[1px] -translate-y-1/2 rounded-r-[0.5px] bg-current" />
                </div>
              </div>
            </div>
            {/* Screen Content */}
            <div className="relative flex-1 overflow-hidden">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The demo app's checkout screen. */
function CheckoutScreen({ annotate = false, delay = 0.2 }: { annotate?: boolean; delay?: number }) {
  return (
    <div className="relative flex h-full w-full flex-col justify-between px-3 pt-1 pb-3 font-sans text-[9px] text-neutral-700">
      <div className="space-y-2">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 pb-1.5">
          <span className="text-[11px] text-neutral-400">‹</span>
          <p className="text-[10.5px] font-semibold tracking-tight text-neutral-900">Checkout</p>
          <span className="flex h-2.5 w-2.5 items-center justify-center rounded-full bg-emerald-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
          </span>
        </div>

        {/* Order items */}
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-lg border border-neutral-100 bg-neutral-50/80 p-2">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded bg-amber-100 text-[11px]">👟</span>
              <div>
                <p className="text-[9.5px] font-medium leading-tight text-neutral-800">Sneakers</p>
                <p className="text-[8px] text-neutral-400">Size 42 · White</p>
              </div>
            </div>
            <span className="text-[9.5px] font-semibold text-neutral-800">$36.00</span>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-neutral-100 bg-neutral-50/80 p-2">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded bg-blue-100 text-[11px]">🧦</span>
              <div>
                <p className="text-[9.5px] font-medium leading-tight text-neutral-800">Socks ×2</p>
                <p className="text-[8px] text-neutral-400">Crew · Black</p>
              </div>
            </div>
            <span className="text-[9.5px] font-semibold text-neutral-800">$6.00</span>
          </div>

          {/* Pricing summary */}
          <div className="space-y-1.5 rounded-lg border border-neutral-100/60 bg-neutral-50/50 p-2">
            <div className="flex justify-between text-[8px] text-neutral-500">
              <span>Shipping</span>
              <span className="font-medium text-emerald-600">Free</span>
            </div>
            <div className="flex justify-between border-t border-neutral-200/60 pt-1 text-[10px] font-bold text-neutral-900">
              <span>Total</span>
              <span>$42.00</span>
            </div>
          </div>

          {/* Promo code field */}
          <div className="flex items-center justify-between rounded-lg border border-neutral-200/80 bg-white px-2.5 py-1.5 text-[8.5px] text-neutral-400">
            <span className="font-medium text-neutral-700">SUMMER42</span>
            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[8px] font-semibold text-emerald-600">Applied</span>
          </div>
        </div>
      </div>

      {/* Pay Button */}
      <div className="relative z-10 pt-2">
        <div className="flex items-center justify-center gap-1.5 rounded-xl bg-neutral-950 py-2.5 text-center text-[10.5px] font-semibold text-white shadow-md">
          <span>Pay $42.00</span>
          <span className="text-[9px] opacity-60">Pay</span>
        </div>
      </div>

      {/* SVG Annotation Box */}
      {annotate ? (
        <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full" viewBox="0 0 178 338">
          <rect
            x="8"
            y="288"
            width="162"
            height="42"
            rx="12"
            fill="none"
            stroke="#ef4444"
            strokeWidth="2.5"
            strokeDasharray="6 3"
            filter="drop-shadow(0 0 4px rgba(239, 68, 68, 0.5))"
            className="lc-draw"
            style={{ ...d(delay), "--lc-len": 400 } as CSSProperties}
          />
        </svg>
      ) : null}
    </div>
  );
}

function Window({ url, children }: { url: string; children: ReactNode }) {
  return (
    <div className="min-h-[380px] w-full overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-xl shadow-neutral-900/6">
      {/* Safari-like browser chrome */}
      <div className="flex items-center gap-2 border-b border-neutral-200/70 bg-neutral-100/80 px-3.5 py-2.5 backdrop-blur-sm">
        {/* macOS traffic lights */}
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F56] ring-1 ring-black/10" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#FFBD2E] ring-1 ring-black/10" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#27C93F] ring-1 ring-black/10" />
        </div>
        {/* URL Pill */}
        <div className="mx-auto flex max-w-[280px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-neutral-200/70 bg-white/90 px-2.5 py-0.5 text-[10px] text-neutral-500 shadow-2xs">
          <LockIcon className="h-2.5 w-2.5 text-neutral-400" />
          <span className="truncate font-mono">{url}</span>
        </div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Terminal({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-[380px] w-full overflow-hidden rounded-2xl border border-neutral-800 bg-[#0d1117] font-mono text-[11px] leading-relaxed text-neutral-200 shadow-2xl shadow-black/40">
      {/* Terminal Title Bar */}
      <div className="flex items-center justify-between border-b border-neutral-800/90 bg-[#161b22] px-3.5 py-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]/80 ring-1 ring-white/10" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]/80 ring-1 ring-white/10" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]/80 ring-1 ring-white/10" />
          </div>
          <span className="ml-1 font-mono text-[10px] font-medium text-neutral-400">{title}</span>
        </div>
        <span className="rounded bg-neutral-800/80 px-1.5 py-0.5 text-[9px] text-neutral-400">zsh</span>
      </div>
      <div className="space-y-1.5 break-words p-4">{children}</div>
    </div>
  );
}

/** Text that appears word by word, like someone typing it; wraps on narrow screens. */
function Typed({ text, delay = 0 }: { text: string; delay?: number }) {
  return (
    <>
      {text.split(" ").map((word, i) => (
        <span key={i} className="lc-word" style={d(delay + i * 0.09)}>
          {word}{" "}
        </span>
      ))}
    </>
  );
}

function StageBadge({ stage, className = "", style }: { stage: keyof typeof FIX_STAGE_META; className?: string; style?: CSSProperties }) {
  const meta = FIX_STAGE_META[stage];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.bg} ${meta.text} ${className}`} style={style}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

/** A placeholder that visibly turns into its value. */
function Swap({ token, value, delay }: { token: string; value: string; delay: number }) {
  return (
    <span className="inline-grid align-baseline font-mono">
      <span className="lc-fade-out rounded bg-violet-100 px-1.5 py-0.5 font-medium text-violet-700 [grid-area:1/1]" style={d(delay)}>
        {token}
      </span>
      <span className="lc-in rounded bg-emerald-100 px-1.5 py-0.5 font-semibold text-emerald-800 shadow-2xs [grid-area:1/1]" style={d(delay + 0.15)}>
        {value}
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// One scene per step
// ---------------------------------------------------------------------------

function ReportScene() {
  return (
    <div className="flex flex-col items-center justify-center gap-5 sm:flex-row">
      <Phone>
        <CheckoutScreen annotate delay={0.4} />
      </Phone>
      <div className="w-full max-w-[210px] space-y-2.5">
        <div
          className="lc-in rounded-2xl border border-neutral-200/90 bg-white/95 p-3.5 text-[11px] shadow-lg shadow-neutral-900/5 backdrop-blur-sm"
          style={d(1.3)}
        >
          <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-neutral-400">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
            Describe the problem
          </div>
          <p className="mt-1.5 font-medium leading-snug text-neutral-900">
            Pay button does not respond on tap
          </p>
        </div>
        <div
          className="lc-pop inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-3.5 py-1.5 text-[11px] font-semibold text-white shadow-md shadow-blue-500/20"
          style={d(2.2)}
        >
          <span>Send feedback</span>
          <span>↑</span>
        </div>
        <div
          className="lc-in flex items-center gap-1.5 rounded-lg border border-emerald-200/70 bg-emerald-50 px-2.5 py-1.5 text-[10.5px] font-medium text-emerald-800"
          style={d(2.8)}
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500 animate-pulse" />
          <span>Sent with screenshot, markup &amp; device context</span>
        </div>
      </div>
    </div>
  );
}

function InboxScene() {
  return (
    <Window url="feedback-kit.hejitech.workers.dev/projects/acme-shop">
      <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
        <div className="flex items-center gap-2">
          <p className="text-[12px] font-bold text-neutral-900">Feedback Reports</p>
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-600">
            3 open
          </span>
        </div>
        <span className="text-[10px] text-neutral-400">Live sync</span>
      </div>

      <div className="mt-3 space-y-2">
        {/* Active Feedback Card */}
        <div
          className="lc-in relative overflow-hidden rounded-xl border-2 border-blue-500/30 bg-gradient-to-br from-blue-50/50 via-white to-neutral-50/50 p-2.5 shadow-sm transition-all"
          style={d(0.3)}
        >
          <div className="flex gap-2.5">
            {/* Screenshot Thumbnail */}
            <div className="relative h-16 w-10 shrink-0 overflow-hidden rounded-md border border-neutral-300 bg-neutral-900 p-0.5 shadow-xs">
              <div className="relative h-full w-full overflow-hidden rounded-[2px] bg-white p-0.5 text-[4px]">
                <div className="mb-0.5 h-1 w-full rounded-[1px] bg-neutral-100" />
                <div className="mb-1 h-1 w-3/4 rounded-[1px] bg-neutral-100" />
                <div className="absolute inset-x-0.5 bottom-3 h-2 rounded-[1px] bg-neutral-900" />
                <div className="absolute inset-x-0 bottom-0 h-2.5 bg-neutral-200" />
                {/* Red highlight circle */}
                <div className="absolute inset-x-0 bottom-2 h-3 rounded-[2px] border border-red-500 bg-red-500/10" />
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-1.5">
                <p className="truncate text-[11.5px] font-semibold text-neutral-900">
                  Pay button does not respond on tap
                </p>
                <span
                  className="lc-pop shrink-0 rounded-full bg-blue-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-xs"
                  style={d(0.9)}
                >
                  New
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-neutral-500">Reported just now from iOS Simulator</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {[
                  { label: "Checkout", color: "bg-neutral-100 text-neutral-700" },
                  { label: "iPhone 16 Pro", color: "bg-neutral-100 text-neutral-700" },
                  { label: "iOS 18.2", color: "bg-neutral-100 text-neutral-700" },
                  { label: "build 41", color: "bg-amber-50 text-amber-800 border border-amber-200/60" },
                ].map((chip, i) => (
                  <span
                    key={chip.label}
                    className={`lc-in rounded-md px-1.5 py-0.5 text-[9px] font-medium ${chip.color}`}
                    style={d(1.1 + i * 0.12)}
                  >
                    {chip.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Older Reports */}
        {[
          { title: "Dark mode: prices unreadable", screen: "Cart", time: "2h ago" },
          { title: "Crash when removing last cart item", screen: "Checkout", time: "5h ago" },
        ].map((item) => (
          <div
            key={item.title}
            className="flex items-center justify-between rounded-xl border border-neutral-100 bg-neutral-50/60 px-3 py-2 opacity-65"
          >
            <div className="flex items-center gap-2 truncate">
              <div className="h-2 w-2 rounded-full bg-neutral-300" />
              <p className="truncate text-[11px] font-medium text-neutral-700">{item.title}</p>
            </div>
            <div className="flex items-center gap-1.5 text-[9.5px] text-neutral-400">
              <span>{item.screen}</span>
              <span>·</span>
              <span>{item.time}</span>
            </div>
          </div>
        ))}
      </div>
    </Window>
  );
}

function PromptScene() {
  return (
    <div className="min-h-[316px] w-full overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-xl shadow-neutral-900/6">
      <div className="flex items-center justify-between border-b border-neutral-200/70 bg-neutral-100/80 px-3.5 py-2.5 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F56] ring-1 ring-black/10" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#FFBD2E] ring-1 ring-black/10" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#27C93F] ring-1 ring-black/10" />
          </div>
          <span className="ml-2 font-mono text-[10px] font-medium text-neutral-500">prompt-template.md</span>
        </div>
        <span
          className="lc-pop inline-flex items-center gap-1 rounded-lg bg-neutral-900 px-2.5 py-1 text-[10px] font-medium text-white shadow-xs"
          style={d(3.2)}
        >
          <CopyIcon className="h-2.5 w-2.5" />
          Copy Prompt
        </span>
      </div>

      <div className="space-y-2 p-4 font-mono text-[11px] leading-relaxed text-neutral-800">
        <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-2 font-sans text-[10px] text-neutral-500">
          Filled dynamically from report <code className="font-mono font-semibold text-violet-600">fb_8c2</code>
        </div>
        <p>
          Fix the bug on the <Swap token="{{screen_name}}" value="Checkout" delay={0.6} /> screen.
        </p>
        <p>
          User&apos;s report:{" "}
          <Swap token="{{feedback_text}}" value="Pay button does not respond on tap" delay={1.1} />
        </p>
        <p>
          Device: <Swap token="{{device_model}}" value="iPhone 16 Pro" delay={1.6} />,{" "}
          <Swap token="{{os_name}} {{os_version}}" value="iOS 18.2" delay={1.9} />
        </p>
        <p>
          App version: <Swap token="{{app_build}}" value="Build 41" delay={2.2} />
        </p>
        <p className="truncate text-neutral-500">
          Screenshot:{" "}
          <Swap token="{{screenshot_url}}" value="https://feedback-kit.hejitech.workers.dev/screenshots/fb_8c2/annotated.png" delay={2.5} />
        </p>
      </div>
    </div>
  );
}

function AgentScene() {
  const line = (delay: number, children: ReactNode) => (
    <p className="lc-in" style={d(delay)}>
      {children}
    </p>
  );
  return (
    <Terminal title="claude — ~/acme-shop (main)">
      <p className="text-neutral-400">
        <span className="text-emerald-400">›</span>{" "}
        <Typed text="Look at feedback report fb_8c2 in FeedbackKit and fix it." delay={0.2} />
      </p>
      {line(
        1.6,
        <>
          <span className="text-emerald-400">⏺</span>{" "}
          <span className="font-medium text-white">feedbackkit · get_prompt</span>
          <span className="text-neutral-400">(fb_8c2)</span>{" "}
          <span className="text-neutral-500">— screenshot + context loaded</span>
        </>,
      )}
      {line(
        2.2,
        <>
          <span className="text-emerald-400">⏺</span>{" "}
          <span className="font-medium text-white">feedbackkit · claim_feedback</span>{" "}
          <StageBadge stage="agent_working" className="ml-1 font-sans" />
        </>,
      )}
      {line(
        2.9,
        <>
          <span className="text-sky-400">✎</span> Edit{" "}
          <span className="font-semibold text-neutral-100">CheckoutView.swift</span>{" "}
          <span className="rounded bg-emerald-950/80 px-1 font-semibold text-emerald-400">+6</span>{" "}
          <span className="rounded bg-red-950/80 px-1 font-semibold text-red-400">−2</span>
        </>,
      )}
      {line(
        3.5,
        <>
          <span className="text-emerald-400">⏺</span>{" "}
          <span className="font-medium text-white">feedbackkit · attach_preview</span>{" "}
          <span className="text-neutral-500">— after-fix preview attached</span>
        </>,
      )}
      {line(
        4.1,
        <>
          <span className="text-neutral-400">$</span> git commit -m &quot;Fix Pay button tap handler and layout&quot;
        </>,
      )}
      {line(
        4.4,
        <span className="inline-block rounded-md bg-amber-400/15 px-2 py-0.5 font-medium text-amber-300">
          FeedbackKit: fb_8c2
        </span>,
      )}
    </Terminal>
  );
}

function MergeScene() {
  return (
    <div className="grid min-h-[380px] w-full gap-3 sm:grid-cols-2">
      {/* GitHub PR card */}
      <div className="flex flex-col justify-between rounded-2xl border border-neutral-200/90 bg-white p-3.5 shadow-xl shadow-neutral-900/5">
        <div>
          <div className="flex items-center justify-between text-[10px] text-neutral-400">
            <div className="flex items-center gap-1.5">
              <GitHubIcon className="h-3 w-3 text-neutral-700" />
              <span className="font-medium text-neutral-600">acme/acme-shop</span>
            </div>
            <span>#128</span>
          </div>

          <p className="mt-2 text-[12.5px] font-bold leading-tight text-neutral-900">
            Fix Pay button tap handler and layout
          </p>

          <div className="mt-2.5 inline-grid">
            <span
              className="lc-fade-out inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-semibold text-white shadow-xs [grid-area:1/1]"
              style={d(1.6)}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
              Open
            </span>
            <span
              className="lc-pop inline-flex items-center gap-1 rounded-full bg-purple-600 px-2.5 py-0.5 text-[10px] font-semibold text-white shadow-xs [grid-area:1/1]"
              style={d(1.7)}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
              Merged
            </span>
          </div>
        </div>

        <div className="mt-3 space-y-1 rounded-xl border border-neutral-100 bg-neutral-50/80 p-2.5 font-mono text-[10px] text-neutral-600">
          <p className="font-sans text-[10px] text-neutral-700">Fixes Pay button click handler and layout constraints.</p>
          <div className="pt-1">
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9.5px] font-medium text-amber-800">
              FeedbackKit: fb_8c2
            </span>
          </div>
        </div>
      </div>

      {/* Dashboard Fix Loop Card */}
      <div className="rounded-2xl border border-neutral-200/90 bg-white p-3.5 shadow-xl shadow-neutral-900/5">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
            Fix loop status
          </p>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        </div>

        <div className="mt-3 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <StageBadge stage="agent_working" />
          </div>

          <div className="relative ml-1 space-y-3 border-l border-neutral-200 pl-4">
            <div>
              <StageBadge stage="pr_open" className="lc-in" style={d(0.5)} />
              <p className="lc-in mt-0.5 text-[9.5px] text-neutral-500" style={d(0.5)}>
                github-webhook linked #128
              </p>
            </div>

            <div>
              <StageBadge stage="merged" className="lc-pop" style={d(1.8)} />
              <p className="lc-in mt-0.5 text-[9.5px] text-neutral-500" style={d(1.9)}>
                Ready for next release
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ShipScene() {
  return (
    <Terminal title="CI · after TestFlight / Beta upload">
      <p className="text-neutral-400">
        <span className="text-emerald-400">$</span>{" "}
        <Typed text="npx feedbackkit-cli release --build 42" delay={0.2} />
      </p>
      <p className="lc-in pt-1 text-neutral-400" style={d(1.6)}>
        <span className="text-sky-400">ℹ</span> Build 42 @ 9f3c2ab — <span className="text-amber-300">beta</span>
      </p>
      <div className="lc-in my-1.5 space-y-1 rounded-lg border border-neutral-800 bg-neutral-900/90 p-2" style={d(2.1)}>
        <div className="flex items-center gap-2">
          <span className="rounded bg-emerald-500/20 px-1 text-[9px] font-semibold text-emerald-400">SHIP</span>
          <span className="font-bold text-amber-300">fb_8c2</span>
          <span className="truncate text-neutral-300">Pay button does not respond on tap</span>
        </div>
      </div>
      <p className="lc-in font-medium text-emerald-400" style={d(2.6)}>
        ✓ Shipped 1 fix. Reporter will be prompted on build 42 or newer.
      </p>
      <div className="pt-2 font-sans">
        <StageBadge stage="shipped" className="lc-pop" style={d(3.1)} />
      </div>
    </Terminal>
  );
}

function VerifyScene() {
  return (
    <div className="flex flex-col items-center justify-center gap-5 sm:flex-row">
      <Phone>
        <CheckoutScreen />
        {/* Dim overlay */}
        <div className="lc-in absolute inset-0 z-20 bg-black/40 backdrop-blur-[1px]" style={d(0.3)} />
        {/* iOS verification modal sheet */}
        <div
          className="lc-slide-up absolute inset-x-0 bottom-0 z-30 rounded-t-[1.4rem] bg-white p-3.5 shadow-2xl"
          style={d(0.4)}
        >
          {/* iOS sheet handle bar */}
          <div className="mx-auto mb-2 h-1 w-8 rounded-full bg-neutral-300" />
          <div className="flex items-center gap-1.5">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-[9px] font-bold text-emerald-700">
              ✓
            </span>
            <p className="text-[11px] font-bold leading-tight text-neutral-900">
              We fixed something you reported
            </p>
          </div>
          <p className="mt-0.5 text-[8.5px] text-neutral-500">Fixed in build 42 (the one you&apos;re using now).</p>

          <div className="mt-2 flex gap-2.5 rounded-lg border border-neutral-100 bg-neutral-50 p-2">
            <div className="relative h-11 w-8 shrink-0 overflow-hidden rounded border border-neutral-300 bg-neutral-900 p-0.5">
              <div className="h-full w-full rounded-[1px] bg-white p-0.5 text-[4px]">
                <div className="mb-0.5 h-0.5 w-full bg-neutral-200" />
                <div className="absolute inset-x-0.5 bottom-1 h-2 rounded-[1px] border border-red-500" />
              </div>
            </div>
            <div className="min-w-0 flex-1 space-y-0.5 text-[8px] leading-tight text-neutral-600">
              <p className="truncate font-medium text-neutral-800">
                &ldquo;Pay button is broken...&rdquo;
              </p>
              <p className="text-neutral-500">Changed: Fix Pay button layout</p>
            </div>
          </div>

          <div
            className="lc-tap mt-2.5 rounded-xl bg-blue-600 py-2 text-center text-[10.5px] font-semibold text-white shadow-md shadow-blue-500/25"
            style={d(1.8)}
          >
            Yes, it&apos;s fixed
          </div>
          <div className="mt-1 py-0.5 text-center text-[9px] font-medium text-neutral-500 hover:text-neutral-700">
            No, still broken
          </div>
        </div>
      </Phone>

      <div className="w-full max-w-[210px] space-y-3">
        <div className="space-y-2 rounded-2xl border border-neutral-200/90 bg-white/95 p-3.5 shadow-lg shadow-neutral-900/5 backdrop-blur-sm">
          <p className="lc-in text-[11px] font-medium leading-snug text-neutral-700" style={d(0.6)}>
            Their own annotated screenshot shown on the build with the fix.
          </p>
          <div className="pt-1">
            <StageBadge stage="verified" className="lc-pop !text-[11px] px-2.5 py-1" style={d(2.3)} />
          </div>
          <p className="lc-in border-t border-neutral-100 pt-1 text-[10.5px] leading-snug text-neutral-500" style={d(2.6)}>
            Status → <span className="font-semibold text-neutral-900">Resolved</span>. Closed by the person who reported it.
          </p>
        </div>
      </div>
    </div>
  );
}

function PromoteScene() {
  return (
    <Window url="feedback-kit.hejitech.workers.dev/projects/acme-shop?tab=releases">
      <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
        <p className="text-[12px] font-bold text-neutral-900">Releases</p>
        <span className="text-[10px] text-neutral-400">Production &amp; Betas</span>
      </div>

      <div className="mt-3 space-y-2.5">
        {/* Ready to promote release card */}
        <div className="rounded-xl border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-50/40 via-white to-neutral-50 p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] font-bold text-neutral-900">Build 42</span>
              <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-[9px] font-semibold text-neutral-600">
                Beta
              </span>
            </div>
            <span
              className="lc-pop inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[9.5px] font-semibold text-emerald-800"
              style={d(1.3)}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
              All 3 verified — ready
            </span>
          </div>

          <div className="mt-2.5 h-2 overflow-hidden rounded-full border border-neutral-200/50 bg-neutral-100">
            <div
              className="lc-grow h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
              style={{ ...d(0.2), "--lc-dur": "1s" } as CSSProperties}
            />
          </div>

          <p className="mt-1.5 text-[10px] font-medium text-neutral-500">
            3 fixes · 3 verified by real reporters · 0 reopened
          </p>

          <span
            className="lc-pop mt-3 inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-1.5 text-[10.5px] font-semibold text-white shadow-md hover:bg-neutral-800"
            style={d(1.9)}
          >
            <span>Promote to production</span>
            <span>→</span>
          </span>
        </div>

        {/* Previous release */}
        <div className="flex items-center justify-between rounded-xl border border-neutral-100 bg-neutral-50/60 p-2.5 opacity-60">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-neutral-400" />
            <span className="text-[11px] font-medium text-neutral-700">Build 41</span>
          </div>
          <span className="text-[10px] text-neutral-400">In production</span>
        </div>
      </div>
    </Window>
  );
}

const SCENES = [ReportScene, InboxScene, PromptScene, AgentScene, MergeScene, ShipScene, VerifyScene, PromoteScene];

/** One step's scene, played the first time it scrolls into view. */
export function LifecycleScene({ step }: { step: number }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  const [played, setPlayed] = useState(false);
  useEffect(() => {
    if (inView) setPlayed(true);
  }, [inView]);
  const Scene = SCENES[step];
  return (
    <div
      ref={ref}
      className="flex min-h-[316px] items-center justify-center rounded-2xl border border-neutral-200/70 bg-gradient-to-b from-neutral-50/80 via-white to-neutral-50/60 p-4 shadow-inner"
    >
      {played ? <Scene /> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The auto-playing walkthrough
// ---------------------------------------------------------------------------

// How far along the fix-stage stepper each step has reached (-1 = reported only).
const REACHED = [-1, -1, -1, 0, 2, 3, 4, 4];

export function LifecyclePlayer() {
  const reduced = usePrefersReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>(0.4);
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const playing = inView && !paused && !reduced;

  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => setStep((s) => (s + 1) % LIFECYCLE_STEPS.length), STEP_MS);
    return () => clearTimeout(timer);
  }, [playing, step]);

  const go = (next: number) => {
    setStep((next + LIFECYCLE_STEPS.length) % LIFECYCLE_STEPS.length);
    setPaused(true);
  };
  const Scene = SCENES[step];
  const current = LIFECYCLE_STEPS[step];

  return (
    <div
      ref={ref}
      className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-xl shadow-neutral-900/5 ring-1 ring-neutral-950/[0.04]"
    >
      {/* Sleek Segmented Stepper Bar */}
      <div className="border-b border-neutral-200/80 bg-neutral-50/70 p-2 backdrop-blur-sm">
        <ol className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-8" aria-label="Walkthrough steps">
          {LIFECYCLE_STEPS.map((s, i) => {
            const isActive = i === step;
            const isPast = i < step;
            return (
              <li key={s.title}>
                <button
                  type="button"
                  onClick={() => go(i)}
                  aria-current={isActive ? "step" : undefined}
                  className={`group relative flex h-full w-full flex-col justify-between rounded-xl px-2.5 py-2 text-left transition-all duration-200 ${
                    isActive
                      ? "bg-white text-neutral-950 shadow-sm ring-1 ring-neutral-950/5"
                      : isPast
                      ? "text-neutral-700 hover:bg-white/60 hover:text-neutral-900"
                      : "text-neutral-400 hover:bg-white/40 hover:text-neutral-700"
                  }`}
                >
                  <div className="flex w-full items-center justify-between">
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold tabular-nums transition-colors ${
                        isActive
                          ? "bg-neutral-900 text-white"
                          : isPast
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-neutral-200/80 text-neutral-500"
                      }`}
                    >
                      {isPast ? "✓" : i + 1}
                    </span>
                    <span className="text-[9px] font-medium uppercase tracking-wider text-neutral-400">
                      {s.where.split(" ")[0]}
                    </span>
                  </div>
                  <span className={`mt-1.5 block text-[11px] font-medium leading-tight ${isActive ? "text-neutral-950" : ""}`}>
                    {s.title}
                  </span>
                  {isActive && playing ? (
                    <span
                      key={`${step}-progress`}
                      className="lc-grow absolute inset-x-2 bottom-1 h-0.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]"
                      style={{ "--lc-dur": `${STEP_MS}ms` } as CSSProperties}
                    />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Main Showcase & Control Stage */}
      <div className="grid grid-cols-1 gap-6 p-5 sm:p-6 lg:grid-cols-[1fr_300px] lg:items-stretch">
        {/* Left Scene Stage */}
        <div
          key={step}
          className="relative flex min-h-[440px] min-w-0 items-center justify-center rounded-xl border border-neutral-200/60 bg-gradient-to-b from-neutral-50/80 via-white to-neutral-50/60 p-6 shadow-inner sm:p-8"
        >
          {/* Subtle studio backdrop grid/glow */}
          <div
            className="pointer-events-none absolute inset-0 rounded-xl bg-[linear-gradient(to_right,rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.02)_1px,transparent_1px)] bg-[size:24px_24px]"
            aria-hidden
          />
          <div className="relative z-10 flex w-full items-center justify-center">
            <Scene />
          </div>
        </div>

        {/* Right Info Panel */}
        <div className="flex min-h-[440px] flex-col justify-between space-y-4 rounded-xl border border-neutral-200/70 bg-neutral-50/70 p-5 sm:p-6">
          <div>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200/60 bg-white px-2.5 py-0.5 text-[10px] font-semibold text-neutral-700 shadow-2xs">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                Step {step + 1} of {LIFECYCLE_STEPS.length}
              </span>
              <span className="text-[11px] font-medium text-neutral-400">
                {current.where}
              </span>
            </div>

            <h4 className="mt-3 text-base font-bold tracking-tight text-neutral-900">
              {current.title}
            </h4>
            <p className="mt-1.5 text-xs leading-relaxed text-neutral-600">
              {current.caption}
            </p>
          </div>

          {/* Fix Stage Pipeline */}
          <div className="border-t border-neutral-200/60 pt-3.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
              Fix stage progress
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              <span className="inline-flex items-center rounded-full bg-neutral-900 px-2 py-0.5 text-[9.5px] font-medium text-white shadow-2xs">
                Reported
              </span>
              {FIX_STAGE_ORDER.map((s, i) =>
                i <= REACHED[step] ? (
                  <StageBadge key={s} stage={s} className="py-0.5 text-[9.5px]" />
                ) : (
                  <span
                    key={s}
                    className="inline-flex items-center rounded-full border border-dashed border-neutral-300 bg-white/50 px-2 py-0.5 text-[9.5px] text-neutral-400"
                  >
                    {FIX_STAGE_META[s].label}
                  </span>
                ),
              )}
            </div>
          </div>

          {/* Controls Bar */}
          <div className="flex items-center justify-between border-t border-neutral-200/60 pt-3.5">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => go(step - 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-700 shadow-2xs transition-all hover:border-neutral-300 hover:bg-neutral-100 active:scale-95"
                aria-label="Previous step"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => (reduced ? go(step + 1) : setPaused((p) => !p))}
                className="flex h-8 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-800 shadow-2xs transition-all hover:border-neutral-300 hover:bg-neutral-100 active:scale-95"
              >
                {reduced ? (
                  "Next"
                ) : paused ? (
                  <>
                    <span className="text-[10px]">▶</span>
                    <span>Play</span>
                  </>
                ) : (
                  <>
                    <span className="text-[10px]">❚❚</span>
                    <span>Pause</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => go(step + 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-700 shadow-2xs transition-all hover:border-neutral-300 hover:bg-neutral-100 active:scale-95"
                aria-label="Next step"
              >
                ›
              </button>
            </div>

            <span className="font-mono text-xs font-semibold tabular-nums text-neutral-400">
              0{step + 1} / 0{LIFECYCLE_STEPS.length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
