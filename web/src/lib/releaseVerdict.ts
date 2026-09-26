import type { ReleaseReadiness } from "./types";

export type Verdict = { tone: "green" | "amber" | "red" | "neutral"; label: string };

/**
 * Whether a beta build is safe to promote to production, from its shipped
 * fixes' verification state (the `release_readiness` view): any reopened fix
 * blocks it, unverified fixes make it "waiting", all verified makes it ready.
 */
export function verdictFor(
  r: Pick<ReleaseReadiness, "fixes" | "verified" | "reopened" | "awaiting" | "promoted_at" | "channel">,
): Verdict {
  if (r.channel === "production") {
    return {
      tone: "neutral",
      label: r.promoted_at ? `In production since ${new Date(r.promoted_at).toLocaleDateString()}` : "Production",
    };
  }
  if (Number(r.reopened) > 0) return { tone: "red", label: `${r.reopened} reopened — not ready` };
  if (Number(r.fixes) === 0) return { tone: "neutral", label: "No fixes in this build" };
  if (Number(r.awaiting) > 0) return { tone: "amber", label: `${r.verified}/${r.fixes} verified` };
  return { tone: "green", label: `All ${r.fixes} verified — ready` };
}
