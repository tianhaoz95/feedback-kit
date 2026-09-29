import { useState, useTransition } from "react";
import { track } from "@/lib/analytics";
import { getErrorMessage } from "@/lib/errors";
import { Button } from "@/components/Button";
import { CheckIcon, CopyIcon } from "@/components/icons";
import { MarkdownPreview } from "@/components/MarkdownPreview";

export function FeedbackPromptEditor({
  initialValue,
  isEdited,
  copySuffix = "",
  onSave,
  onReset,
  className,
}: {
  initialValue: string;
  isEdited: boolean;
  /** Appended to the copied text only, so it's never saved into the edited prompt. */
  copySuffix?: string;
  onSave: (formData: FormData) => Promise<void>;
  onReset: () => Promise<void>;
  className?: string;
}) {
  const [value, setValue] = useState(initialValue);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className={`flex flex-1 flex-col min-h-0 space-y-3 ${className ?? ""}`}>
      <div className="flex items-center justify-between">
        <div className="inline-flex rounded-lg bg-neutral-100 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setMode("edit")}
            className={`rounded-md px-2.5 py-1 font-medium transition-all cursor-pointer ${
              mode === "edit"
                ? "bg-white text-neutral-900 shadow-2xs font-semibold"
                : "text-neutral-500 hover:text-neutral-900"
            }`}
          >
            Raw Markdown
          </button>
          <button
            type="button"
            onClick={() => setMode("preview")}
            className={`rounded-md px-2.5 py-1 font-medium transition-all cursor-pointer ${
              mode === "preview"
                ? "bg-white text-neutral-900 shadow-2xs font-semibold"
                : "text-neutral-500 hover:text-neutral-900"
            }`}
          >
            Markdown Preview
          </button>
        </div>
      </div>

      {mode === "edit" ? (
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          rows={16}
          className="w-full flex-1 min-h-[300px] resize-y rounded-lg border border-neutral-200 bg-white p-3 font-mono text-xs text-neutral-800 leading-relaxed transition-colors placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none"
        />
      ) : (
        <MarkdownPreview content={value} className="w-full flex-1 min-h-[300px]" />
      )}
      <div className="flex flex-wrap items-center gap-2 pt-0.5 shrink-0">
        <Button
          size="sm"
          onClick={async () => {
            await navigator.clipboard.writeText(value + copySuffix);
            track("prompt_copied", { merged: false, edited: isEdited });
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <CheckIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
          {copied ? "Copied!" : "Copy for coding agent"}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={isPending}
          onClick={() => {
            const formData = new FormData();
            formData.set("template_text", value);
            setError(null);
            startTransition(async () => {
              try {
                await onSave(formData);
              } catch (err) {
                setError(getErrorMessage(err, "Couldn't save. Try again."));
              }
            });
          }}
        >
          {isPending ? "Saving…" : "Save edits"}
        </Button>
        {isEdited ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                try {
                  await onReset();
                } catch (err) {
                  setError(getErrorMessage(err, "Couldn't reset. Try again."));
                }
              });
            }}
            className="text-xs text-neutral-400 transition-colors hover:text-neutral-700"
          >
            Reset to project template
          </button>
        ) : null}
        {error ? <span className="text-xs text-red-600">{error}</span> : null}
      </div>
    </div>
  );
}
