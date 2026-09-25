import { useState } from "react";
import type { FeedbackLogEntry } from "@/lib/types";
import { CopyButton } from "@/components/CopyButton";
import { TerminalIcon } from "@/components/icons";

const LEVEL_STYLES: Record<string, string> = {
  error: "bg-red-50 text-red-700 border-red-200",
  warn: "bg-amber-50 text-amber-700 border-amber-200",
  network: "bg-violet-50 text-violet-700 border-violet-200",
};

const COLLAPSED_COUNT = 6;

/** Console output, uncaught errors and failed requests captured by the web SDK before the report. */
export function ConsoleLogsPanel({ logs }: { logs: FeedbackLogEntry[] }) {
  const [expanded, setExpanded] = useState(false);
  if (logs.length === 0) return null;
  const errorCount = logs.filter((l) => l.level === "error" || l.level === "network").length;
  const visible = expanded ? logs : logs.slice(-COLLAPSED_COUNT);
  const asText = logs.map((l) => `${l.timestamp} [${l.level}] ${l.message}`).join("\n");

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <TerminalIcon className="h-4 w-4 text-neutral-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Console &amp; network</h3>
          <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500">
            {logs.length} {logs.length === 1 ? "entry" : "entries"}
            {errorCount > 0 ? ` · ${errorCount} error${errorCount === 1 ? "" : "s"}` : ""}
          </span>
        </div>
        <CopyButton text={asText} label="Copy" />
      </div>
      <ol className="mt-3 space-y-1.5">
        {visible.map((log, i) => (
          <li key={`${log.timestamp}-${i}`} className="flex items-start gap-2 text-xs">
            <span
              className={`mt-px shrink-0 rounded border px-1 py-px font-mono text-[10px] font-semibold uppercase ${
                LEVEL_STYLES[log.level] ?? "bg-neutral-50 text-neutral-600 border-neutral-200"
              }`}
            >
              {log.level}
            </span>
            <span className="shrink-0 font-mono text-[10px] leading-5 text-neutral-400">
              {log.timestamp?.slice(11, 19)}
            </span>
            <code className="min-w-0 flex-1 whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-neutral-800">
              {log.message}
            </code>
          </li>
        ))}
      </ol>
      {logs.length > COLLAPSED_COUNT && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-xs font-medium text-neutral-500 hover:text-neutral-900"
        >
          {expanded ? "Show fewer" : `Show all ${logs.length}`}
        </button>
      )}
    </div>
  );
}
