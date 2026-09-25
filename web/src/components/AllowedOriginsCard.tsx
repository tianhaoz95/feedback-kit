import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { getErrorMessage } from "@/lib/errors";
import type { Project } from "@/lib/types";
import { normalizeOrigin } from "@/lib/origins";
import { Button } from "@/components/Button";
import { AlertIcon, CheckIcon, GlobeIcon, PlusIcon, XIcon } from "@/components/icons";

/**
 * Settings for `projects.allowed_origins` (0013_web_sdk.sql): which websites
 * may submit with this project's key. The key is public by design, so on
 * the web anyone can read it from page source — this stops *other sites*
 * from embedding it. Native apps send no `Origin` and are never affected.
 */
export function AllowedOriginsCard({
  project,
  onProjectUpdated,
}: {
  project: Project;
  onProjectUpdated: (updated: Partial<Project>) => void;
}) {
  const origins = project.allowed_origins ?? [];
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(next: string[]) {
    setSaving(true);
    setError(null);
    setSaved(false);
    const { error: updateError } = await supabase
      .from("projects")
      .update({ allowed_origins: next })
      .eq("id", project.id);
    setSaving(false);
    if (updateError) {
      setError(getErrorMessage(updateError, "Failed to save allowed origins."));
      return;
    }
    onProjectUpdated({ allowed_origins: next });
    setSaved(true);
  }

  function add() {
    const origin = normalizeOrigin(draft);
    if (!origin) {
      setError("Enter an origin like https://app.example.com or https://*.example.com (no path).");
      return;
    }
    if (origins.includes(origin)) {
      setDraft("");
      return;
    }
    setDraft("");
    void save([...origins, origin]);
  }

  return (
    <section className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div>
        <div className="flex items-center gap-2">
          <GlobeIcon className="h-5 w-5 text-neutral-900" />
          <h2 className="text-base font-semibold text-neutral-900">Allowed web origins</h2>
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          Websites allowed to send feedback with this project&apos;s key through the web SDK. Leave empty to
          accept any origin. iOS, macOS and watchOS apps are never affected.
        </p>
      </div>

      {origins.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-3 py-2.5 text-xs text-neutral-500">
          Any website can currently submit with this key.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {origins.map((origin) => (
            <li
              key={origin}
              className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 py-1 pl-2.5 pr-1 font-mono text-xs text-neutral-800"
            >
              {origin}
              <button
                type="button"
                disabled={saving}
                onClick={() => void save(origins.filter((o) => o !== origin))}
                className="rounded p-0.5 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700"
                aria-label={`Remove ${origin}`}
              >
                <XIcon className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
            setSaved(false);
          }}
          placeholder="https://app.example.com"
          aria-label="Origin to allow"
          className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 font-mono text-xs focus:border-neutral-400 focus:outline-none"
        />
        <Button type="submit" size="sm" variant="secondary" disabled={saving || !draft.trim()}>
          <PlusIcon className="h-3.5 w-3.5" />
          Add origin
        </Button>
      </form>

      {error && (
        <p className="flex items-center gap-1.5 text-xs text-red-600">
          <AlertIcon className="h-3.5 w-3.5" />
          {error}
        </p>
      )}
      {saved && !error && (
        <p className="flex items-center gap-1.5 text-xs text-green-700">
          <CheckIcon className="h-3.5 w-3.5" />
          Saved — takes effect on the next submission.
        </p>
      )}
    </section>
  );
}
