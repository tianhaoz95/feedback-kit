import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import type { FeedbackItem, Project, PromptTemplate } from "@/lib/types";
import { TemplateEditorForm } from "@/components/TemplateEditorForm";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { ArrowLeftIcon, InboxIcon, SparkleIcon } from "@/components/icons";
import { SdkSetupCard } from "@/components/SdkSetupCard";

export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null | undefined>(undefined);
  const [template, setTemplate] = useState<PromptTemplate | null>(null);
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);

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
    <div className="space-y-8">
      <div>
        <Link
          to="/projects"
          className="inline-flex items-center gap-1 text-sm text-neutral-500 transition-colors hover:text-neutral-900"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" /> Projects
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-neutral-900">{project.name}</h1>
      </div>

      <SdkSetupCard
        projectKey={project.project_key}
        endpointUrl={ingestUrl}
        projectName={project.name}
      />

      <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <SparkleIcon className="h-4 w-4 text-neutral-400" />
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

      <section>
        <div className="flex items-center gap-2">
          <InboxIcon className="h-4 w-4 text-neutral-400" />
          <h2 className="text-sm font-medium text-neutral-900">Feedback</h2>
          {feedbackItems.length > 0 ? (
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500">
              {feedbackItems.length}
            </span>
          ) : null}
        </div>
        <div className="mt-3">
          {feedbackItems.length === 0 ? (
            <EmptyState
              icon={<InboxIcon className="h-6 w-6" />}
              title="No feedback yet"
              description="Once the SDK is wired up in your app, reports will show up here."
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
        </div>
      </section>
    </div>
  );
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
