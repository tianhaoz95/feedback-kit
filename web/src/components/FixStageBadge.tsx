import type { FixStage } from "@/lib/types";
import { FIX_STAGE_META } from "@/lib/fixStageMeta";

export function FixStageBadge({ stage, className = "" }: { stage: FixStage; className?: string }) {
  const meta = FIX_STAGE_META[stage];
  return (
    <span
      title={meta.description}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.bg} ${meta.text} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}
