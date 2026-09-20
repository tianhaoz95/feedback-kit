import { CopyButton } from "@/components/CopyButton";

/** A dark, copyable code sample — used throughout the docs for commands/snippets. */
export function CodeBlock({ code, label }: { code: string; label?: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900 shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-neutral-800 px-4 py-2">
        <span className="text-[11px] text-neutral-500">{label ?? "Terminal"}</span>
        <CopyButton text={code} variant="dark" />
      </div>
      <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed text-neutral-200">
        <code>{code}</code>
      </pre>
    </div>
  );
}
