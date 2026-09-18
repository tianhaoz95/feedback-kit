import type { FeedbackItem } from "@/lib/types";

/**
 * Fills a `{{placeholder}}` template with a feedback item's data. Deliberately
 * a plain find-and-replace rather than a templating library — the set of
 * placeholders is small and fixed, and keeping this trivial keeps the
 * template text itself (which developers edit directly) easy to read.
 */
export function renderPromptTemplate(
  template: string,
  feedback: FeedbackItem,
  screenshotUrl: string | null,
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
  };

  return template.replace(/{{\s*(\w+)\s*}}/g, (match, key: string) =>
    key in values ? values[key] : match,
  );
}

export const PROMPT_TEMPLATE_PLACEHOLDERS = [
  "feedback_text",
  "screen_name",
  "os_name",
  "os_version",
  "device_model",
  "app_version",
  "app_build",
  "locale",
  "screenshot_url",
] as const;
