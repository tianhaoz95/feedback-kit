import type { FeedbackItem } from "./types.js";

// Ported from web/src/lib/prompt-template.ts — must be kept in sync by hand
// (same plain find-and-replace approach, deliberately not a templating
// library; see that file's comment for why).
export function renderPromptTemplate(
  template: string,
  feedback: FeedbackItem,
  screenshotUrl: string | null,
  attachmentUrl: string | null,
): string {
  const env = feedback.environment;
  const values: Record<string, string> = {
    feedback_text: feedback.text || "(no description provided)",
    screen_name: env.screenName ?? "(unknown)",
    os_name: env.osName ?? "",
    os_version: env.osVersion ?? "",
    device_model: env.deviceModel ?? "",
    app_version: env.appVersion ?? "",
    app_build: env.appBuild ?? "",
    locale: env.locale ?? "",
    screenshot_url: screenshotUrl ?? "(screenshot unavailable)",
    attachment_url: attachmentUrl ?? "(no attachment)",
  };

  return template.replace(/{{\s*(\w+)\s*}}/g, (match, key: string) =>
    key in values ? values[key] : match,
  );
}
