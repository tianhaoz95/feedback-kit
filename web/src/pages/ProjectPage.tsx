import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import type { FeedbackItem, Project, PromptTemplate } from "@/lib/types";
import { TemplateEditorForm } from "@/components/TemplateEditorForm";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { ArrowLeftIcon, InboxIcon, SparkleIcon, TemplateIcon, TerminalIcon } from "@/components/icons";
import { SdkSetupCard } from "@/components/SdkSetupCard";
import { McpSetupCard } from "@/components/McpSetupCard";

type TabKey = "feedback" | "sdk" | "agent" | "template";

const TABS: { id: TabKey; label: string; icon: typeof InboxIcon }[] = [
  { id: "feedback", label: "Feedback", icon: InboxIcon },
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

  const tabParam = searchParams.get("tab");
  const activeTab: TabKey =
    tabParam === "sdk" || tabParam === "agent" || tabParam === "template"
      ? tabParam
      : "feedback";

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
          ) : (
            <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
              <ul className="divide-y divide-neutral-100">
                {feedbackItems.map((item) => (
                  <li key={item.id}>
                    <Link
                      to={`/projects/${projectId}/feedback/${item.id}`}
                      className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-neutral-50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-neutral-900">
                          {item.text ? truncate(item.text, 80) : "(no description)"}
                        </p>
                        <p className="mt-0.5 text-xs text-neutral-400">
                          {item.environment?.screenName ?? "Unknown screen"} ·{" "}
                          {new Date(item.created_at).toLocaleString()}
                        </p>
                      </div>
                      <StatusBadge status={item.status} className="shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
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
