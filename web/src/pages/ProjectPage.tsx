import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
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
  ArrowLeftIcon,
  ExternalLinkIcon,
  GitHubIcon,
  ImageOffIcon,
  InboxIcon,
  PaperclipIcon,
  SettingsIcon,
  SparkleIcon,
  TemplateIcon,
  TerminalIcon,
  XIcon,
} from "@/components/icons";
import { SdkSetupCard } from "@/components/SdkSetupCard";
import { McpSetupCard } from "@/components/McpSetupCard";
import { GitHubSetupCard } from "@/components/GitHubSetupCard";
import { MergedPromptView } from "@/components/MergedPromptView";

type TabKey = "feedback" | "settings" | "sdk" | "agent" | "template";

const TABS: { id: TabKey; label: string; icon: typeof InboxIcon | typeof SettingsIcon }[] = [
  { id: "feedback", label: "Feedback", icon: InboxIcon },
  { id: "settings", label: "Settings", icon: SettingsIcon },
  { id: "sdk", label: "SDK setup", icon: TerminalIcon },
  { id: "agent", label: "Connect AI agent", icon: SparkleIcon },
  { id: "template", label: "Prompt template", icon: TemplateIcon },
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

  const tabParam = searchParams.get("tab");
  const activeTab: TabKey =
    tabParam === "settings" || tabParam === "github"
      ? "settings"
      : tabParam === "sdk" || tabParam === "agent" || tabParam === "template"
      ? tabParam
      : "feedback";

  const feedbackParam = searchParams.get("feedback");
  const selectedFeedback =
    feedbackItems.find((item) => item.id === feedbackParam) ?? feedbackItems[0] ?? null;

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
        if (error instanceof FunctionsHttpError) {
          const body = await error.context.json().catch(() => null);
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
        setIssueError({ message: error.message || "Failed to create GitHub issue." });
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
    if (selectedIds.size === feedbackItems.length) {
      setSelectedIds(new Set());
      setViewMode("single");
    } else {
      setSelectedIds(new Set(feedbackItems.map((item) => item.id)));
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

  if (project === undefined) {
    return (
      <div className="space-y-3">
        <div className="h-4 w-24 animate-pulse rounded bg-neutral-200" />
        <div className="h-7 w-48 animate-pulse rounded bg-neutral-200" />
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

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <Link
            to="/projects"
            className="inline-flex items-center gap-1 text-sm text-neutral-500 transition-colors hover:text-neutral-900"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" /> Projects
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-neutral-900">{project.name}</h1>
        </div>

        {/* Tabs */}
        <div className="border-b border-neutral-200">
          <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Project tabs">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabChange(tab.id)}
                  className={`group inline-flex cursor-pointer items-center gap-2 border-b-2 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? "border-neutral-900 text-neutral-900 font-semibold"
                      : "border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-700"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 transition-colors ${
                      isActive ? "text-neutral-900" : "text-neutral-400 group-hover:text-neutral-500"
                    }`}
                  />
                  <span>{tab.label}</span>
                  {tab.id === "feedback" && feedbackItems.length > 0 ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                        isActive
                          ? "bg-neutral-900 text-white"
                          : "bg-neutral-100 text-neutral-600 group-hover:bg-neutral-200"
                      }`}
                    >
                      {feedbackItems.length}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

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
                    Reports ({feedbackItems.length})
                  </span>
                  {feedbackItems.length > 0 && (
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className="text-xs font-medium text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer"
                    >
                      {selectedIds.size === feedbackItems.length ? "Deselect all" : "Select all"}
                    </button>
                  )}
                </div>

                {/* Multi-selection action pill */}
                {selectedIds.size > 0 && (
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-2 text-xs">
                    <span className="font-semibold text-neutral-700 pl-1">
                      {selectedIds.size} selected
                    </span>
                    <div className="flex items-center gap-1.5">
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
                  {feedbackItems.map((item) => {
                    const isSelected = selectedFeedback.id === item.id;
                    const isChecked = selectedIds.has(item.id);
                    return (
                      <div
                        key={item.id}
                        className={`group relative flex items-start gap-2.5 rounded-xl border p-3 transition-all ${
                          isSelected && viewMode === "single"
                            ? "border-neutral-900 bg-white shadow-sm ring-1 ring-neutral-900/10"
                            : isChecked
                            ? "border-neutral-400 bg-neutral-50/70"
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
                              <StatusBadge status={item.status} className="shrink-0" />
                            </div>
                          </div>
                          <div className="mt-2 flex items-center justify-between text-xs text-neutral-400">
                            <span className="truncate max-w-[140px] font-medium text-neutral-500">
                              {item.environment?.screenName ?? "Unknown screen"}
                            </span>
                            <span className="shrink-0">
                              {formatDate(item.created_at)}
                            </span>
                          </div>
                        </button>
                      </div>
                    );
                  })}
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
                          size="sm"
                          onClick={() => setViewMode("merged")}
                          className="bg-white text-neutral-900 hover:bg-neutral-100 shrink-0 font-semibold text-xs py-1.5 px-3"
                        >
                          View Merged Prompt ({selectedIds.size}) →
                        </Button>
                      </div>
                    )}

                    {/* Detail Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-5 py-3.5 shadow-xs">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold text-neutral-900">
                      {env?.screenName ? `${env.screenName} screen` : "Feedback report"}
                    </h2>
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
                        value={selectedFeedback.status}
                        onChange={(newStatus) => updateFeedbackStatus(selectedFeedback.id, newStatus)}
                      />
                    </div>
                  </div>
                </div>

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
                <div className="grid gap-5 xl:grid-cols-2">
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
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-200 bg-white p-8 text-center shadow-xs">
                        <ImageOffIcon className="h-6 w-6 text-neutral-300" />
                        <p className="text-sm text-neutral-400">Screenshot unavailable</p>
                      </div>
                    )}

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
                  <div className="space-y-4">
                    <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
                      <div className="flex items-center gap-2">
                        <SparkleIcon className="h-4 w-4 text-neutral-500" />
                        <h3 className="text-sm font-semibold text-neutral-900">Prompt for coding agent</h3>
                      </div>
                      <p className="mt-1 text-xs text-neutral-500">
                        Generated from the project template. Edit as needed, then copy into Claude Code,
                        Cursor, Antigravity, or Codex.
                      </p>
                      <div className="mt-3">
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

      {activeTab === "template" && (
        <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <TemplateIcon className="h-4 w-4 text-neutral-400" />
            <h2 className="text-sm font-medium text-neutral-900">Default coding-agent prompt template</h2>
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            Used to pre-fill the prompt on every new feedback item in this project. Each item can still
            be edited individually before copying.
          </p>
          <div className="mt-3">
            <TemplateEditorForm action={updatePromptTemplate} initialValue={template?.template_text ?? ""} />
          </div>
        </section>
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
