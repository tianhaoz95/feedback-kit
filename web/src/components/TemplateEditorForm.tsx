import { useState, useTransition } from "react";
import { PROMPT_TEMPLATE_PLACEHOLDERS } from "@/lib/prompt-template";
import { getErrorMessage } from "@/lib/errors";
import { Button } from "@/components/Button";
import { CheckIcon } from "@/components/icons";

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
        className="w-full rounded-lg border border-neutral-200 bg-white p-3 font-mono text-xs text-neutral-800 leading-relaxed transition-colors placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none"
      />
      <p className="text-xs text-neutral-400">
        Placeholders: {PROMPT_TEMPLATE_PLACEHOLDERS.map((p) => `{{${p}}}`).join(", ")}
      </p>
      <div className="flex items-center gap-3">
        <Button
          size="sm"
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
        >
          {isPending ? "Saving…" : "Save template"}
        </Button>
        {savedAt ? (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
            <CheckIcon className="h-3.5 w-3.5" /> Saved
          </span>
        ) : null}
        {error ? <span className="text-xs text-red-600">{error}</span> : null}
      </div>
    </div>
  );
}
