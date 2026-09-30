import { useState, useTransition } from "react";
import { PROMPT_TEMPLATE_PLACEHOLDERS } from "@/lib/prompt-template";
import { getErrorMessage } from "@/lib/errors";
import { Button } from "@/components/Button";
import { CheckIcon } from "@/components/icons";
import { MarkdownPreview } from "@/components/MarkdownPreview";

export function TemplateEditorForm({
  action,
  initialValue,
}: {
  action: (formData: FormData) => Promise<void>;
  initialValue: string;
}) {
  const [value, setValue] = useState(initialValue);
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const [isPending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-lg border border-neutral-200 bg-neutral-100 p-0.5 text-xs font-medium">
        <button
          type="button"
          onClick={() => setActiveTab("edit")}
          className={`rounded-md px-3 py-1 transition-colors ${
            activeTab === "edit"
              ? "bg-white text-neutral-900 shadow-2xs font-semibold"
              : "text-neutral-600 hover:text-neutral-900"
          }`}
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("preview")}
          className={`rounded-md px-3 py-1 transition-colors ${
            activeTab === "preview"
              ? "bg-white text-neutral-900 shadow-2xs font-semibold"
              : "text-neutral-600 hover:text-neutral-900"
          }`}
        >
          Preview
        </button>
      </div>

      {activeTab === "edit" ? (
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
        </div>
      ) : (
        <div className="space-y-2">
          <MarkdownPreview content={value} className="min-h-[200px]" />
          <p className="text-xs text-neutral-400">
            Preview of your template with placeholder tokens intact.
          </p>
        </div>
      )}
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
