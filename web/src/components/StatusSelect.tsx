import { useState, useTransition } from "react";
import type { FeedbackStatus } from "@/lib/types";

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
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="text-right">
      <select
        defaultValue={value}
        disabled={isPending}
        onChange={(event) => {
          const status = event.target.value as FeedbackStatus;
          setError(null);
          startTransition(async () => {
            try {
              await onChange(status);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Couldn't update status. Try again.");
            }
          });
        }}
        className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
      >
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
