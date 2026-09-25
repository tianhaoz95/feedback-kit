import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { getErrorMessage } from "@/lib/errors";
import type { FeedbackItem, Project } from "@/lib/types";
import { Button } from "@/components/Button";
import { AlertIcon, TrashIcon } from "@/components/icons";

export function DeleteProjectCard({
  project,
  feedbackItems = [],
}: {
  project: Project;
  feedbackItems?: FeedbackItem[];
}) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConfirmed = confirmText.trim() === project.name.trim();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen && !isDeleting) {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isDeleting]);

  function handleOpen() {
    setConfirmText("");
    setError(null);
    setIsOpen(true);
  }

  function handleClose() {
    if (isDeleting) return;
    setIsOpen(false);
    setConfirmText("");
    setError(null);
  }

  async function handleDelete() {
    if (!isConfirmed || isDeleting) return;

    setIsDeleting(true);
    setError(null);

    try {
      // Best-effort cleanup of storage files for all feedback reports in this project
      const storagePaths: string[] = [];
      for (const item of feedbackItems) {
        if (item.screenshot_raw_path) storagePaths.push(item.screenshot_raw_path);
        if (item.screenshot_annotated_path) storagePaths.push(item.screenshot_annotated_path);
        if (item.attachment_path) storagePaths.push(item.attachment_path);
      }

      if (storagePaths.length > 0) {
        try {
          await supabase.storage.from("feedback-screenshots").remove(storagePaths);
        } catch (storageErr) {
          console.warn("Could not delete some storage files:", storageErr);
        }
      }

      // Delete the project (cascades to prompt_templates, feedback_items, products, etc.)
      const { error: dbError } = await supabase
        .from("projects")
        .delete()
        .eq("id", project.id);

      if (dbError) throw dbError;

      navigate("/projects");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to delete project."));
      setIsDeleting(false);
    }
  }

  return (
    <>
      <section className="space-y-4 rounded-xl border border-red-200/80 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-red-600">
              <TrashIcon className="h-5 w-5" />
              <h2 className="text-base font-semibold text-neutral-900">Delete Project</h2>
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              Permanently delete this project and all associated feedback reports, screenshots, products, and prompt templates.
            </p>
          </div>

          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={handleOpen}
            className="shrink-0"
          >
            Delete project
          </Button>
        </div>
      </section>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-project-dialog-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 border border-red-100">
                <TrashIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 id="delete-project-dialog-title" className="text-base font-semibold text-neutral-900">
                  Delete project &ldquo;{project.name}&rdquo;?
                </h3>
                <p className="mt-1 text-xs text-neutral-500 leading-relaxed">
                  This action cannot be undone. All data associated with this project will be permanently deleted:
                </p>
                <ul className="mt-2 list-disc list-inside text-xs text-neutral-500 space-y-1">
                  <li>
                    {feedbackItems.length === 1
                      ? "1 feedback report and annotations"
                      : `${feedbackItems.length} feedback reports and annotations`}
                  </li>
                  <li>Annotated screenshots and attachments</li>
                  <li>Connected products and prompt template settings</li>
                  <li>
                    Project key <code className="font-mono text-[11px] bg-neutral-100 px-1 py-0.5 rounded text-neutral-700">{project.project_key}</code>
                  </li>
                </ul>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
                <AlertIcon className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2 pt-1">
              <label htmlFor="confirm-project-name" className="block text-xs text-neutral-600">
                Please type <strong className="font-semibold text-neutral-900 select-all">{project.name}</strong> to confirm:
              </label>
              <input
                id="confirm-project-name"
                type="text"
                autoComplete="off"
                autoFocus
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && isConfirmed && !isDeleting) {
                    e.preventDefault();
                    handleDelete();
                  }
                }}
                disabled={isDeleting}
                placeholder={project.name}
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleClose}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={!isConfirmed || isDeleting}
                className="inline-flex cursor-pointer items-center justify-center rounded-lg px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? "Deleting project…" : "Delete this project"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
