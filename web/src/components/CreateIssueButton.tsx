import { useEffect, useRef, useState } from "react";
import { CheckIcon, ChevronDownIcon, GitHubIcon, SparkleIcon } from "@/components/icons";

export type IssueCreateMode = "auto" | "issue_only";

const STORAGE_KEY = "feedbackkit:issue_create_mode";

function getInitialMode(): IssueCreateMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "issue_only" || saved === "auto") {
      return saved;
    }
  } catch {
    // Ignore localStorage access failures (e.g. sandboxed / private browsing).
  }
  return "auto";
}

function saveMode(nextMode: IssueCreateMode) {
  try {
    localStorage.setItem(STORAGE_KEY, nextMode);
  } catch {
    // Ignore storage failures.
  }
}

export interface CreateIssueButtonProps {
  loading?: boolean;
  disabled?: boolean;
  hasDispatchTrigger?: boolean;
  batchCount?: number;
  onCreateIssue: (options: { dispatch: boolean }) => void;
  title?: string;
  className?: string;
}

export function CreateIssueButton({
  loading = false,
  disabled = false,
  hasDispatchTrigger = false,
  batchCount,
  onCreateIssue,
  title,
  className = "",
}: CreateIssueButtonProps) {
  const [mode, setMode] = useState<IssueCreateMode>(getInitialMode);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const isBatch = typeof batchCount === "number" && batchCount > 1;

  function handleSelectMode(selectedMode: IssueCreateMode) {
    setMode(selectedMode);
    saveMode(selectedMode);
    setOpen(false);
    onCreateIssue({ dispatch: selectedMode === "auto" });
  }

  function handlePrimaryClick() {
    onCreateIssue({ dispatch: mode === "auto" });
  }

  let primaryLabel = "Create Issue & Trigger AI";
  if (loading) {
    primaryLabel = "Creating issue…";
  } else if (isBatch) {
    if (mode === "auto") {
      primaryLabel = hasDispatchTrigger ? `Send ${batchCount} to AI agent` : "Create Issue & Trigger AI";
    } else {
      primaryLabel = "Create one issue only";
    }
  } else {
    if (mode === "auto") {
      primaryLabel = "Create Issue & Trigger AI";
    } else {
      primaryLabel = "Create issue only";
    }
  }

  const primaryTitle =
    title ||
    (mode === "auto"
      ? "Create a GitHub issue and trigger the coding agent build"
      : "Create a GitHub issue for tracking without triggering the agent");

  return (
    <div ref={containerRef} className={`relative inline-flex items-stretch rounded-lg shadow-xs ${className}`}>
      <button
        type="button"
        disabled={disabled || loading}
        onClick={handlePrimaryClick}
        title={primaryTitle}
        className="inline-flex items-center gap-1.5 rounded-l-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-900 transition-colors hover:border-neutral-300 hover:bg-neutral-50 focus:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {mode === "auto" ? (
          <SparkleIcon className="h-3.5 w-3.5 text-neutral-700" />
        ) : (
          <GitHubIcon className="h-3.5 w-3.5 text-neutral-700" />
        )}
        <span>{primaryLabel}</span>
      </button>
      <button
        type="button"
        aria-label="GitHub issue creation options"
        aria-haspopup="true"
        aria-expanded={open}
        disabled={disabled || loading}
        onClick={() => setOpen((prev) => !prev)}
        className="-ml-px inline-flex items-center rounded-r-lg border border-neutral-200 bg-white px-1.5 py-1.5 text-xs text-neutral-500 transition-colors hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-700 focus:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1.5 w-72 overflow-hidden rounded-xl border border-neutral-200 bg-white p-1.5 shadow-lg"
        >
          <div className="px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
            Action
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => handleSelectMode("auto")}
            className={`flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-neutral-50 ${
              mode === "auto" ? "bg-neutral-50/80" : ""
            }`}
          >
            <SparkleIcon className="mt-0.5 h-4 w-4 shrink-0 text-neutral-700" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-semibold text-neutral-900">
                  Auto-trigger agent build
                </span>
                {mode === "auto" && <CheckIcon className="h-3.5 w-3.5 shrink-0 text-neutral-900" />}
              </div>
              <p className="mt-0.5 text-[11px] leading-normal text-neutral-500">
                Create a GitHub issue and trigger the coding agent build (default)
              </p>
            </div>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => handleSelectMode("issue_only")}
            className={`mt-1 flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-neutral-50 ${
              mode === "issue_only" ? "bg-neutral-50/80" : ""
            }`}
          >
            <GitHubIcon className="mt-0.5 h-4 w-4 shrink-0 text-neutral-700" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-semibold text-neutral-900">
                  Create issue only
                </span>
                {mode === "issue_only" && (
                  <CheckIcon className="h-3.5 w-3.5 shrink-0 text-neutral-900" />
                )}
              </div>
              <p className="mt-0.5 text-[11px] leading-normal text-neutral-500">
                Create a GitHub issue for tracking without triggering the agent
              </p>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
