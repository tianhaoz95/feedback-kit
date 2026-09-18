import { useState, useTransition } from "react";
import { PROMPT_TEMPLATE_PLACEHOLDERS } from "@/lib/prompt-template";
import { getErrorMessage } from "@/lib/errors";

export function TemplateEditorForm({
  action,
  initialValue,
}: {
  action: (formData: FormData) => Promise<void>;
  initialValue: string;
}) {
  const [value, setValue] = useState(initialValue);
  const [isPending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        rows={10}
        className="w-full rounded-md border border-neutral-300 p-3 font-mono text-xs leading-relaxed focus:border-neutral-500 focus:outline-none"
      />
      <p className="text-xs text-neutral-400">
        Placeholders: {PROMPT_TEMPLATE_PLACEHOLDERS.map((p) => `{{${p}}}`).join(", ")}
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            const formData = new FormData();
            formData.set("template_text", value);
            setError(null);
            startTransition(async () => {
              try {
                await action(formData);
                setSavedAt(Date.now());
              } catch (err) {
                setError(getErrorMessage(err, "Couldn't save the template. Try again."));
              }
            });
          }}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save template"}
        </button>
        {savedAt ? <span className="text-xs text-green-600">Saved</span> : null}
        {error ? <span className="text-xs text-red-600">{error}</span> : null}
      </div>
    </div>
  );
}
