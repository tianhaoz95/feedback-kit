import { useState, useTransition } from "react";
import type { FeedbackStatus } from "@/lib/types";
import { getErrorMessage } from "@/lib/errors";
import { STATUS_META } from "@/lib/statusMeta";
import { ChevronDownIcon } from "@/components/icons";

const OPTIONS: { value: FeedbackStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
  { value: "wont_fix", label: "Won't fix" },
];

export function StatusSelect({
  value,
  onChange,
}: {
  value: FeedbackStatus;
  onChange: (status: FeedbackStatus) => Promise<void>;
}) {
  const [current, setCurrent] = useState(value);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const meta = STATUS_META[current];

  return (
    <div className="text-right">
      <div className={`relative inline-block ${isPending ? "opacity-60" : ""}`}>
        <span className={`pointer-events-none absolute left-3 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full ${meta.dot}`} />
        <select
          value={current}
          disabled={isPending}
          onChange={(event) => {
            const status = event.target.value as FeedbackStatus;
            const previous = current;
            setCurrent(status);
            setError(null);
            startTransition(async () => {
              try {
                await onChange(status);
              } catch (err) {
                setCurrent(previous);
                setError(getErrorMessage(err, "Couldn't update status. Try again."));
              }
            });
          }}
          className={`cursor-pointer appearance-none rounded-lg py-1.5 pl-7 pr-7 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 ${meta.bg} ${meta.text}`}
        >
          {OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />
      </div>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
