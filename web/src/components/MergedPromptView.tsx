import { useEffect, useState } from "react";
import type { FeedbackItem, FeedbackStatus } from "@/lib/types";
import { renderMergedPrompt } from "@/lib/prompt-template";
import { Button } from "@/components/Button";
import { StatusBadge } from "@/components/StatusBadge";
import { StatusSelect } from "@/components/StatusSelect";
import {
  CheckIcon,
  CopyIcon,
  SparkleIcon,
  XIcon,
} from "@/components/icons";

interface MergedPromptViewProps {
  selectedItems: FeedbackItem[];
  signedUrls: Record<string, { screenshot: string | null; attachment: string | null }>;
  templateText?: string;
  onDeselectItem: (id: string) => void;
  onSelectSingleItem: (id: string) => void;
  onBatchUpdateStatus: (status: FeedbackStatus) => Promise<void>;
  onClearSelection: () => void;
  onBackToSingleView?: () => void;
}

export function MergedPromptView({
  selectedItems,
  signedUrls,
  templateText,
  onDeselectItem,
  onSelectSingleItem,
  onBatchUpdateStatus,
  onClearSelection,
  onBackToSingleView,
}: MergedPromptViewProps) {
  // Generate the merged prompt dynamically
  const generatedPrompt = renderMergedPrompt(selectedItems, signedUrls, templateText);
  const [promptText, setPromptText] = useState(generatedPrompt);
  const [isEdited, setIsEdited] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Update promptText when items or signedUrls change, unless manually modified
  useEffect(() => {
    if (!isEdited) {
      setPromptText(generatedPrompt);
    }
  }, [generatedPrompt, isEdited]);

  async function handleCopy() {
    await navigator.clipboard.writeText(promptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  function handleReset() {
    setPromptText(generatedPrompt);
    setIsEdited(false);
  }

  return (
    <div className="space-y-5">
      {/* Top Banner & Batch Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-5 py-3.5 shadow-xs">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-neutral-900 px-2 py-0.5 text-xs font-semibold text-white">
              <SparkleIcon className="h-3.5 w-3.5" />
              <span>
                {selectedItems.length} {selectedItems.length === 1 ? "report" : "reports"} merged
              </span>
            </span>
            <h2 className="text-base font-semibold text-neutral-900">
              Merged Coding Agent Prompt
            </h2>
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            Supplying all selected issues together allows coding agents to coordinate shared files and avoids merge conflicts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-neutral-500">Batch status:</span>
            <StatusSelect
              value={selectedItems[0]?.status ?? "new"}
              onChange={async (newStatus) => {
                setIsUpdatingStatus(true);
                try {
                  await onBatchUpdateStatus(newStatus);
                } finally {
                  setIsUpdatingStatus(false);
                }
              }}
            />
          </div>

          <div className="h-4 w-px bg-neutral-200" />

          {onBackToSingleView ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onBackToSingleView}
            >
              Single report view
            </Button>
          ) : null}

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClearSelection}
          >
            Clear selection
          </Button>
        </div>
      </div>

      {/* Main Grid: Left = Selected reports list, Right = Merged prompt editor */}
      <div className="grid gap-5 xl:grid-cols-12 items-start">
        {/* Left Column: List of Included Items (5 cols) */}
        <div className="xl:col-span-5 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Included Reports ({selectedItems.length})
            </h3>
            <span className="text-[11px] text-neutral-400">Click card to inspect</span>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {selectedItems.map((item, index) => {
              const urls = signedUrls[item.id];
              return (
                <div
                  key={item.id}
                  className="group relative flex items-start justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-3.5 shadow-xs hover:border-neutral-300 transition-all"
                >
                  <button
                    type="button"
                    onClick={() => onSelectSingleItem(item.id)}
                    className="flex-1 text-left min-w-0 cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[10px] font-bold text-neutral-700">
                        {index + 1}
                      </span>
                      <span className="text-xs font-semibold text-neutral-900 truncate">
                        {item.environment?.screenName ? `${item.environment.screenName}` : "Report"}
                      </span>
                      <StatusBadge status={item.status} className="shrink-0 scale-90" />
                    </div>

                    <p className="mt-1.5 text-xs text-neutral-700 line-clamp-2 leading-relaxed">
                      {item.text || "(no description)"}
                    </p>

                    <div className="mt-2 flex items-center gap-3 text-[11px] text-neutral-400">
                      <span>{item.environment?.deviceModel || "Device"}</span>
                      {urls?.screenshot ? (
                        <span className="text-emerald-600 font-medium">Screenshot attached</span>
                      ) : null}
                    </div>
                  </button>

                  <button
                    type="button"
                    title="Remove from merged prompt"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeselectItem(item.id);
                    }}
                    className="shrink-0 p-1 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Unified Prompt Editor (7 cols) */}
        <div className="xl:col-span-7 space-y-3">
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SparkleIcon className="h-4 w-4 text-neutral-700" />
                <h3 className="text-sm font-semibold text-neutral-900">
                  Combined Prompt for AI Coding Agent
                </h3>
              </div>
              <span className="text-[11px] font-mono text-neutral-400">
                {promptText.length} chars • ~{Math.round(promptText.length / 4)} tokens
              </span>
            </div>

            <p className="text-xs text-neutral-500">
              Copy this prompt into <b>Claude Code</b>, <b>Cursor</b>, <b>Codex</b>, or <b>Antigravity</b>.
              The agent will fix all {selectedItems.length} issues in one coordinated pull request.
            </p>

            <textarea
              value={promptText}
              onChange={(e) => {
                setPromptText(e.target.value);
                setIsEdited(true);
              }}
              rows={22}
              className="w-full rounded-lg border border-neutral-200 bg-neutral-50/50 p-3.5 font-mono text-xs text-neutral-800 leading-relaxed transition-colors placeholder:text-neutral-400 focus:border-neutral-900 focus:bg-white focus:outline-none"
            />

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handleCopy}>
                  {copied ? <CheckIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
                  <span>{copied ? "Copied to Clipboard!" : "Copy Merged Prompt"}</span>
                </Button>

                {isEdited ? (
                  <Button variant="secondary" size="sm" onClick={handleReset}>
                    Reset to generated prompt
                  </Button>
                ) : null}
              </div>

              {isUpdatingStatus ? (
                <span className="text-xs text-neutral-400 animate-pulse">
                  Updating statuses…
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
