import type { FixStage } from "@/lib/types";

/**
 * Display metadata for `feedback_items.fix_stage` (0014_closed_loop.sql) —
 * the closed loop's stages, in order, plus `reopened` (the reporter said the
 * shipped fix didn't work), which sits outside the happy path.
 */
export const FIX_STAGE_META: Record<FixStage, { label: string; description: string; text: string; bg: string; dot: string }> = {
  agent_working: {
    label: "Agent working",
    description: "A coding agent (or a teammate) has picked this up.",
    text: "text-violet-700",
    bg: "bg-violet-50",
    dot: "bg-violet-500",
  },
  pr_open: { label: "PR open", description: "A pull request with the fix is open.", text: "text-sky-700", bg: "bg-sky-50", dot: "bg-sky-500" },
  merged: {
    label: "Merged",
    description: "The fix is merged and will ship with the next `feedbackkit release`.",
    text: "text-indigo-700",
    bg: "bg-indigo-50",
    dot: "bg-indigo-500",
  },
  shipped: {
    label: "Shipped",
    description: "Released — the reporter will be asked to confirm on their device.",
    text: "text-amber-700",
    bg: "bg-amber-50",
    dot: "bg-amber-500",
  },
  verified: {
    label: "Verified",
    description: "The reporter confirmed the fix works on their device.",
    text: "text-emerald-700",
    bg: "bg-emerald-50",
    dot: "bg-emerald-500",
  },
  reopened: {
    label: "Reopened",
    description: "The reporter says the shipped fix didn't work.",
    text: "text-red-700",
    bg: "bg-red-50",
    dot: "bg-red-500",
  },
};

/** The happy path, for the stepper. */
export const FIX_STAGE_ORDER: FixStage[] = ["agent_working", "pr_open", "merged", "shipped", "verified"];
