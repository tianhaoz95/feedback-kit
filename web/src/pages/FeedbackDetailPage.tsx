import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import type { FeedbackItem, FeedbackStatus, PromptTemplate } from "@/lib/types";
import { renderPromptTemplate } from "@/lib/prompt-template";
import { StatusSelect } from "@/components/StatusSelect";
import { FeedbackPromptEditor } from "@/components/FeedbackPromptEditor";

export function FeedbackDetailPage() {
  const { projectId, feedbackId } = useParams<{ projectId: string; feedbackId: string }>();
  const [feedback, setFeedback] = useState<FeedbackItem | null | undefined>(undefined);
  const [template, setTemplate] = useState<PromptTemplate | null>(null);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId || !feedbackId) return;
    let cancelled = false;

    (async () => {
      const { data: feedbackData } = await supabase
        .from("feedback_items")
        .select("*")
        .eq("id", feedbackId)
        .single<FeedbackItem>();

      if (cancelled) return;
      setFeedback(feedbackData ?? null);
      if (!feedbackData) return;

      const [{ data: templateData }, signedScreenshot, signedAttachment] = await Promise.all([
        supabase.from("prompt_templates").select("*").eq("project_id", projectId).single<PromptTemplate>(),
        feedbackData.screenshot_annotated_path
          ? supabase.storage
              .from("feedback-screenshots")
              .createSignedUrl(feedbackData.screenshot_annotated_path, 60 * 60)
          : Promise.resolve(null),
        feedbackData.attachment_path
          ? supabase.storage.from("feedback-screenshots").createSignedUrl(feedbackData.attachment_path, 60 * 60)
          : Promise.resolve(null),
      ]);

      if (cancelled) return;
      setTemplate(templateData ?? null);
      setScreenshotUrl(signedScreenshot?.data?.signedUrl ?? null);
      setAttachmentUrl(signedAttachment?.data?.signedUrl ?? null);
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, feedbackId]);

  async function updateFeedbackStatus(status: FeedbackStatus) {
    if (!feedbackId) return;
    const { error } = await supabase.from("feedback_items").update({ status }).eq("id", feedbackId);
    if (error) throw new Error(error.message);
    setFeedback((current) => (current ? { ...current, status } : current));
  }

  async function saveEditedPrompt(formData: FormData) {
    if (!feedbackId) return;
    const editedPrompt = String(formData.get("template_text") || "");
    const { error } = await supabase
      .from("feedback_items")
      .update({ edited_prompt: editedPrompt })
      .eq("id", feedbackId);
    if (error) throw new Error(error.message);
    setFeedback((current) => (current ? { ...current, edited_prompt: editedPrompt } : current));
  }

  async function resetEditedPrompt() {
    if (!feedbackId) return;
    const { error } = await supabase
      .from("feedback_items")
      .update({ edited_prompt: null })
      .eq("id", feedbackId);
    if (error) throw new Error(error.message);
    setFeedback((current) => (current ? { ...current, edited_prompt: null } : current));
  }

  if (feedback === undefined) {
    return <p className="text-sm text-neutral-500">Loading…</p>;
  }

  if (feedback === null) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-neutral-500">Feedback not found.</p>
        <Link to={`/projects/${projectId}`} className="text-sm text-neutral-900 hover:underline">
          ← Back to project
        </Link>
      </div>
    );
  }

  const promptValue =
    feedback.edited_prompt ??
    renderPromptTemplate(template?.template_text ?? "", feedback, screenshotUrl, attachmentUrl);
  const env = feedback.environment;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to={`/projects/${projectId}`} className="text-sm text-neutral-500 hover:text-neutral-900">
            ← Back to project
          </Link>
          <h1 className="mt-1 text-xl font-semibold">Feedback</h1>
        </div>
        <StatusSelect value={feedback.status} onChange={updateFeedbackStatus} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          {screenshotUrl ? (
            <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
              {/* Signed, time-limited URL from private storage — not a static asset. */}
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

          {feedback.attachment_path ? (
            <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-medium">Attachment</h2>
              {attachmentUrl ? (
                <a
                  href={attachmentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block truncate text-sm text-blue-600 hover:underline"
                >
                  {feedback.attachment_filename ?? "Download attachment"}
                </a>
              ) : (
                <p className="mt-2 text-sm text-neutral-400">Attachment unavailable</p>
              )}
            </div>
          ) : null}
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
              onSave={saveEditedPrompt}
              onReset={resetEditedPrompt}
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
