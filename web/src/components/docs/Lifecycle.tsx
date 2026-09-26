import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { FIX_STAGE_META, FIX_STAGE_ORDER } from "@/lib/fixStageMeta";

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

function Phone({ children }: { children: ReactNode }) {
  return (
    <div className="relative h-[260px] w-[148px] shrink-0 rounded-[1.6rem] bg-neutral-900 p-1.5 shadow-xl">
      <div className="relative h-full w-full overflow-hidden rounded-[1.25rem] bg-white">
        <div className="absolute left-1/2 top-1.5 z-10 h-2.5 w-10 -translate-x-1/2 rounded-full bg-black" />
        {children}
      </div>
    </div>
  );
}

/** The demo app's checkout screen, with the Pay button half under the keyboard. */
function CheckoutScreen({ annotate = false, fixed = false, delay = 0.2 }: { annotate?: boolean; fixed?: boolean; delay?: number }) {
  return (
    <div className="relative h-full w-full px-2.5 pt-6 text-[8px] text-neutral-700">
      <p className="text-[10px] font-semibold text-neutral-900">Checkout</p>
      <div className="mt-2 space-y-1.5">
        {["Sneakers", "Socks ×2", "Shipping"].map((item) => (
          <div key={item} className="flex items-center justify-between rounded bg-neutral-50 px-1.5 py-1">
            <span>{item}</span>
            <span className="h-1.5 w-6 rounded bg-neutral-200" />
          </div>
        ))}
        <div className="flex justify-between px-1.5 pt-1 font-semibold text-neutral-900">
          <span>Total</span>
          <span>$42.00</span>
        </div>
        <div className="rounded border border-neutral-200 px-1.5 py-1 text-neutral-400">Promo code|</div>
      </div>
      <div
        className={`absolute inset-x-2.5 rounded-md bg-neutral-900 py-1.5 text-center text-[9px] font-semibold text-white ${
          fixed ? "bottom-[92px]" : "bottom-[74px]"
        }`}
      >
        Pay $42.00
      </div>
      {/* Keyboard */}
      <div className="absolute inset-x-0 bottom-0 h-[84px] bg-neutral-200 p-1">
        <div className="grid grid-cols-10 gap-[2px]">
          {Array.from({ length: 30 }).map((_, i) => (
            <div key={i} className="h-3.5 rounded-[2px] bg-white" />
          ))}
        </div>
        <div className="mx-auto mt-[3px] h-3.5 w-2/3 rounded-[2px] bg-white" />
      </div>
      {annotate ? (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 136 248" preserveAspectRatio="none">
          <rect
            x="6"
            y="143"
            width="124"
            height="36"
            rx="4"
            fill="none"
            stroke="#ef4444"
            strokeWidth="2.5"
            className="lc-draw"
            style={{ ...d(delay), "--lc-len": 330 } as CSSProperties}
          />
        </svg>
      ) : null}
    </div>
  );
}

