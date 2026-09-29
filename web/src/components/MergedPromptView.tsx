import { useEffect, useState, type ReactNode } from "react";
import { track } from "@/lib/analytics";
import type { DeliveryMode, FeedbackItem, FeedbackStatus } from "@/lib/types";
import { closingTheLoopSection, renderMergedPrompt } from "@/lib/prompt-template";
import { Button } from "@/components/Button";
import { CreateIssueButton } from "@/components/CreateIssueButton";
import { MarkdownPreview } from "@/components/MarkdownPreview";
import { StatusBadge } from "@/components/StatusBadge";
import { StatusSelect } from "@/components/StatusSelect";
import {
  ArchiveIcon,
  CheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  GitHubIcon,
  SparkleIcon,
  TrashIcon,
  XIcon,
} from "@/components/icons";

interface MergedPromptViewProps {
  deliveryMode?: DeliveryMode;
  selectedItems: FeedbackItem[];
  signedUrls: Record<string, { screenshot: string | null; attachment: string | null }>;
  templateText?: string;
  onDeselectItem: (id: string) => void;
  onSelectSingleItem: (id: string) => void;
  onBatchUpdateStatus: (status: FeedbackStatus) => Promise<void>;
  onBatchArchive?: () => Promise<void> | void;
  onBatchDelete?: () => void;
  onClearSelection: () => void;
  onBackToSingleView?: () => void;
  /** The project has a label, comment or Copilot trigger (Settings → Coding agent loop). */
  hasDispatchTrigger?: boolean;
  isSendingToAgent?: boolean;
  /**
   * Opens one GitHub issue for the whole batch and hands it to the coding
   * agent (create-github-issue with `feedback_ids`), or re-dispatches the
   * batch's issue. `prompt` is the merged prompt when it was edited here.
   */
  onSendToAgent?: (options: { redispatch?: boolean; prompt?: string; dispatch?: boolean }) => void;
  /** Error from the last send, rendered under the batch controls. */
  issueNotice?: ReactNode;
}

