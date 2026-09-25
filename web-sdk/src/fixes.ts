import { blobToBase64, DEFAULT_ENDPOINT, FeedbackSubmissionError } from "./submit";
import type { FeedbackKitConfiguration, FeedbackReport, FeedbackUser, FixUpdate } from "./types";

/**
 * The reporter's half of the closed loop — web counterpart of the Swift
 * SDK's `FixUpdatesClient` / `FeedbackReporterIdentity`. Talks to the
 * `reporter-updates` Edge Function (supabase/functions/reporter-updates);
 * keep the wire format in sync with it and with
 * Sources/FeedbackKit/Networking/FixUpdatesClient.swift.
 */

// ------------------------------------------------------------ build order

/**
 * Mirrors `compare_builds` (0014_closed_loop.sql) and every other copy:
 * dotted numeric builds compare numerically; anything else is only equal (0)
 * or incomparable (null).
 */
export function compareBuilds(a: string | null | undefined, b: string | null | undefined): -1 | 0 | 1 | null {
  if (a == null || b == null || a === "" || b === "") return null;
  if (a === b) return 0;
  const numeric = /^[0-9]+(\.[0-9]+)*$/;
  if (!numeric.test(a) || !numeric.test(b)) return null;
  const pa = a.split(".");
  const pb = b.split(".");
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = BigInt(pa[i] ?? "0");
    const nb = BigInt(pb[i] ?? "0");
    if (na < nb) return -1;
    if (na > nb) return 1;
  }
  return 0;
}

// -------------------------------------------------------- reporter identity

const STORAGE_KEY = "feedbackkit.reporterId";
const VALID_ID = /^[A-Za-z0-9_-]{16,128}$/;
let memoryId: string | null = null;
let currentUser: FeedbackUser | null = null;

function freshId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * The anonymous, random id attached to reports from this browser — what lets
 * a fix get back to the person who reported the bug. Kept in localStorage
 * (per origin); where storage is unavailable (private mode, blocked site
 * data) it lasts for the page's lifetime instead, which just means that
 * browser won't be asked to verify fixes later.
 */
export function reporterId(): string {
  if (memoryId) return memoryId;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && VALID_ID.test(stored)) return (memoryId = stored);
    const id = freshId();
    localStorage.setItem(STORAGE_KEY, id);
    return (memoryId = id);
  } catch {
    return (memoryId = freshId());
  }
}

export function setUser(user: FeedbackUser | null): void {
  currentUser = user && (user.id || user.email || user.name) ? { ...user } : null;
}

export function getUser(): FeedbackUser | null {
  return currentUser;
}

// ------------------------------------------------------------- transport

/** `…/functions/v1/ingest-feedback` → `…/functions/v1/reporter-updates`, unless overridden. */
export function reporterUpdatesEndpoint(configuration: FeedbackKitConfiguration): string {
  if (configuration.reporterUpdatesEndpoint) return configuration.reporterUpdatesEndpoint;
  const url = new URL(configuration.endpoint ?? DEFAULT_ENDPOINT);
  url.pathname = url.pathname.replace(/\/[^/]*\/?$/, "/reporter-updates");
  url.search = "";
  return url.toString();
}

interface WireUpdate {
  feedback_id: string;
  text?: string;
  created_at?: string;
  screen_name?: string | null;
  fix_stage?: string | null;
  fixed_in_build?: string | null;
  fix_summary?: string | null;
  needs_verification?: boolean;
  open_question?: { id: string; body: string; created_at: string } | null;
  screenshot_url?: string | null;
  messages?: { id: string; kind: string; body: string; author: string; created_at: string }[];
}

export function decodeUpdate(w: WireUpdate): FixUpdate {
  return {
    feedbackId: w.feedback_id,
    text: w.text ?? "",
    createdAt: w.created_at ?? "",
    screenName: w.screen_name ?? null,
    fixStage: w.fix_stage ?? null,
    fixedInBuild: w.fixed_in_build ?? null,
    fixSummary: w.fix_summary ?? null,
    needsVerification: w.needs_verification ?? false,
    openQuestion: w.open_question ? { id: w.open_question.id, body: w.open_question.body, createdAt: w.open_question.created_at } : null,
    screenshotUrl: w.screenshot_url ?? null,
    messages: (w.messages ?? []).map((m) => ({ id: m.id, kind: m.kind, body: m.body, author: m.author, createdAt: m.created_at })),
  };
}

export async function fetchFixUpdates(configuration: FeedbackKitConfiguration): Promise<FixUpdate[]> {
  const url = new URL(reporterUpdatesEndpoint(configuration));
  url.searchParams.set("project_key", configuration.projectKey);
  url.searchParams.set("reporter_id", reporterId());
  if (configuration.appBuild) url.searchParams.set("build", configuration.appBuild);
  let response: Response;
  try {
    response = await fetch(url.toString());
  } catch (error) {
    throw new FeedbackSubmissionError(`Network error: ${error instanceof Error ? error.message : String(error)}`, "network");
  }
  if (!response.ok) throw new FeedbackSubmissionError(`HTTP ${response.status}`, "server", response.status);
  const json = (await response.json()) as { updates?: WireUpdate[] };
  return (json.updates ?? []).map(decodeUpdate);
}

export type FixAction =
  | { type: "verify" }
  /** Still broken — optionally with a fresh report (text + annotated screenshot). */
  | { type: "reopen"; report?: FeedbackReport | null; text?: string }
  | { type: "reply"; text: string };

export async function encodeFixAction(
  configuration: FeedbackKitConfiguration,
  feedbackId: string,
  action: FixAction,
): Promise<Record<string, unknown>> {
  const body: Record<string, unknown> = {
    project_key: configuration.projectKey,
    reporter_id: reporterId(),
    feedback_id: feedbackId,
    action: action.type,
  };
  if (configuration.appBuild) body.build = configuration.appBuild;
  if (action.type === "reply") body.text = action.text;
  if (action.type === "reopen") {
    const report = action.report;
    const text = report?.text ?? action.text;
    if (text) body.text = text;
    if (report?.screenshotAnnotated) {
      body.screenshot_annotated_png_base64 = await blobToBase64(report.screenshotAnnotated);
      if (report.screenshotRaw) body.screenshot_raw_png_base64 = await blobToBase64(report.screenshotRaw);
      body.annotations = report.annotations;
    }
  }
  return body;
}

export async function sendFixAction(configuration: FeedbackKitConfiguration, feedbackId: string, action: FixAction): Promise<void> {
  const body = JSON.stringify(await encodeFixAction(configuration, feedbackId, action));
  let response: Response;
  try {
    response = await fetch(reporterUpdatesEndpoint(configuration), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
  } catch (error) {
    throw new FeedbackSubmissionError(`Network error: ${error instanceof Error ? error.message : String(error)}`, "network");
  }
  if (!response.ok) throw new FeedbackSubmissionError(`HTTP ${response.status}`, "server", response.status);
}
