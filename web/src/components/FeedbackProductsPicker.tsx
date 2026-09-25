import { useEffect, useRef, useState, useTransition } from "react";
import { supabase } from "@/lib/supabase";
import { getErrorMessage } from "@/lib/errors";
import type { FeedbackItem, FeedbackProduct, Product } from "@/lib/types";
import { LayersIcon, XIcon } from "@/components/icons";

export function FeedbackProductsPicker({
  feedback,
  availableProducts,
  onFeedbackUpdated,
}: {
  feedback: FeedbackItem;
  availableProducts: Product[];
  onFeedbackUpdated: (updated: Partial<FeedbackItem>) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const assignedProducts: FeedbackProduct[] = feedback.products ?? [];
  const assignedKeys = new Set(
    feedback.product_keys && feedback.product_keys.length > 0
      ? feedback.product_keys
      : assignedProducts.map((p) => p.key)
  );

  async function toggleProduct(prod: Product) {
    setError(null);
    const key = prod.key;
    const isCurrentlyAssigned = assignedKeys.has(key);

    let nextProducts: FeedbackProduct[];
    let nextKeys: string[];

    if (isCurrentlyAssigned) {
      nextProducts = assignedProducts.filter((p) => p.key !== key);
      nextKeys = Array.from(assignedKeys).filter((k) => k !== key);
    } else {
      nextProducts = [
        ...assignedProducts,
        {
          key: prod.key,
          name: prod.name,
          description: prod.description,
          is_default: prod.is_default,
        },
      ];
      nextKeys = [...Array.from(assignedKeys), prod.key];
    }

    startTransition(async () => {
      try {
        const { error: updateError } = await supabase
          .from("feedback_items")
          .update({
            products: nextProducts,
            product_keys: nextKeys,
          })
          .eq("id", feedback.id);

        if (updateError) throw updateError;

        onFeedbackUpdated({
          products: nextProducts,
          product_keys: nextKeys,
        });
      } catch (err) {
        setError(getErrorMessage(err, "Failed to update assigned products."));
      }
    });
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs relative" ref={popoverRef}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayersIcon className="h-4 w-4 text-neutral-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Affected Products
          </h3>
        </div>
        {availableProducts.length > 0 && (
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
          >
            <span>{assignedProducts.length > 0 ? "Edit" : "+ Add"}</span>
          </button>
        )}
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-600">{error}</p>
      )}

      {assignedProducts.length === 0 ? (
        <p className="mt-2 text-xs text-neutral-400">
          No products associated with this report.
        </p>
      ) : (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {assignedProducts.map((p) => (
            <span
              key={p.key}
              className="inline-flex items-center gap-1 text-xs font-medium bg-neutral-100 text-neutral-800 px-2.5 py-1 rounded-md border border-neutral-200"
            >
              <span>{p.name || p.key}</span>
              <span className="font-mono text-[10px] text-neutral-500">({p.key})</span>
            </span>
          ))}
        </div>
      )}

      {/* Popover to select products */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-30 rounded-xl border border-neutral-200 bg-white p-3 shadow-lg space-y-2">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
            <span className="text-xs font-semibold text-neutral-700">Select affected products</span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-neutral-400 hover:text-neutral-600 cursor-pointer"
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="space-y-1 max-h-48 overflow-y-auto">
            {availableProducts.map((prod) => {
              const checked = assignedKeys.has(prod.key);
              return (
                <label
                  key={prod.id}
                  className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-colors text-xs ${
                    checked ? "bg-blue-50/60" : "hover:bg-neutral-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={isPending}
                    onChange={() => toggleProduct(prod)}
                    className="mt-0.5 h-3.5 w-3.5 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium text-neutral-900">{prod.name}</span>
                      <span className="font-mono text-[10px] text-neutral-500">({prod.key})</span>
                      {prod.is_default && (
                        <span className="text-[10px] bg-blue-100/70 text-blue-700 px-1.5 py-0.2 rounded font-medium">
                          Default
                        </span>
                      )}
                    </div>
                    {prod.description && (
                      <p className="mt-0.5 text-[11px] text-neutral-500 line-clamp-2">
                        {prod.description}
                      </p>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
