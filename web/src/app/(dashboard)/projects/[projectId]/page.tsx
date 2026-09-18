import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { FeedbackItem, Project, PromptTemplate } from "@/lib/types";
import { CopyButton } from "@/components/CopyButton";
import { TemplateEditorForm } from "@/components/TemplateEditorForm";
import { updatePromptTemplate } from "./actions";

const STATUS_LABEL: Record<string, string> = {
  new: "New",
  in_progress: "In progress",
  resolved: "Resolved",
  wont_fix: "Won't fix",
};

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single<Project>();

  if (!project) notFound();

  const { data: template } = await supabase
    .from("prompt_templates")
    .select("*")
    .eq("project_id", projectId)
    .single<PromptTemplate>();

  const { data: feedbackItems } = await supabase
    .from("feedback_items")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .returns<FeedbackItem[]>();

  const ingestUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ingest-feedback`;
  const swiftSnippet = `FeedbackKit.configure(.init(\n    endpointURL: URL(string: "${ingestUrl}")!,\n    projectKey: "${project.project_key}"\n))`;

  return (
    <div className="space-y-10">
      <div>
        <Link href="/projects" className="text-sm text-neutral-500 hover:text-neutral-900">
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
          <TemplateEditorForm
            action={updatePromptTemplate.bind(null, projectId)}
            initialValue={template?.template_text ?? ""}
          />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium">Feedback</h2>
        <div className="mt-3 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
          {(feedbackItems ?? []).length === 0 ? (
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
                {feedbackItems!.map((item) => (
                  <tr key={item.id} className="border-b border-neutral-100 last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        href={`/projects/${projectId}/feedback/${item.id}`}
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
