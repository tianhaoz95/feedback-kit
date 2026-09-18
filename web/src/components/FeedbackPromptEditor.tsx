import { useState, useTransition } from "react";

export function FeedbackPromptEditor({
  initialValue,
  isEdited,
  onSave,
  onReset,
}: {
  initialValue: string;
  isEdited: boolean;
  onSave: (formData: FormData) => Promise<void>;
  onReset: () => Promise<void>;
}) {
  const [value, setValue] = useState(initialValue);
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-2">
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        rows={16}
        className="w-full rounded-md border border-neutral-300 p-3 font-mono text-xs leading-relaxed focus:border-neutral-500 focus:outline-none"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800"
        >
          {copied ? "Copied!" : "Copy for coding agent"}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            const formData = new FormData();
            formData.set("template_text", value);
            startTransition(() => onSave(formData));
          }}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save edits"}
        </button>
        {isEdited ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await onReset();
              })
            }
            className="text-xs text-neutral-400 hover:text-neutral-700"
          >
            Reset to project template
          </button>
        ) : null}
      </div>
    </div>
  );
}
