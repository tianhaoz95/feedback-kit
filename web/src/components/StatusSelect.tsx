"use client";

import { useTransition } from "react";
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

  return (
    <select
      defaultValue={value}
      disabled={isPending}
      onChange={(event) => startTransition(() => onChange(event.target.value as FeedbackStatus))}
      className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
    >
      {OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
