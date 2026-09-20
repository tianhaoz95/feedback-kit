import type { FeedbackStatus } from "@/lib/types";
import { STATUS_META } from "@/lib/statusMeta";

export function StatusBadge({ status, className = "" }: { status: FeedbackStatus; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${meta.bg} ${meta.text} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}
