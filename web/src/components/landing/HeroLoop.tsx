import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { PhoneMockup } from "@/components/landing/PhoneMockup";
import { FixStageBadge } from "@/components/FixStageBadge";

/**
 * The landing hero: the whole closed loop in three beats on one phone. It
 * opens on the real iOS capture (the eye-catching part), then a coding agent
 * fixes and ships it, then the same phone asks the reporter "is it fixed?".
 * Labels match the product (tool names, fix stages, the verification sheet).
 * Animations are the shared `lc-*` classes in index.css, which switch off
 * under prefers-reduced-motion; auto-advance stops then too.
 */

const BEATS = [
  { label: "A user reports it", ms: 4500 },
  { label: "Your agent fixes and ships it", ms: 6500 },
  { label: "They confirm it's fixed", ms: 5000 },
] as const;

const d = (seconds: number): CSSProperties => ({ animationDelay: `${seconds}s` });

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

function Line({ at, children }: { at: number; children: ReactNode }) {
  return (
    <p className="lc-in" style={d(at)}>
      {children}
    </p>
  );
}

/** Beat 2: the agent's terminal, from prompt to a shipped build. */
function AgentTerminal() {
  return (
    <div className="lc-in overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 font-mono text-[10.5px] leading-relaxed text-neutral-200 shadow-2xl sm:text-[11px]">
      <div className="border-b border-neutral-800 px-3 py-1.5 text-[10px] text-neutral-500">claude — ~/acme-shop</div>
      <div className="space-y-1.5 p-3">
        <Line at={0.2}>
          <span className="text-neutral-400">›</span> Fix FeedbackKit report fb_8c2
        </Line>
        <Line at={0.9}>
          <span className="text-emerald-400">⏺</span> claim_feedback <FixStageBadge stage="agent_working" className="ml-1 font-sans" />
        </Line>
        <Line at={1.8}>
          <span className="text-sky-400">✎</span> HomeView.swift <span className="text-emerald-400">+4</span>{" "}
          <span className="text-red-400">−1</span>
        </Line>
        <Line at={2.7}>
          <span className="text-emerald-400">⏺</span> PR #42 opened <FixStageBadge stage="pr_open" className="ml-1 font-sans" />
        </Line>
        <Line at={3.7}>
          <span className="text-emerald-400">✓</span> merged <FixStageBadge stage="merged" className="ml-1 font-sans" />
        </Line>
        <Line at={4.7}>
          <span className="text-neutral-400">$</span> feedbackkit release --build 42{" "}
          <FixStageBadge stage="shipped" className="ml-1 font-sans" />
        </Line>
      </div>
    </div>
  );
}

/** Beat 3: the verification sheet, over the reporter's own phone. */
function VerifySheet() {
  return (
    <>
      <div className="lc-in absolute inset-0 bg-black/35" style={d(0.1)} />
      <div className="lc-slide-up absolute inset-x-0 bottom-0 rounded-t-[14%] bg-white px-[7%] pb-[9%] pt-[6%] shadow-2xl" style={d(0.25)}>
        <p className="text-[clamp(9px,3.4vw,13px)] font-semibold leading-tight text-neutral-900">We fixed something you reported</p>
        <p className="mt-0.5 text-[clamp(7px,2.6vw,10px)] text-neutral-500">Fixed in build 42, the one you&apos;re using now.</p>
        <p className="mt-[5%] text-[clamp(7px,2.6vw,10px)] leading-snug text-neutral-600">
          You reported: &ldquo;The first Add button doesn&apos;t do anything.&rdquo;
        </p>
        <div className="lc-tap mt-[6%] rounded-lg bg-blue-600 py-[4%] text-center text-[clamp(8px,2.9vw,11px)] font-semibold text-white" style={d(1.6)}>
          Yes, it&apos;s fixed
        </div>
        <div className="mt-[3%] text-center text-[clamp(8px,2.9vw,11px)] text-neutral-500">No, still broken</div>
      </div>
    </>
  );
}

export function HeroLoop() {
  const reduced = usePrefersReducedMotion();
  const [beat, setBeat] = useState(0);
  const [cycle, setCycle] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(true);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.2 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (reduced || !inView) return;
    const timer = setTimeout(() => {
      setBeat((b) => (b + 1) % BEATS.length);
      setCycle((c) => c + 1);
    }, BEATS[beat].ms);
    return () => clearTimeout(timer);
  }, [beat, reduced, inView, cycle]);

  const go = (b: number) => {
    setBeat(b);
    setCycle((c) => c + 1);
  };

  return (
    <div ref={ref} className="relative mx-auto w-full max-w-[520px]">
      <div className="relative pb-4">
        <div className={`w-[58%] transition-transform duration-700 sm:w-[52%] ${beat === 1 ? "sm:-translate-x-2" : ""}`}>
          <div className="animate-float">
            <PhoneMockup className="" overlay={beat === 2 ? <VerifySheet key={`v${cycle}`} /> : null} />
          </div>
        </div>

        {/* Beat 1: what the reporter sent */}
        {beat === 0 ? (
          <div key={`r${cycle}`} className="absolute right-0 top-[38%] w-[46%] space-y-2">
            <div className="lc-in rounded-2xl rounded-bl-sm border border-neutral-200 bg-white p-3 text-[12px] text-neutral-700 shadow-lg" style={d(0.4)}>
              &ldquo;The first Add button doesn&apos;t do anything.&rdquo;
            </div>
            <div className="lc-pop inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700" style={d(1.4)}>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Sent with screenshot, markup &amp; device info
            </div>
          </div>
        ) : null}

        {/* Beat 2: the coding agent */}
        {beat === 1 ? (
          <div key={`a${cycle}`} className="absolute right-0 top-[22%] w-[74%] sm:w-[62%]">
            <AgentTerminal />
          </div>
        ) : null}

        {/* Beat 3: done means the reporter says so */}
        {beat === 2 ? (
          <div key={`c${cycle}`} className="absolute right-0 top-[44%] w-[40%] space-y-2">
            <FixStageBadge stage="verified" className="lc-pop !text-[12px]" />
            <p className="lc-in text-[12px] leading-snug text-neutral-600" style={d(2.2)}>
              Closed by the person who reported it, on their own phone.
            </p>
          </div>
        ) : null}
      </div>

      <ol className="mt-4 grid grid-cols-3 gap-2" aria-label="The loop, step by step">
        {BEATS.map((b, i) => (
          <li key={b.label}>
            <button
              type="button"
              onClick={() => go(i)}
              aria-current={beat === i ? "step" : undefined}
              className="group w-full text-left"
            >
              <span className="block h-1 overflow-hidden rounded-full bg-neutral-200">
                {beat === i ? (
                  <span
                    key={`p${cycle}`}
                    className="lc-grow block h-full bg-neutral-900"
                    style={{ "--lc-dur": `${b.ms}ms`, animationPlayState: inView ? "running" : "paused" } as CSSProperties}
                  />
                ) : beat > i ? (
                  <span className="block h-full bg-neutral-900" />
                ) : null}
              </span>
              <span className={`mt-1.5 block text-[11px] leading-tight sm:text-xs ${beat === i ? "font-medium text-neutral-900" : "text-neutral-500 group-hover:text-neutral-800"}`}>
                <span className="text-neutral-400">{i + 1}.</span> {b.label}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
