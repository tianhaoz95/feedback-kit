import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import type { FeedbackItem, Project, PromptTemplate } from "@/lib/types";
import { CopyButton } from "@/components/CopyButton";
import { TemplateEditorForm } from "@/components/TemplateEditorForm";

const STATUS_LABEL: Record<string, string> = {
  new: "New",
  in_progress: "In progress",
  resolved: "Resolved",
  wont_fix: "Won't fix",
};

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
    return <p className="text-sm text-neutral-500">Loading…</p>;
  }

  if (project === null) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-neutral-500">Project not found.</p>
        <Link to="/projects" className="text-sm text-neutral-900 hover:underline">
          ← Back to projects
        </Link>
      </div>
    );
  }

  const ingestUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ingest-feedback`;
  const swiftSnippet = `FeedbackKit.configure(.init(\n    endpointURL: URL(string: "${ingestUrl}")!,\n    projectKey: "${project.project_key}"\n))`;

  return (
    <div className="space-y-10">
      <div>
        <Link to="/projects" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← Projects
        </Link>
        <h1 className="mt-1 text-xl font-semibold">{project.name}</h1>
      </div>

      <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-medium">iOS SDK setup</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Paste this where you configure FeedbackKit at app launch.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-md bg-neutral-900 p-3 text-xs text-neutral-100">
          {swiftSnippet}
        </pre>
        <div className="mt-2">
          <CopyButton text={swiftSnippet} label="Copy snippet" />
        </div>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-medium">Default coding-agent prompt template</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Used to pre-fill the prompt on every new feedback item in this project. Each item can still
          be edited individually before copying.
        </p>
        <div className="mt-3">
          <TemplateEditorForm action={updatePromptTemplate} initialValue={template?.template_text ?? ""} />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium">Feedback</h2>
        <div className="mt-3 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
          {feedbackItems.length === 0 ? (
            <p className="p-4 text-sm text-neutral-500">
              No feedback yet. Once the SDK is wired up, reports will show up here.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase text-neutral-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Report</th>
                  <th className="px-4 py-2 font-medium">Screen</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Received</th>
                </tr>
              </thead>
              <tbody>
                {feedbackItems.map((item) => (
                  <tr key={item.id} className="border-b border-neutral-100 last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        to={`/projects/${projectId}/feedback/${item.id}`}
                        className="font-medium text-neutral-900 hover:underline"
                      >
                        {item.text ? truncate(item.text, 70) : "(no description)"}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-neutral-500">{item.environment?.screenName ?? "—"}</td>
                    <td className="px-4 py-3 text-neutral-500">{STATUS_LABEL[item.status]}</td>
                    <td className="px-4 py-3 text-neutral-500">
                      {new Date(item.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
