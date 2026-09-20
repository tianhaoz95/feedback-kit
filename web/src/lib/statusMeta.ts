import type { FeedbackStatus } from "@/lib/types";

export const STATUS_META: Record<FeedbackStatus, { label: string; dot: string; text: string; bg: string }> = {
  new: { label: "New", dot: "bg-blue-500", text: "text-blue-700", bg: "bg-blue-50" },
  in_progress: { label: "In progress", dot: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50" },
  resolved: { label: "Resolved", dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50" },
  wont_fix: { label: "Won't fix", dot: "bg-neutral-400", text: "text-neutral-600", bg: "bg-neutral-100" },
};
