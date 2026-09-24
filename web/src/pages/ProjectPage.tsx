import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { getErrorMessage } from "@/lib/errors";
import type { FeedbackItem, FeedbackStatus, Project, PromptTemplate } from "@/lib/types";
import { renderPromptTemplate } from "@/lib/prompt-template";
import { TemplateEditorForm } from "@/components/TemplateEditorForm";
import { StatusBadge } from "@/components/StatusBadge";
import { StatusSelect } from "@/components/StatusSelect";
import { EmptyState } from "@/components/EmptyState";
import { FeedbackPromptEditor } from "@/components/FeedbackPromptEditor";
import { Button } from "@/components/Button";
import {
  AlertIcon,
  ArchiveIcon,
  ArchiveRestoreIcon,
  ArrowLeftIcon,
  ChevronDownIcon,
  ExternalLinkIcon,
  GitHubIcon,
  InboxIcon,
  PaperclipIcon,
  SettingsIcon,
  SparkleIcon,
  TemplateIcon,
  TerminalIcon,
  TrashIcon,
  XIcon,
} from "@/components/icons";
import { SdkSetupCard } from "@/components/SdkSetupCard";
import { McpSetupCard } from "@/components/McpSetupCard";
import { GitHubSetupCard } from "@/components/GitHubSetupCard";
import { MergedPromptView } from "@/components/MergedPromptView";

type TabKey = "feedback" | "settings" | "sdk" | "agent";

const TABS: {
  id: TabKey;
  label: string;
  shortLabel?: string;
  icon: typeof InboxIcon | typeof SettingsIcon;
}[] = [
  { id: "feedback", label: "Feedback", icon: InboxIcon },
  { id: "settings", label: "Settings", icon: SettingsIcon },
  { id: "sdk", label: "SDK setup", shortLabel: "SDK", icon: TerminalIcon },
  { id: "agent", label: "Connect AI agent", shortLabel: "AI Agent", icon: SparkleIcon },
];

