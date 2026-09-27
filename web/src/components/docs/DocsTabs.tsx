import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";

export interface DocsTab {
  id: string;
  label: string;
  /** One line under the label, so the choice is clear before clicking. */
  hint?: string;
  content: ReactNode;
}

const storageKey = (group: string) => `feedbackkit.docs.${group}`;

/**
 * Shows only the tab the reader picked. The choice is remembered per `group`
 * (so every page with the same group opens on it) and can be preset with
 * `?<group>=<tab id>` in a link.
 */
export function DocsTabs({ group, tabs }: { group: string; tabs: DocsTab[] }) {
  const [params] = useSearchParams();
  const [selected, setSelected] = useState<string>(() => {
    const fromUrl = params.get(group);
    if (fromUrl && tabs.some((t) => t.id === fromUrl)) return fromUrl;
    try {
      const stored = localStorage.getItem(storageKey(group));
      if (stored && tabs.some((t) => t.id === stored)) return stored;
    } catch {
      // Storage unavailable: fall back to the first tab.
    }
    return tabs[0].id;
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey(group), selected);
    } catch {
      // Not remembered; still works.
    }
  }, [group, selected]);

  const current = tabs.find((t) => t.id === selected) ?? tabs[0];
  return (
    <div>
      <div role="tablist" aria-label="Choose one" className="grid gap-2 sm:grid-cols-2">
        {tabs.map((tab) => {
          const active = tab.id === current.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`${group}-tab-${tab.id}`}
              aria-selected={active}
              aria-controls={`${group}-panel`}
              onClick={() => setSelected(tab.id)}
              className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                active ? "border-neutral-900 bg-white ring-1 ring-neutral-900" : "border-neutral-200 bg-neutral-50 hover:border-neutral-400"
              }`}
            >
              <span className="block text-sm font-semibold text-neutral-900">{tab.label}</span>
              {tab.hint ? <span className="mt-0.5 block text-xs text-neutral-500">{tab.hint}</span> : null}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`${group}-panel`} aria-labelledby={`${group}-tab-${current.id}`} className="mt-6">
        {current.content}
      </div>
    </div>
  );
}