function Window({ url, children }: { url: string; children: ReactNode }) {
  return (
    <div className="min-h-[260px] w-full overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg">
      <div className="flex items-center gap-1.5 border-b border-neutral-100 bg-neutral-50 px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-red-300" />
        <span className="h-2 w-2 rounded-full bg-amber-300" />
        <span className="h-2 w-2 rounded-full bg-emerald-300" />
        <span className="ml-2 truncate rounded bg-white px-2 py-0.5 text-[10px] text-neutral-400">{url}</span>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function Terminal({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-[260px] w-full overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 font-mono text-[11px] leading-relaxed text-neutral-200 shadow-lg">
      <div className="border-b border-neutral-800 px-3 py-1.5 text-[10px] text-neutral-500">{title}</div>
      <div className="space-y-1 break-words p-3">{children}</div>
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
    <span className="inline-grid align-baseline">
      <span className="lc-fade-out rounded bg-violet-100 px-1 text-violet-700 [grid-area:1/1]" style={d(delay)}>
        {token}
      </span>
      <span className="lc-in rounded bg-emerald-100 px-1 text-emerald-800 [grid-area:1/1]" style={d(delay + 0.15)}>
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
    <div className="flex items-center justify-center gap-4">
      <Phone>
        <CheckoutScreen annotate delay={0.4} />
      </Phone>
      <div className="w-44 space-y-2">
        <div className="lc-in rounded-lg border border-neutral-200 bg-white p-2 text-[11px] shadow-sm" style={d(1.3)}>
          <p className="text-[9px] uppercase tracking-wide text-neutral-400">Describe the problem</p>
          <p className="mt-0.5 text-neutral-800">Pay button is hidden behind the keyboard</p>
        </div>
        <div className="lc-pop inline-flex items-center gap-1 rounded-full bg-blue-600 px-3 py-1 text-[11px] font-medium text-white" style={d(2.2)}>
          Send ↑
        </div>
        <p className="lc-in text-[11px] text-emerald-700" style={d(2.8)}>
          ✓ Sent with screenshot, annotation and device info
        </p>
      </div>
    </div>
  );
}

function InboxScene() {
  return (
    <Window url="feedback-kit.hejitech.workers.dev/projects/acme-shop">
      <p className="text-[11px] font-semibold text-neutral-900">Feedback</p>
      <div className="mt-2 space-y-1.5">
        <div className="lc-in flex gap-2 rounded-lg border border-blue-200 bg-blue-50/60 p-2" style={d(0.3)}>
          <div className="relative h-14 w-9 shrink-0 overflow-hidden rounded border border-neutral-200 bg-white">
            <div className="absolute inset-x-1 bottom-4 h-1.5 rounded-sm bg-neutral-800" />
            <div className="absolute inset-x-0 bottom-0 h-4 bg-neutral-200" />
            <div className="absolute inset-x-0.5 bottom-3.5 h-2.5 rounded-sm border border-red-500" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-[11px] font-medium text-neutral-900">Pay button is hidden behind the keyboard</p>
              <span className="lc-pop shrink-0 rounded-full bg-blue-600 px-1.5 py-0.5 text-[9px] font-semibold text-white" style={d(0.9)}>
                New
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {["Checkout", "iPhone16,1", "iOS 18.2", "build 41", "en_US"].map((chip, i) => (
                <span key={chip} className="lc-in rounded bg-white px-1.5 py-0.5 text-[9px] text-neutral-600 ring-1 ring-neutral-200" style={d(1.1 + i * 0.15)}>
                  {chip}
                </span>
              ))}
            </div>
          </div>
        </div>
        {["Dark mode: prices unreadable", "Crash when removing last cart item"].map((t) => (
          <div key={t} className="flex items-center gap-2 rounded-lg border border-neutral-100 p-2 opacity-60">
            <div className="h-8 w-6 rounded bg-neutral-100" />
            <p className="text-[11px] text-neutral-600">{t}</p>
          </div>
        ))}
      </div>
    </Window>
  );
}

function PromptScene() {
  return (
    <div className="min-h-[260px] w-full overflow-hidden rounded-xl border border-neutral-200 bg-white p-4 font-mono text-[11px] leading-6 text-neutral-800 shadow-lg">
      <div className="mb-2 flex items-center justify-between font-sans">
        <span className="text-[10px] uppercase tracking-wide text-neutral-400">Prompt template → merged prompt</span>
        <span className="lc-pop rounded bg-neutral-900 px-2 py-0.5 text-[10px] text-white" style={d(3.2)}>
          Copy Merged Prompt
        </span>
      </div>
      <p>
        Fix the bug on the <Swap token="{{screen_name}}" value="Checkout" delay={0.6} /> screen.
      </p>
      <p>
        User's report: <Swap token="{{feedback_text}}" value="Pay button is hidden behind the keyboard" delay={1.1} />
      </p>
      <p>
        Device: <Swap token="{{device_model}}" value="iPhone16,1" delay={1.6} />,{" "}
        <Swap token="{{os_name}} {{os_version}}" value="iOS 18.2" delay={1.9} />
      </p>
      <p>
        App version: <Swap token="{{app_build}}" value="41" delay={2.2} />
      </p>
      <p className="truncate">
        Screenshot: <Swap token="{{screenshot_url}}" value="https://…/annotated.png" delay={2.5} />
      </p>
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
    <Terminal title="claude — ~/acme-shop">
      <p className="text-neutral-400">
        › <Typed text="Look at feedback report fb_8c2 in FeedbackKit and fix it." delay={0.2} />
      </p>
      {line(1.6, <><span className="text-emerald-400">⏺</span> feedbackkit · get_prompt(fb_8c2) <span className="text-neutral-500">— screenshot attached</span></>)}
      {line(2.2, <><span className="text-emerald-400">⏺</span> feedbackkit · claim_feedback <StageBadge stage="agent_working" className="ml-1 font-sans" /></>)}
      {line(2.9, <><span className="text-sky-400">✎</span> Edit CheckoutView.swift <span className="text-emerald-400">+6</span> <span className="text-red-400">−2</span></>)}
      {line(3.5, <><span className="text-emerald-400">⏺</span> feedbackkit · attach_after_screenshot <span className="text-neutral-500">— before/after saved</span></>)}
      {line(4.1, <>$ git commit -m "Keep Pay above the keyboard"</>)}
      {line(4.4, <span className="rounded bg-amber-400/15 px-1 text-amber-300">      FeedbackKit: fb_8c2</span>)}
    </Terminal>
  );
}

function MergeScene() {
  return (
    <div className="grid min-h-[260px] w-full gap-3 sm:grid-cols-2">
      <div className="rounded-xl border border-neutral-200 bg-white p-3 shadow-lg">
        <p className="text-[10px] text-neutral-400">acme/acme-shop · Pull request</p>
        <p className="mt-1 text-[13px] font-semibold text-neutral-900">
          Keep Pay above the keyboard <span className="font-normal text-neutral-400">#128</span>
        </p>
        <div className="mt-2 inline-grid">
          <span className="lc-fade-out rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-medium text-white [grid-area:1/1]" style={d(1.6)}>
            Open
          </span>
          <span className="lc-pop rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-medium text-white [grid-area:1/1]" style={d(1.7)}>
            Merged
          </span>
        </div>
        <div className="mt-3 rounded border border-neutral-100 bg-neutral-50 p-2 font-mono text-[10px] text-neutral-600">
          Lifts the Pay button with the keyboard inset.
          <br />
          <span className="rounded bg-amber-100 px-1 text-amber-800">FeedbackKit: fb_8c2</span>
        </div>
      </div>
      <div className="rounded-xl border border-neutral-200 bg-white p-3 shadow-lg">
        <p className="text-[10px] uppercase tracking-wide text-neutral-400">Fix loop in your dashboard</p>
        <div className="mt-3 space-y-2">
          <StageBadge stage="agent_working" />
          <div>
            <StageBadge stage="pr_open" className="lc-in" style={d(0.5)} />
            <span className="lc-in ml-2 text-[10px] text-neutral-400" style={d(0.5)}>
              github-webhook saw #128
            </span>
          </div>
          <div>
            <StageBadge stage="merged" className="lc-pop" style={d(1.8)} />
            <span className="lc-in ml-2 text-[10px] text-neutral-400" style={d(1.9)}>
              waits for a release
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ShipScene() {
  return (
    <Terminal title="CI · after the TestFlight upload">
      <p>
        $ <Typed text="npx feedbackkit-cli release --build 42" delay={0.2} />
      </p>
      <p className="lc-in text-neutral-400" style={d(1.6)}>
        Build 42 @ 9f3c2ab — beta
      </p>
      <p className="lc-in" style={d(2.1)}>
        {"  "}ship  <span className="text-amber-300">fb_8c2</span>  Pay button is hidden behind the keyboard
      </p>
      <p className="lc-in text-emerald-400" style={d(2.6)}>
        Shipped 1 fix(es). Their reporters will be asked to confirm on build 42 or newer.
      </p>
      <div className="pt-2 font-sans">
        <StageBadge stage="shipped" className="lc-pop" style={d(3.1)} />
      </div>
    </Terminal>
  );
}

function VerifyScene() {
  return (
    <div className="flex items-center justify-center gap-4">
      <Phone>
        <CheckoutScreen fixed />
        <div className="absolute inset-0 bg-black/30 lc-in" style={d(0.3)} />
        <div className="lc-slide-up absolute inset-x-0 bottom-0 rounded-t-2xl bg-white p-2.5 shadow-2xl" style={d(0.4)}>
          <p className="text-[10px] font-semibold leading-tight text-neutral-900">We fixed something you reported</p>
          <p className="text-[8px] text-neutral-500">Fixed in build 42 — the one you're using now.</p>
          <div className="mt-1.5 flex gap-2">
            <div className="relative h-14 w-9 shrink-0 overflow-hidden rounded border border-neutral-200 bg-neutral-50">
              <div className="absolute inset-x-1 bottom-4 h-1.5 rounded-sm bg-neutral-800" />
              <div className="absolute inset-x-0 bottom-0 h-4 bg-neutral-200" />
              <div className="absolute inset-x-0.5 bottom-3.5 h-2.5 rounded-sm border border-red-500" />
            </div>
            <p className="text-[8.5px] leading-snug text-neutral-600">
              You reported "Pay button is hidden behind the keyboard"
              <br />
              What changed: Keep Pay above the keyboard
            </p>
          </div>
          <div className="lc-tap mt-2 rounded-md bg-blue-600 py-1 text-center text-[9px] font-semibold text-white" style={d(1.8)}>
            Yes, it's fixed
          </div>
          <div className="mt-1 py-0.5 text-center text-[9px] text-neutral-500">No, still broken</div>
        </div>
      </Phone>
      <div className="w-40 space-y-2">
        <p className="lc-in text-[11px] text-neutral-600" style={d(0.6)}>
          Their own annotated screenshot, on the build that has the fix.
        </p>
        <StageBadge stage="verified" className="lc-pop" style={d(2.3)} />
        <p className="lc-in text-[11px] text-neutral-500" style={d(2.6)}>
          Status → <span className="font-medium text-neutral-800">resolved</span>. You didn't close it; they did.
        </p>
      </div>
    </div>
  );
}

function PromoteScene() {
  return (
    <Window url="feedback-kit.hejitech.workers.dev/projects/acme-shop?tab=releases">
      <p className="text-[11px] font-semibold text-neutral-900">Releases</p>
      <div className="mt-2 space-y-2">
        <div className="rounded-lg border border-neutral-200 p-2.5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium text-neutral-900">
              Build 42 <span className="ml-1 rounded bg-neutral-100 px-1 text-[9px] text-neutral-500">beta</span>
            </p>
            <span className="lc-pop rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700" style={d(1.3)}>
              All 3 verified — ready
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100">
            <div className="lc-grow h-full rounded-full bg-emerald-500" style={{ ...d(0.2), "--lc-dur": "1s" } as CSSProperties} />
          </div>
          <p className="mt-1 text-[10px] text-neutral-400">3 fixes · 3 verified by reporters · 0 reopened</p>
          <span className="lc-pop mt-2 inline-block rounded-md bg-neutral-900 px-2.5 py-1 text-[10px] font-medium text-white" style={d(1.9)}>
            Promote to production
          </span>
        </div>
        <div className="rounded-lg border border-neutral-100 p-2.5 opacity-60">
          <p className="text-[11px] text-neutral-700">Build 41 · In production</p>
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
    <div ref={ref} className="min-h-[260px]">
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
    <div ref={ref} className="overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 shadow-sm">
      <ol className="grid grid-cols-4 gap-px border-b border-neutral-200 bg-neutral-200 sm:grid-cols-8">
        {LIFECYCLE_STEPS.map((s, i) => (
          <li key={s.title} className="bg-white">
            <button
              type="button"
              onClick={() => go(i)}
              aria-current={i === step ? "step" : undefined}
              className={`relative flex h-full w-full flex-col items-start gap-0.5 px-2 py-2 text-left transition-colors ${
                i === step ? "bg-neutral-900 text-white" : i < step ? "text-neutral-700 hover:bg-neutral-50" : "text-neutral-400 hover:bg-neutral-50"
              }`}
            >
              <span className="text-[10px] font-semibold tabular-nums">{i + 1}</span>
              <span className="text-[11px] leading-tight">{s.title}</span>
              {i === step && playing ? (
                <span
                  key={`${step}-progress`}
                  className="lc-grow absolute inset-x-0 bottom-0 h-0.5 bg-emerald-400"
                  style={{ "--lc-dur": `${STEP_MS}ms` } as CSSProperties}
                />
              ) : null}
            </button>
          </li>
        ))}
      </ol>

      <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-[minmax(0,1fr)_220px] md:items-center">
        <div key={step} className="min-w-0">
          <Scene />
        </div>
        <div className="space-y-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
              Step {step + 1} · {current.where}
            </p>
            <p className="mt-1 text-sm font-semibold text-neutral-900">{current.title}</p>
            <p className="mt-1 text-sm text-neutral-600">{current.caption}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Fix stage</p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              <span className="inline-flex items-center rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-medium text-white">Reported</span>
              {FIX_STAGE_ORDER.map((s, i) =>
                i <= REACHED[step] ? (
                  <StageBadge key={s} stage={s} />
                ) : (
                  <span key={s} className="inline-flex items-center rounded-full border border-dashed border-neutral-300 px-2 py-0.5 text-[10px] text-neutral-400">
                    {FIX_STAGE_META[s].label}
                  </span>
                ),
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => go(step - 1)} className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-100" aria-label="Previous step">
              ←
            </button>
            <button
              type="button"
              onClick={() => (reduced ? go(step + 1) : setPaused((p) => !p))}
              className="rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-xs text-neutral-700 hover:bg-neutral-100"
            >
              {reduced ? "Next" : paused ? "▶ Play" : "❚❚ Pause"}
            </button>
            <button type="button" onClick={() => go(step + 1)} className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-100" aria-label="Next step">
              →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