export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [project, setProject] = useState<Project | null | undefined>(undefined);
  const [template, setTemplate] = useState<PromptTemplate | null>(null);
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
  const [signedUrls, setSignedUrls] = useState<
    Record<string, { screenshot: string | null; attachment: string | null }>
  >({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"single" | "merged">("single");
  const [isArchivedExpanded, setIsArchivedExpanded] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<
    | { type: "single"; item: FeedbackItem }
    | { type: "batch"; items: FeedbackItem[] }
    | null
  >(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const lastExpandedParamRef = useRef<string | null>(null);

  const activeFeedbackItems = feedbackItems.filter((item) => !item.is_archived);
  const archivedFeedbackItems = feedbackItems.filter((item) => !!item.is_archived);

  const tabParam = searchParams.get("tab");
  const activeTab: TabKey =
    tabParam === "settings" || tabParam === "github" || tabParam === "template"
      ? "settings"
      : tabParam === "sdk" || tabParam === "agent"
      ? tabParam
      : "feedback";

  const feedbackParam = searchParams.get("feedback");
  const selectedFeedback =
    feedbackItems.find((item) => item.id === feedbackParam) ??
    activeFeedbackItems[0] ??
    archivedFeedbackItems[0] ??
    null;

  const [isCreatingIssue, setIsCreatingIssue] = useState(false);
  const [issueError, setIssueError] = useState<{ message: string; installUrl?: string } | null>(null);

  async function createIssue(feedbackId: string) {
    if (!project) return;
    setIssueError(null);

    if (!project.github_repo) {
      setIssueError({
        message: "Please connect a GitHub repository in the Settings tab first.",
      });
      return;
    }

    setIsCreatingIssue(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-github-issue", {
        body: {
          project_id: project.id,
          feedback_id: feedbackId,
        },
      });

      if (error) {
        let body: { message?: string; install_url?: string; error?: string } | null = null;
        if (
          error instanceof FunctionsHttpError ||
          (error && typeof error === "object" && "context" in error && (error as { context?: unknown }).context instanceof Response)
        ) {
          body = await (error as FunctionsHttpError).context.json().catch(() => null);
        }
        if (body?.install_url) {
          setIssueError({
            message: body.message || "FeedbackKit GitHub App is not installed on this repository.",
            installUrl: body.install_url,
          });
          return;
        }
        setIssueError({
          message: body?.message || error.message || "Failed to create GitHub issue.",
        });
        return;
      }

      if (data?.issue_url) {
        setFeedbackItems((current) =>
          current.map((item) =>
            item.id === feedbackId
              ? {
                  ...item,
                  github_issue_url: data.issue_url,
                  github_issue_number: data.issue_number,
                  status: item.status === "new" ? "in_progress" : item.status,
                }
              : item
          )
        );
      }
    } catch (err) {
      setIssueError({
        message: err instanceof Error ? err.message : "Failed to create GitHub issue.",
      });
    } finally {
      setIsCreatingIssue(false);
    }
  }

  function handleTabChange(tab: TabKey) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (tab === "feedback") {
          next.delete("tab");
        } else {
          next.set("tab", tab);
        }
        return next;
      },
      { replace: true }
    );
  }

  function handleSelectFeedback(id: string) {
    if (archivedFeedbackItems.some((item) => item.id === id)) {
      setIsArchivedExpanded(true);
    }
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("feedback", id);
        return next;
      },
      { replace: true }
    );
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      document.getElementById("feedback-detail")?.scrollIntoView({ behavior: "smooth" });
    }
  }

  useEffect(() => {
    if (
      feedbackParam &&
      feedbackParam !== lastExpandedParamRef.current &&
      archivedFeedbackItems.some((item) => item.id === feedbackParam)
    ) {
      lastExpandedParamRef.current = feedbackParam;
      setIsArchivedExpanded(true);
    }
  }, [feedbackParam, archivedFeedbackItems]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && deleteTarget && !isDeleting) {
        setDeleteTarget(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteTarget, isDeleting]);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;

    (async () => {
      const [{ data: projectData }, { data: templateData }, { data: feedbackData }] = await Promise.all([
        supabase.from("projects").select("*").eq("id", projectId).single<Project>(),
        supabase.from("prompt_templates").select("*").eq("project_id", projectId).single<PromptTemplate>(),
        supabase
          .from("feedback_items")
          .select("*")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false })
          .returns<FeedbackItem[]>(),
      ]);

      if (cancelled) return;
      setProject(projectData ?? null);
      setTemplate(templateData ?? null);
      setFeedbackItems(feedbackData ?? []);
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  function toggleSelectItem(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      if (next.size === 0) {
        setViewMode("single");
      }
      return next;
    });
  }

  function handleToggleSelectAll() {
    const candidateItems = isArchivedExpanded ? feedbackItems : activeFeedbackItems;
    const allSelected =
      candidateItems.length > 0 && candidateItems.every((item) => selectedIds.has(item.id));
    if (allSelected) {
      setSelectedIds(new Set());
      setViewMode("single");
    } else {
      setSelectedIds(new Set(candidateItems.map((item) => item.id)));
    }
  }

  function handleClearSelection() {
    setSelectedIds(new Set());
    setViewMode("single");
  }

  async function handleBatchUpdateStatus(status: FeedbackStatus) {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const { error } = await supabase
      .from("feedback_items")
      .update({ status })
      .in("id", ids);

    if (error) throw new Error(error.message);
    setFeedbackItems((current) =>
      current.map((item) => (selectedIds.has(item.id) ? { ...item, status } : item))
    );
  }

  // Fetch signed URLs for selected feedback item and selectedIds items (cached per ID)
  useEffect(() => {
    const idsToFetch = new Set<string>();
    if (selectedFeedback && !signedUrls[selectedFeedback.id]) {
      idsToFetch.add(selectedFeedback.id);
    }
    for (const id of selectedIds) {
      if (!signedUrls[id]) {
        idsToFetch.add(id);
      }
    }
    if (idsToFetch.size === 0) return;

    let cancelled = false;

    (async () => {
      const itemsToFetch = feedbackItems.filter((item) => idsToFetch.has(item.id));
      const results = await Promise.all(
        itemsToFetch.map(async (item) => {
          const [signedScreenshot, signedAttachment] = await Promise.all([
            item.screenshot_annotated_path
              ? supabase.storage
                  .from("feedback-screenshots")
                  .createSignedUrl(item.screenshot_annotated_path, 60 * 60)
              : Promise.resolve(null),
            item.attachment_path
              ? supabase.storage
                  .from("feedback-screenshots")
                  .createSignedUrl(item.attachment_path, 60 * 60)
              : Promise.resolve(null),
          ]);
          return {
            id: item.id,
            screenshot: signedScreenshot?.data?.signedUrl ?? null,
            attachment: signedAttachment?.data?.signedUrl ?? null,
          };
        })
      );

      if (cancelled) return;
      setSignedUrls((prev) => {
        const next = { ...prev };
        for (const res of results) {
          next[res.id] = {
            screenshot: res.screenshot,
            attachment: res.attachment,
          };
        }
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedFeedback, selectedIds, feedbackItems, signedUrls]);

  async function updatePromptTemplate(formData: FormData) {
    if (!projectId) return;
    const templateText = String(formData.get("template_text") || "");

    const { error } = await supabase
      .from("prompt_templates")
      .update({ template_text: templateText, updated_at: new Date().toISOString() })
      .eq("project_id", projectId);

    if (error) throw new Error(error.message);
    setTemplate((current) => (current ? { ...current, template_text: templateText } : current));
  }

  async function updateFeedbackStatus(feedbackId: string, status: FeedbackStatus) {
    const { error } = await supabase
      .from("feedback_items")
      .update({ status })
      .eq("id", feedbackId);

    if (error) throw new Error(error.message);
    setFeedbackItems((current) =>
      current.map((item) => (item.id === feedbackId ? { ...item, status } : item))
    );
  }

  async function saveEditedPrompt(feedbackId: string, formData: FormData) {
    const editedPrompt = String(formData.get("template_text") || "");
    const { error } = await supabase
      .from("feedback_items")
      .update({ edited_prompt: editedPrompt })
      .eq("id", feedbackId);

    if (error) throw new Error(error.message);
    setFeedbackItems((current) =>
      current.map((item) => (item.id === feedbackId ? { ...item, edited_prompt: editedPrompt } : item))
    );
  }

  async function resetEditedPrompt(feedbackId: string) {
    const { error } = await supabase
      .from("feedback_items")
      .update({ edited_prompt: null })
      .eq("id", feedbackId);

    if (error) throw new Error(error.message);
    setFeedbackItems((current) =>
      current.map((item) => (item.id === feedbackId ? { ...item, edited_prompt: null } : item))
    );
  }

  async function handleArchiveFeedback(feedbackId: string) {
    try {
      const { error } = await supabase
        .from("feedback_items")
        .update({ is_archived: true })
        .eq("id", feedbackId);

      if (error) throw error;

      setFeedbackItems((current) =>
        current.map((item) => (item.id === feedbackId ? { ...item, is_archived: true } : item))
      );

      // If the currently selected item is being archived, advance selection to another active item if one exists
      if (selectedFeedback?.id === feedbackId) {
        const remainingActive = feedbackItems.filter(
          (item) => !item.is_archived && item.id !== feedbackId
        );
        if (remainingActive.length > 0) {
          handleSelectFeedback(remainingActive[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to archive feedback:", err);
      alert(getErrorMessage(err, "Failed to archive feedback."));
    }
  }

  async function handleUnarchiveFeedback(feedbackId: string) {
    try {
      const { error } = await supabase
        .from("feedback_items")
        .update({ is_archived: false })
        .eq("id", feedbackId);

      if (error) throw error;

      setFeedbackItems((current) =>
        current.map((item) => (item.id === feedbackId ? { ...item, is_archived: false } : item))
      );
    } catch (err) {
      console.error("Failed to unarchive feedback:", err);
      alert(getErrorMessage(err, "Failed to unarchive feedback."));
    }
  }

  async function handleBatchArchive() {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const selectedList = feedbackItems.filter((item) => selectedIds.has(item.id));
    const allAreArchived = selectedList.every((item) => item.is_archived);
    const targetArchived = !allAreArchived;

    try {
      const { error } = await supabase
        .from("feedback_items")
        .update({ is_archived: targetArchived })
        .in("id", ids);

      if (error) throw error;

      setFeedbackItems((current) =>
        current.map((item) =>
          selectedIds.has(item.id) ? { ...item, is_archived: targetArchived } : item
        )
      );

      if (targetArchived && selectedFeedback && selectedIds.has(selectedFeedback.id)) {
        const remainingActive = feedbackItems.filter(
          (item) => !item.is_archived && !selectedIds.has(item.id)
        );
        if (remainingActive.length > 0) {
          handleSelectFeedback(remainingActive[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to batch update archive status:", err);
      alert(getErrorMessage(err, "Failed to update archive status."));
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);

    try {
      const itemsToDelete =
        deleteTarget.type === "single" ? [deleteTarget.item] : deleteTarget.items;
      const idsToDelete = itemsToDelete.map((item) => item.id);

      // Best effort cleanup of storage objects
      const storagePaths: string[] = [];
      for (const item of itemsToDelete) {
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

      // Delete database row(s)
      const { error } = await supabase
        .from("feedback_items")
        .delete()
        .in("id", idsToDelete);

      if (error) throw error;

      const deletedSet = new Set(idsToDelete);
      const remainingItems = feedbackItems.filter((item) => !deletedSet.has(item.id));
      setFeedbackItems(remainingItems);

      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of idsToDelete) next.delete(id);
        return next;
      });

      if (selectedFeedback && deletedSet.has(selectedFeedback.id)) {
        const nextActive = remainingItems.filter((item) => !item.is_archived);
        const nextItem = nextActive[0] ?? remainingItems[0] ?? null;
        if (nextItem) {
          handleSelectFeedback(nextItem.id);
        } else {
          setSearchParams(
            (prev) => {
              const next = new URLSearchParams(prev);
              next.delete("feedback");
              return next;
            },
            { replace: true }
          );
        }
      }

      setDeleteTarget(null);
    } catch (err) {
      console.error("Failed to delete feedback:", err);
      alert(getErrorMessage(err, "Failed to delete feedback."));
    } finally {
      setIsDeleting(false);
    }
  }

  if (project === undefined) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between border-b border-neutral-200/80">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="h-7 w-20 animate-pulse rounded-lg bg-neutral-200" />
            <div className="h-4 w-px bg-neutral-200" />
            <div className="h-6 w-36 animate-pulse rounded bg-neutral-200" />
          </div>
          <div className="h-9 w-72 sm:w-96 animate-pulse rounded-xl bg-neutral-200" />
        </div>
      </div>
    );
  }

  if (project === null) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-neutral-500">Project not found.</p>
        <Link
          to="/projects"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-900 hover:underline"
        >
          <ArrowLeftIcon className="h-4 w-4" /> Back to projects
        </Link>
      </div>
    );
  }

  const ingestUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ingest-feedback`;

  const selectedScreenshotUrl = selectedFeedback ? signedUrls[selectedFeedback.id]?.screenshot ?? null : null;
  const selectedAttachmentUrl = selectedFeedback ? signedUrls[selectedFeedback.id]?.attachment ?? null : null;
  const promptValue = selectedFeedback
    ? selectedFeedback.edited_prompt ??
      renderPromptTemplate(
        template?.template_text ?? "",
        selectedFeedback,
        selectedScreenshotUrl,
        selectedAttachmentUrl
      )
    : "";
  const env = selectedFeedback?.environment;

  function renderFeedbackCard(item: FeedbackItem, isArchivedSection: boolean) {
    const isSelected = selectedFeedback?.id === item.id;
    const isChecked = selectedIds.has(item.id);
    return (
      <div
        key={item.id}
        className={`group relative flex items-start gap-2.5 rounded-xl border p-3 transition-all ${
          isSelected && viewMode === "single"
            ? "border-neutral-900 bg-white shadow-sm ring-1 ring-neutral-900/10"
            : isChecked
            ? "border-neutral-400 bg-neutral-50/70"
            : isArchivedSection
            ? "border-neutral-200/60 bg-neutral-50/50 hover:border-neutral-300 hover:bg-white"
            : "border-neutral-200/80 bg-white hover:border-neutral-300 hover:bg-neutral-50/70"
        }`}
      >
        <div className="pt-0.5 shrink-0">
          <input
            type="checkbox"
            checked={isChecked}
            onChange={(e) => {
              e.stopPropagation();
              toggleSelectItem(item.id);
            }}
            aria-label={`Select report ${item.environment?.screenName ?? item.id}`}
            className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900 cursor-pointer accent-neutral-900"
          />
        </div>

        <button
          type="button"
          onClick={() => {
            handleSelectFeedback(item.id);
            if (viewMode === "merged") {
              setViewMode("single");
            }
          }}
          className="flex-1 text-left min-w-0 cursor-pointer"
        >
          <div className="flex items-start justify-between gap-2">
            <p
              className={`line-clamp-2 text-sm leading-snug ${
                isSelected && viewMode === "single"
                  ? "font-semibold text-neutral-900"
                  : isArchivedSection
                  ? "font-medium text-neutral-600"
                  : "font-medium text-neutral-800"
              }`}
            >
              {item.text ? truncate(item.text, 80) : "(no description)"}
            </p>
            <div className="flex items-center gap-1.5 shrink-0">
              {item.github_issue_number ? (
                <span
                  title={`GitHub Issue #${item.github_issue_number}`}
                  className="inline-flex items-center gap-1 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600 border border-neutral-200/80"
                >
                  <GitHubIcon className="h-2.5 w-2.5 text-neutral-500" />
                  <span>#{item.github_issue_number}</span>
                </span>
              ) : null}
              {item.is_archived && (
                <span
                  title="Archived"
                  className="inline-flex items-center gap-1 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500 border border-neutral-200"
                >
                  <ArchiveIcon className="h-2.5 w-2.5 text-neutral-400" />
                  <span>Archived</span>
                </span>
              )}
              <StatusBadge status={item.status} className="shrink-0" />
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-neutral-400">
            <span className="truncate max-w-[140px] font-medium text-neutral-500">
              {item.environment?.screenName ?? "Unknown screen"}
            </span>
            <span className="shrink-0">{formatDate(item.created_at)}</span>
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header bar: Back button + Project title + Tabs on the same row */}
      <header className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between border-b border-neutral-200/80">
        {/* Left: Back button + Project title */}
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <Link
            to="/projects"
            className="group inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-600 shadow-2xs transition-all hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-900 shrink-0"
            title="Back to projects"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            <span className="hidden sm:inline">Projects</span>
          </Link>
          <div className="h-4 w-px bg-neutral-200 shrink-0" aria-hidden="true" />
          <h1
            className="truncate text-lg sm:text-xl font-semibold tracking-tight text-neutral-900"
            title={project.name}
          >
            {project.name}
          </h1>
        </div>

        {/* Right: Tabs */}
        <nav
          className="inline-flex max-w-full items-center rounded-xl bg-neutral-100/90 p-1 border border-neutral-200/80 shadow-2xs overflow-x-auto shrink-0"
          aria-label="Project tabs"
        >
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={`group inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-white text-neutral-900 font-semibold shadow-xs"
                    : "text-neutral-600 hover:text-neutral-900 hover:bg-white/50"
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 transition-colors ${
                    isActive ? "text-neutral-900" : "text-neutral-400 group-hover:text-neutral-600"
                  }`}
                />
                <span>
                  <span className="hidden lg:inline">{tab.label}</span>
                  <span className="lg:hidden">{tab.shortLabel ?? tab.label}</span>
                </span>
                {tab.id === "feedback" && feedbackItems.length > 0 ? (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none transition-colors ${
                      isActive
                        ? "bg-neutral-900 text-white"
                        : "bg-neutral-200/90 text-neutral-600 group-hover:bg-neutral-300"
                    }`}
                  >
                    {activeFeedbackItems.length}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
      </header>

      {activeTab === "feedback" && (
        <section>
          {feedbackItems.length === 0 ? (
            <EmptyState
              icon={<InboxIcon className="h-6 w-6" />}
              title="No feedback yet"
              description="Once the SDK is wired up in your app, reports will show up here."
              action={
                <button
                  type="button"
                  onClick={() => handleTabChange("sdk")}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-neutral-800 transition-colors"
                >
                  <TerminalIcon className="h-3.5 w-3.5" />
                  <span>Set up SDK</span>
                </button>
              }
            />
          ) : selectedFeedback ? (
            <div className="flex flex-col lg:flex-row gap-6 items-start">
              {/* Left Sidebar List */}
              <div className="w-full lg:w-80 xl:w-96 shrink-0 space-y-2.5 lg:sticky lg:top-20">
                <div className="flex items-center justify-between px-1 pb-0.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    {archivedFeedbackItems.length > 0
                      ? `Active Reports (${activeFeedbackItems.length})`
                      : `Reports (${activeFeedbackItems.length})`}
                  </span>
                  {feedbackItems.length > 0 && (
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className="text-xs font-medium text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer"
                    >
                      {(isArchivedExpanded ? feedbackItems : activeFeedbackItems).length > 0 &&
                      (isArchivedExpanded ? feedbackItems : activeFeedbackItems).every((item) =>
                        selectedIds.has(item.id)
                      )
                        ? "Deselect all"
                        : "Select all"}
                    </button>
                  )}
                </div>

                {/* Multi-selection action pill */}
                {selectedIds.size > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-2 text-xs">
                    <span className="font-semibold text-neutral-700 pl-1">
                      {selectedIds.size} selected
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {viewMode === "single" ? (
                        <button
                          type="button"
                          onClick={() => setViewMode("merged")}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-neutral-900 px-2 py-1 text-xs font-medium text-white shadow-xs hover:bg-neutral-800 transition-colors"
                        >
                          <SparkleIcon className="h-3 w-3" />
                          <span>Merged prompt</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setViewMode("single")}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
                        >
                          <span>Single view</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleBatchArchive}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
                        title="Archive or unarchive selected reports"
                      >
                        <ArchiveIcon className="h-3 w-3 text-neutral-500" />
                        <span>
                          {Array.from(selectedIds).every(
                            (id) => feedbackItems.find((i) => i.id === id)?.is_archived
                          )
                            ? "Unarchive"
                            : "Archive"}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteTarget({
                            type: "batch",
                            items: feedbackItems.filter((i) => selectedIds.has(i.id)),
                          })
                        }
                        className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 hover:border-red-300 transition-colors"
                        title="Delete selected reports"
                      >
                        <TrashIcon className="h-3 w-3 text-red-500" />
                        <span>Delete</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleClearSelection}
                        className="p-1 text-neutral-400 hover:text-neutral-700 rounded transition-colors cursor-pointer"
                        title="Clear selection"
                      >
                        <XIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-2 max-h-[420px] lg:max-h-[calc(100vh-12rem)] overflow-y-auto pr-1">
                  {activeFeedbackItems.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50/50 p-6 text-center">
                      <InboxIcon className="mx-auto h-5 w-5 text-neutral-400" />
                      <p className="mt-1.5 text-xs font-medium text-neutral-600">No active reports</p>
                      <p className="mt-0.5 text-[11px] text-neutral-400">
                        {archivedFeedbackItems.length > 0
                          ? "All reports in this project are archived."
                          : "Reports from your app will show up here."}
                      </p>
                    </div>
                  ) : (
                    activeFeedbackItems.map((item) => renderFeedbackCard(item, false))
                  )}

                  {/* Archived section - collapsed by default so it does not take user attention */}
                  {archivedFeedbackItems.length > 0 && (
                    <div className="pt-2 border-t border-neutral-200/80">
                      <button
                        type="button"
                        onClick={() => setIsArchivedExpanded((prev) => !prev)}
                        className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 transition-colors cursor-pointer border border-dashed border-neutral-200 bg-neutral-50/50"
                      >
                        <div className="flex items-center gap-2">
                          <ArchiveIcon className="h-3.5 w-3.5 text-neutral-400" />
                          <span>Archived ({archivedFeedbackItems.length})</span>
                        </div>
                        <ChevronDownIcon
                          className={`h-3.5 w-3.5 text-neutral-400 transition-transform duration-200 ${
                            isArchivedExpanded ? "rotate-180" : ""
                          }`}
                        />
                      </button>

                      {isArchivedExpanded && (
                        <div className="mt-2 space-y-2">
                          {archivedFeedbackItems.map((item) => renderFeedbackCard(item, true))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Detail Pane */}
              <div id="feedback-detail" className="flex-1 min-w-0 w-full space-y-5">
                {viewMode === "merged" && selectedIds.size > 0 ? (
                  <MergedPromptView
                    selectedItems={feedbackItems.filter((item) => selectedIds.has(item.id))}
                    signedUrls={signedUrls}
                    templateText={template?.template_text}
                    onDeselectItem={(id) => toggleSelectItem(id)}
                    onSelectSingleItem={(id) => {
                      handleSelectFeedback(id);
                      setViewMode("single");
                    }}
                    onBatchUpdateStatus={handleBatchUpdateStatus}
                    onBatchArchive={handleBatchArchive}
                    onBatchDelete={() =>
                      setDeleteTarget({
                        type: "batch",
                        items: feedbackItems.filter((item) => selectedIds.has(item.id)),
                      })
                    }
                    onClearSelection={handleClearSelection}
                    onBackToSingleView={() => setViewMode("single")}
                  />
                ) : (
                  <>
                    {selectedIds.size >= 2 && (
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-900/10 bg-neutral-900 text-white px-4 py-2.5 shadow-sm">
                        <div className="flex items-center gap-2 text-xs">
                          <SparkleIcon className="h-4 w-4 text-amber-300 shrink-0" />
                          <span>
                            <strong>{selectedIds.size} reports selected.</strong> Merge them into a single prompt for your coding agent to solve together.
                          </span>
                        </div>
                        <Button
                          variant="white"
                          size="sm"
                          onClick={() => setViewMode("merged")}
                          className="shrink-0 font-semibold"
                        >
                          View Merged Prompt ({selectedIds.size}) →
                        </Button>
                      </div>
                    )}

                    {/* Detail Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-5 py-3.5 shadow-xs">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-base font-semibold text-neutral-900">
                        {env?.screenName ? `${env.screenName} screen` : "Feedback report"}
                      </h2>
                      {selectedFeedback.is_archived && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600 border border-neutral-200">
                          <ArchiveIcon className="h-3 w-3 text-neutral-400" />
                          <span>Archived</span>
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-neutral-400">
                      Received {new Date(selectedFeedback.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    {selectedFeedback.github_issue_url ? (
                      <a
                        href={selectedFeedback.github_issue_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs font-medium text-neutral-900 hover:bg-neutral-100 hover:border-neutral-300 transition-colors"
                      >
                        <GitHubIcon className="h-3.5 w-3.5 text-neutral-700" />
                        <span>Issue #{selectedFeedback.github_issue_number ?? ""}</span>
                        <ExternalLinkIcon className="h-3 w-3 text-neutral-400" />
                      </a>
                    ) : (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={isCreatingIssue}
                        onClick={() => createIssue(selectedFeedback.id)}
                        className="inline-flex items-center gap-1.5"
                      >
                        <GitHubIcon className="h-3.5 w-3.5" />
                        <span>{isCreatingIssue ? "Creating issue…" : "Create GitHub Issue"}</span>
                      </Button>
                    )}

                    <div className="h-4 w-px bg-neutral-200" />

                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-neutral-500">Status:</span>
                      <StatusSelect
                        key={selectedFeedback.id}
                        value={selectedFeedback.status}
                        onChange={(newStatus) => updateFeedbackStatus(selectedFeedback.id, newStatus)}
                      />
                    </div>

                    <div className="h-4 w-px bg-neutral-200" />

                    {selectedFeedback.is_archived ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => handleUnarchiveFeedback(selectedFeedback.id)}
                        className="inline-flex items-center gap-1.5 text-neutral-700 hover:text-neutral-900"
                        title="Unarchive report"
                      >
                        <ArchiveRestoreIcon className="h-3.5 w-3.5 text-neutral-500" />
                        <span>Unarchive</span>
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => handleArchiveFeedback(selectedFeedback.id)}
                        className="inline-flex items-center gap-1.5 text-neutral-600 hover:text-neutral-900"
                        title="Archive this report to reduce list clutter"
                      >
                        <ArchiveIcon className="h-3.5 w-3.5 text-neutral-400" />
                        <span>Archive</span>
                      </Button>
                    )}

                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setDeleteTarget({ type: "single", item: selectedFeedback })}
                      className="inline-flex items-center gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-200"
                      title="Delete this report permanently"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                      <span>Delete</span>
                    </Button>
                  </div>
                </div>

                {selectedFeedback.is_archived && (
                  <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-2.5 text-xs text-amber-800">
                    <div className="flex items-center gap-2">
                      <ArchiveIcon className="h-4 w-4 text-amber-600 shrink-0" />
                      <span>This report is archived and hidden from the active list.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUnarchiveFeedback(selectedFeedback.id)}
                      className="font-semibold text-amber-900 underline hover:text-amber-950 cursor-pointer"
                    >
                      Restore to active
                    </button>
                  </div>
                )}

                {issueError ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-red-50 px-4 py-2.5 text-xs text-red-700 border border-red-100">
                    <div className="flex items-center gap-2 min-w-0">
                      <AlertIcon className="h-4 w-4 shrink-0 text-red-600" />
                      <span>{issueError.message}</span>
                    </div>
                    {issueError.installUrl ? (
                      <a
                        href={issueError.installUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-red-800 underline hover:text-red-900"
                      >
                        <span>Install GitHub App</span>
                        <ExternalLinkIcon className="h-3 w-3" />
                      </a>
                    ) : !project.github_repo ? (
                      <button
                        type="button"
                        onClick={() => handleTabChange("settings")}
                        className="font-medium text-red-800 underline hover:text-red-900"
                      >
                        Go to Settings
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {/* Subgrid: Left = Screenshot/Desc/Env, Right = Prompt */}
                <div className="grid gap-5 xl:grid-cols-2 items-stretch">
                  <div className="space-y-4">
                    {/* Screenshot */}
                    {selectedScreenshotUrl ? (
                      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xs">
                        <div className="border-b border-neutral-100 bg-neutral-50/70 px-4 py-2 text-xs font-medium text-neutral-500">
                          Annotated screenshot
                        </div>
                        <div className="flex items-center justify-center bg-neutral-900/5 p-4">
                          <img
                            src={selectedScreenshotUrl}
                            alt="Annotated screenshot"
                            className="max-h-[520px] w-auto rounded-lg object-contain shadow-xs"
                          />
                        </div>
                      </div>
                    ) : selectedFeedback.screenshot_annotated_path ? (
                      <div className="flex h-64 animate-pulse items-center justify-center rounded-xl border border-neutral-200 bg-neutral-100">
                        <span className="text-xs text-neutral-400">Loading screenshot…</span>
                      </div>
                    ) : null}

                    {/* Description */}
                    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                        User&apos;s description
                      </h3>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-800 leading-relaxed">
                        {selectedFeedback.text || "(no description provided)"}
                      </p>
                    </div>

                    {/* Environment */}
                    {env ? (
                      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                          Environment
                        </h3>
                        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
                          <Row label="Screen" value={env.screenName ?? "—"} />
                          <Row label="OS" value={`${env.osName ?? ""} ${env.osVersion ?? ""}`.trim() || "—"} />
                          <Row label="Device" value={env.deviceModel ?? "—"} />
                          <Row
                            label="App version"
                            value={
                              env.appVersion ? `${env.appVersion} (${env.appBuild ?? ""})` : "—"
                            }
                          />
                          <Row label="Locale" value={env.locale ?? "—"} />
                          <Row
                            label="Screen size"
                            value={
                              env.screenWidthPoints
                                ? `${env.screenWidthPoints}×${env.screenHeightPoints} @${env.screenScale}x`
                                : "—"
                            }
                          />
                        </dl>
                      </div>
                    ) : null}

                    {/* Attachment (if present) */}
                    {selectedFeedback.attachment_path ? (
                      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs">
                        <div className="flex items-center gap-2">
                          <PaperclipIcon className="h-4 w-4 text-neutral-400" />
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                            Attachment
                          </h3>
                        </div>
                        {selectedAttachmentUrl ? (
                          <a
                            href={selectedAttachmentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-block truncate text-sm text-blue-600 hover:underline"
                          >
                            {selectedFeedback.attachment_filename ?? "Download attachment"}
                          </a>
                        ) : (
                          <p className="mt-2 text-sm text-neutral-400">Loading attachment…</p>
                        )}
                      </div>
                    ) : null}
                  </div>

                  {/* Right Column: Prompt for coding agent */}
                  <div className="flex flex-col h-full">
                    <div className="flex flex-1 flex-col rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
                      <div className="flex items-center gap-2">
                        <SparkleIcon className="h-4 w-4 text-neutral-500" />
                        <h3 className="text-sm font-semibold text-neutral-900">Prompt for coding agent</h3>
                      </div>
                      <p className="mt-1 text-xs text-neutral-500">
                        Generated from the project template. Edit as needed, then copy into Claude Code,
                        Cursor, Antigravity, or Codex.
                      </p>
                      <div className="mt-3 flex flex-1 flex-col min-h-0">
                        <FeedbackPromptEditor
                          key={`${selectedFeedback.id}-${promptValue}`}
                          initialValue={promptValue}
                          isEdited={selectedFeedback.edited_prompt !== null}
                          onSave={(formData) => saveEditedPrompt(selectedFeedback.id, formData)}
                          onReset={() => resetEditedPrompt(selectedFeedback.id)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
          ) : null}
        </section>
      )}

      {activeTab === "settings" && (
        <div className="space-y-6">
          <section className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div>
              <div className="flex items-center gap-2">
                <TemplateIcon className="h-5 w-5 text-neutral-900" />
                <h2 className="text-base font-semibold text-neutral-900">Default coding-agent prompt template</h2>
              </div>
              <p className="mt-1 text-xs text-neutral-500">
                Used to pre-fill the prompt on every new feedback item in this project. Each item can still
                be edited individually before copying.
              </p>
            </div>
            <TemplateEditorForm
              key={template?.id ?? "template"}
              action={updatePromptTemplate}
              initialValue={template?.template_text ?? ""}
            />
          </section>

          <GitHubSetupCard
            project={project}
            onProjectUpdated={(updated) =>
              setProject((prev) => (prev ? { ...prev, ...updated } : prev))
            }
          />
        </div>
      )}

      {activeTab === "sdk" && (
        <SdkSetupCard
          projectKey={project.project_key}
          endpointUrl={ingestUrl}
          projectName={project.name}
        />
      )}

      {activeTab === "agent" && (
        <McpSetupCard
          projectId={project.id}
          projectName={project.name}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeleting) setDeleteTarget(null);
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 border border-red-100">
                <TrashIcon className="h-5 w-5" />
              </div>
              <div>
                <h3 id="delete-dialog-title" className="text-base font-semibold text-neutral-900">
                  {deleteTarget.type === "single"
                    ? "Delete feedback report?"
                    : `Delete ${deleteTarget.items.length} feedback reports?`}
                </h3>
                <p className="mt-1 text-xs text-neutral-500 leading-relaxed">
                  {deleteTarget.type === "single"
                    ? "This action cannot be undone. The feedback report, annotated screenshot, and any attachments will be permanently deleted."
                    : `This action cannot be undone. All ${deleteTarget.items.length} selected reports, annotated screenshots, and any attachments will be permanently deleted.`}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isDeleting}
                className="inline-flex cursor-pointer items-center justify-center rounded-lg px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-neutral-400">{label}</dt>
      <dd className="font-medium text-neutral-700">{value}</dd>
    </>
  );
}
