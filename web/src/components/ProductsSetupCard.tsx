import { useState, useTransition } from "react";
import { supabase } from "@/lib/supabase";
import { getErrorMessage } from "@/lib/errors";
import type { Product } from "@/lib/types";
import { Button } from "@/components/Button";
import {
  AlertIcon,
  CheckIcon,
  LayersIcon,
  PlusIcon,
  TrashIcon,
  XIcon,
} from "@/components/icons";

export function ProductsSetupCard({
  projectId,
  products,
  onProductsChanged,
}: {
  projectId: string;
  products: Product[];
  onProductsChanged: (products: Product[]) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function resetForm() {
    setName("");
    setKey("");
    setDescription("");
    setIsDefault(false);
    setIsAdding(false);
    setEditingProduct(null);
    setError(null);
  }

  function startEdit(product: Product) {
    setEditingProduct(product);
    setName(product.name);
    setKey(product.key);
    setDescription(product.description);
    setIsDefault(product.is_default);
    setIsAdding(false);
    setError(null);
  }

  function handleNameChange(newName: string) {
    setName(newName);
    // If we're creating and the user hasn't manually edited the key (or it was derived), auto-slugify
    if (!editingProduct) {
      const slug = newName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      setKey(slug);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmedKey = key.trim().toLowerCase();
    const trimmedName = name.trim();
    if (!trimmedKey || !trimmedName) {
      setError("Product name and identifier key are required.");
      return;
    }

    startTransition(async () => {
      try {
        if (isDefault) {
          // Unset default on other products in this project
          await supabase
            .from("products")
            .update({ is_default: false })
            .eq("project_id", projectId);
        }

        if (editingProduct) {
          const { data, error: updateError } = await supabase
            .from("products")
            .update({
              name: trimmedName,
              key: trimmedKey,
              description: description.trim(),
              is_default: isDefault,
            })
            .eq("id", editingProduct.id)
            .select()
            .single();

          if (updateError) throw updateError;

          const updatedList = products.map((p) =>
            p.id === editingProduct.id
              ? (data as Product)
              : isDefault
              ? { ...p, is_default: false }
              : p
          );
          onProductsChanged(updatedList);
          setSuccess(`Product "${trimmedName}" updated.`);
        } else {
          const { data, error: insertError } = await supabase
            .from("products")
            .insert({
              project_id: projectId,
              name: trimmedName,
              key: trimmedKey,
              description: description.trim(),
              is_default: isDefault || products.length === 0,
            })
            .select()
            .single();

          if (insertError) throw insertError;

          const updatedList = isDefault
            ? [...products.map((p) => ({ ...p, is_default: false })), data as Product]
            : [...products, data as Product];
          onProductsChanged(updatedList);
          setSuccess(`Product "${trimmedName}" added.`);
        }

        resetForm();
      } catch (err) {
        setError(getErrorMessage(err, "Failed to save product."));
      }
    });
  }

  async function handleDelete(productId: string) {
    if (!confirm("Are you sure you want to delete this product?")) return;
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        const { error: deleteError } = await supabase
          .from("products")
          .delete()
          .eq("id", productId);

        if (deleteError) throw deleteError;

        const updated = products.filter((p) => p.id !== productId);
        onProductsChanged(updated);
        setSuccess("Product removed.");
      } catch (err) {
        setError(getErrorMessage(err, "Failed to delete product."));
      }
    });
  }

  return (
    <section className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <LayersIcon className="h-5 w-5 text-neutral-900" />
            <h2 className="text-base font-semibold text-neutral-900">Project Products</h2>
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            Define the products and surfaces in this project (e.g. iOS app, Android app, backend API).
            When feedback affects one or more products, their descriptions will be provided to the AI coding agent.
          </p>
        </div>
        {!isAdding && !editingProduct && (
          <Button
            size="sm"
            onClick={() => {
              resetForm();
              setIsAdding(true);
            }}
          >
            <PlusIcon className="h-3.5 w-3.5" />
            <span>Add product</span>
          </Button>
        )}
      </div>

      {success && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3.5 py-2 text-xs text-emerald-800 border border-emerald-100">
          <CheckIcon className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3.5 py-2 text-xs text-red-800 border border-red-100">
          <AlertIcon className="h-4 w-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Product creation / editing form */}
      {(isAdding || editingProduct) && (
        <form onSubmit={handleSave} className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-4 space-y-3.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-600">
              {editingProduct ? `Edit product "${editingProduct.name}"` : "Add new product"}
            </h3>
            <button
              type="button"
              onClick={resetForm}
              className="text-neutral-400 hover:text-neutral-600 cursor-pointer"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-neutral-700">Product Name</label>
              <input
                type="text"
                required
                placeholder="e.g. iOS App"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-900 focus:border-neutral-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700">Identifier Key (Slug)</label>
              <input
                type="text"
                required
                placeholder="e.g. ios"
                value={key}
                onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-1.5 font-mono text-xs text-neutral-900 focus:border-neutral-400 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700">
              Description & Context for AI Coding Agent
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Swift / SwiftUI client app located in Sources/FeedbackKit; targets iOS 15+."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-200 bg-white p-2.5 text-xs text-neutral-900 focus:border-neutral-400 focus:outline-none leading-relaxed"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_default_product"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="is_default_product" className="text-xs text-neutral-700 select-none cursor-pointer">
              Set as default product for this project
            </label>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button size="sm" type="submit" disabled={isPending}>
              {isPending ? "Saving…" : editingProduct ? "Update product" : "Save product"}
            </Button>
            <Button size="sm" variant="secondary" type="button" onClick={resetForm} disabled={isPending}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* Products list */}
      {products.length === 0 && !isAdding ? (
        <div className="rounded-xl border border-dashed border-neutral-200 p-6 text-center">
          <LayersIcon className="mx-auto h-7 w-7 text-neutral-300" />
          <p className="mt-2 text-xs font-medium text-neutral-700">No products configured yet</p>
          <p className="mt-1 text-xs text-neutral-400 max-w-sm mx-auto">
            Add products like iOS App, macOS App, Android App, or Backend API to supply AI coding agents with accurate context.
          </p>
          <Button
            size="sm"
            variant="secondary"
            className="mt-3"
            onClick={() => setIsAdding(true)}
          >
            <PlusIcon className="h-3.5 w-3.5" />
            <span>Add first product</span>
          </Button>
        </div>
      ) : (
        <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 overflow-hidden">
          {products.map((prod) => (
            <div
              key={prod.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 hover:bg-neutral-50/50 transition-colors gap-3"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-neutral-900">{prod.name}</span>
                  <span className="font-mono text-[11px] bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded border border-neutral-200">
                    {prod.key}
                  </span>
                  {prod.is_default && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
                      Default
                    </span>
                  )}
                </div>
                {prod.description ? (
                  <p className="text-xs text-neutral-500 line-clamp-2 leading-relaxed">
                    {prod.description}
                  </p>
                ) : (
                  <p className="text-xs text-neutral-400 italic">No description provided</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => startEdit(prod)}
                  disabled={isPending}
                >
                  Edit
                </Button>
                <button
                  type="button"
                  onClick={() => handleDelete(prod.id)}
                  disabled={isPending}
                  className="p-1.5 text-neutral-400 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50 cursor-pointer"
                  title="Delete product"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