export function MergedPromptView({
  deliveryMode,
  selectedItems,
  signedUrls,
  templateText,
  onDeselectItem,
  onSelectSingleItem,
  onBatchUpdateStatus,
  onBatchArchive,
  onBatchDelete,
  onClearSelection,
  onBackToSingleView,
  hasDispatchTrigger = false,
  isSendingToAgent = false,
  onSendToAgent,
  issueNotice,
}: MergedPromptViewProps) {
  // Generate the merged prompt dynamically
  const generatedPrompt = renderMergedPrompt(selectedItems, signedUrls, templateText);
  const [promptText, setPromptText] = useState(generatedPrompt);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
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
    // Appended on copy only, like the single-report editor, so edits never duplicate it.
    await navigator.clipboard.writeText(promptText + closingTheLoopSection(selectedItems, deliveryMode));
    track("prompt_copied", { merged: true, reports: selectedItems.length });
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  // The batch has an issue when every report is on the same one (sent
  // together before). Reports with an issue of their own can't join a new one.
  const linkedItems = selectedItems.filter((item) => item.github_issue_url);
  const sharedIssue =
    linkedItems.length === selectedItems.length &&
    new Set(linkedItems.map((item) => item.github_issue_number)).size === 1
      ? selectedItems[0]
      : null;
  const blockedByLinked = !sharedIssue && linkedItems.length > 0;

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
          {onSendToAgent && sharedIssue?.github_issue_url ? (
            <a
              href={sharedIssue.github_issue_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs font-medium text-neutral-900 hover:bg-neutral-100 hover:border-neutral-300 transition-colors"
            >
              <GitHubIcon className="h-3.5 w-3.5 text-neutral-700" />
              <span>Issue #{sharedIssue.github_issue_number ?? ""}</span>
              <ExternalLinkIcon className="h-3 w-3 text-neutral-400" />
            </a>
          ) : null}
          {onSendToAgent && sharedIssue && hasDispatchTrigger ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isSendingToAgent}
              onClick={() => onSendToAgent({ redispatch: true })}
              className="inline-flex items-center gap-1.5"
              title="Re-apply the coding-agent trigger (labels / comment / Copilot from Settings) to this batch's issue"
            >
              <SparkleIcon className="h-3.5 w-3.5" />
              <span>{isSendingToAgent ? "Sending…" : selectedItems.some((i) => i.fix_stage) ? "Send to agent again" : "Send to agent"}</span>
            </Button>
          ) : null}
          {onSendToAgent && !sharedIssue ? (
            <CreateIssueButton
              disabled={isSendingToAgent || blockedByLinked}
              loading={isSendingToAgent}
              hasDispatchTrigger={hasDispatchTrigger}
              batchCount={selectedItems.length}
              onCreateIssue={({ dispatch }) =>
                onSendToAgent({
                  ...(isEdited ? { prompt: promptText } : {}),
                  dispatch,
                })
              }
              title={
                blockedByLinked
                  ? `${linkedItems.length} of these reports already ${linkedItems.length === 1 ? "has a GitHub issue" : "have GitHub issues"}. Remove ${linkedItems.length === 1 ? "it" : "them"} from the selection first.`
                  : "Open one GitHub issue for all selected reports and hand it to your coding agent. Each report moves through the fix loop on its own."
              }
            />
          ) : null}
          {onSendToAgent ? <div className="h-4 w-px bg-neutral-200" /> : null}

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

          {onBatchArchive ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onBatchArchive}
              className="inline-flex items-center gap-1.5"
              title="Archive or unarchive selected reports"
            >
              <ArchiveIcon className="h-3.5 w-3.5 text-neutral-500" />
              <span>{selectedItems.every((i) => i.is_archived) ? "Unarchive" : "Archive"}</span>
            </Button>
          ) : null}

          {onBatchDelete ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onBatchDelete}
              className="inline-flex items-center gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-200"
              title="Delete selected reports"
            >
              <TrashIcon className="h-3.5 w-3.5" />
              <span>Delete</span>
            </Button>
          ) : null}

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

      {issueNotice}
      {blockedByLinked && onSendToAgent ? (
        <p className="px-1 text-xs text-neutral-500">
          {linkedItems.length} of the selected reports already {linkedItems.length === 1 ? "has its own GitHub issue" : "have their own GitHub issues"}.
          Remove {linkedItems.length === 1 ? "it" : "them"} from the batch to send the rest to the agent as one issue.
        </p>
      ) : null}

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
                      {item.github_issue_number ? <span>Issue #{item.github_issue_number}</span> : null}
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

            <div className="flex items-center justify-between">
              <p className="text-xs text-neutral-500">
                Copy this prompt into <b>Claude Code</b>, <b>Cursor</b>, <b>Codex</b>, or <b>Antigravity</b>.
                The agent will fix all {selectedItems.length} issues in one coordinated pull request.
                {onSendToAgent ? " Or send the batch to your coding agent as one GitHub issue — edits here go into it." : null}
              </p>
              <div className="inline-flex rounded-lg bg-neutral-100 p-0.5 text-xs shrink-0 ml-2">
                <button
                  type="button"
                  onClick={() => setMode("edit")}
                  className={`rounded-md px-2.5 py-1 font-medium transition-all cursor-pointer ${
                    mode === "edit"
                      ? "bg-white text-neutral-900 shadow-2xs font-semibold"
                      : "text-neutral-500 hover:text-neutral-900"
                  }`}
                >
                  Raw Markdown
                </button>
                <button
                  type="button"
                  onClick={() => setMode("preview")}
                  className={`rounded-md px-2.5 py-1 font-medium transition-all cursor-pointer ${
                    mode === "preview"
                      ? "bg-white text-neutral-900 shadow-2xs font-semibold"
                      : "text-neutral-500 hover:text-neutral-900"
                  }`}
                >
                  Markdown Preview
                </button>
              </div>
            </div>

            {mode === "edit" ? (
              <textarea
                value={promptText}
                onChange={(e) => {
                  setPromptText(e.target.value);
                  setIsEdited(true);
                }}
                rows={22}
                className="w-full rounded-lg border border-neutral-200 bg-neutral-50/50 p-3.5 font-mono text-xs text-neutral-800 leading-relaxed transition-colors placeholder:text-neutral-400 focus:border-neutral-900 focus:bg-white focus:outline-none"
              />
            ) : (
              <MarkdownPreview content={promptText} className="w-full min-h-[300px] max-h-[500px]" />
            )}

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
