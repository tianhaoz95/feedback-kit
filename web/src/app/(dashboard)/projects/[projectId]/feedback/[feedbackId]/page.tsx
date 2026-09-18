import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { FeedbackItem, FeedbackStatus, PromptTemplate } from "@/lib/types";
import { renderPromptTemplate } from "@/lib/prompt-template";
import { StatusSelect } from "@/components/StatusSelect";
import { FeedbackPromptEditor } from "@/components/FeedbackPromptEditor";
import { resetEditedPrompt, saveEditedPrompt, updateFeedbackStatus } from "./actions";

export default async function FeedbackDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; feedbackId: string }>;
}) {
  const { projectId, feedbackId } = await params;
  const supabase = await createClient();

  const { data: feedback } = await supabase
    .from("feedback_items")
    .select("*")
    .eq("id", feedbackId)
    .single<FeedbackItem>();

  if (!feedback) notFound();

  const { data: template } = await supabase
    .from("prompt_templates")
    .select("*")
    .eq("project_id", projectId)
    .single<PromptTemplate>();

  const { data: signedScreenshot } = await supabase.storage
    .from("feedback-screenshots")
    .createSignedUrl(feedback.screenshot_annotated_path, 60 * 60);

  const screenshotUrl = signedScreenshot?.signedUrl ?? null;
  const promptValue =
    feedback.edited_prompt ?? renderPromptTemplate(template?.template_text ?? "", feedback, screenshotUrl);

  const env = feedback.environment;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/projects/${projectId}`} className="text-sm text-neutral-500 hover:text-neutral-900">
            ← Back to project
          </Link>
          <h1 className="mt-1 text-xl font-semibold">Feedback</h1>
        </div>
        <StatusSelect
          value={feedback.status}
          onChange={(status: FeedbackStatus) => updateFeedbackStatus(projectId, feedbackId, status)}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          {screenshotUrl ? (
            <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
              {/* Signed, time-limited URL from private storage — not a static asset. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={screenshotUrl} alt="Annotated screenshot" className="w-full" />
            </div>
          ) : (
            <div className="rounded-lg border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-400 shadow-sm">
              Screenshot unavailable
            </div>
          )}

          <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-medium">User&apos;s description</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-700">
              {feedback.text || "(no description provided)"}
            </p>
          </div>

          <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-medium">Environment</h2>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-neutral-600">
              <Row label="Screen" value={env.screenName ?? "—"} />
              <Row label="OS" value={`${env.osName} ${env.osVersion}`} />
              <Row label="Device" value={env.deviceModel} />
              <Row label="App version" value={`${env.appVersion} (${env.appBuild})`} />
              <Row label="Locale" value={env.locale} />
              <Row
                label="Screen size"
                value={`${env.screenWidthPoints}×${env.screenHeightPoints} @${env.screenScale}x`}
              />
              <Row label="Received" value={new Date(feedback.created_at).toLocaleString()} />
            </dl>
          </div>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-medium">Prompt for coding agent</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Generated from the project&apos;s template. Edit as needed — you have the context to know how
            this should actually be implemented — then copy into Claude Code, Cursor, or whatever
            you use.
          </p>
          <div className="mt-3">
            <FeedbackPromptEditor
              key={promptValue}
              initialValue={promptValue}
              isEdited={feedback.edited_prompt !== null}
              onSave={(formData) => saveEditedPrompt(projectId, feedbackId, formData)}
              onReset={() => resetEditedPrompt(projectId, feedbackId)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-neutral-400">{label}</dt>
      <dd>{value}</dd>
    </>
  );
}
