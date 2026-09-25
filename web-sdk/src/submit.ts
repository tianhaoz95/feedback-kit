import type { FeedbackKitConfiguration, FeedbackProduct, FeedbackReport, FeedbackUser } from "./types";

/** The hosted FeedbackKit dashboard's ingestion endpoint. */
export const DEFAULT_ENDPOINT = "https://gpucoladcyvijefdjudf.supabase.co/functions/v1/ingest-feedback";

export class FeedbackSubmissionError extends Error {
  constructor(
    message: string,
    readonly kind: "not_configured" | "network" | "server",
    readonly status?: number,
  ) {
    super(message);
    this.name = "FeedbackSubmissionError";
  }
}

/**
 * Wire format sent to the ingestion endpoint — the exact shape the Swift
 * SDK's private `IngestPayload` produces (Sources/FeedbackKit/Networking/FeedbackSubmitter.swift)
 * and `supabase/functions/ingest-feedback` accepts. snake_case at the top
 * level; `environment`/`annotations`/`logs` pass through untouched (camelCase
 * JSONB). Optional fields are omitted rather than sent as null, matching
 * Swift's `encodeIfPresent`.
 */
export interface IngestPayload {
  project_key: string;
  id: string;
  created_at: string;
  text: string;
  screenshot_raw_png_base64?: string;
  screenshot_annotated_png_base64?: string;
  annotations: FeedbackReport["annotations"];
  environment: FeedbackReport["environment"];
  attachment_filename?: string;
  attachment_mime_type?: string;
  attachment_data_base64?: string;
  product_keys?: string[];
  products?: { key: string; name: string; description: string; is_default: boolean }[];
  logs?: FeedbackReport["logs"];
  /** Anonymous per-browser id — see fixes.ts `reporterId`. */
  reporter_id?: string;
  /** `FeedbackKit.setUser(...)`, camelCase JSONB like `environment`. */
  reporter?: FeedbackUser;
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function encodePayload(
  report: FeedbackReport,
  projectKey: string,
  identity: { reporterId?: string; user?: FeedbackUser | null } = {},
): Promise<IngestPayload> {
  const payload: IngestPayload = {
    project_key: projectKey,
    id: report.id,
    created_at: report.createdAt.toISOString(),
    text: report.text,
    annotations: report.annotations,
    environment: report.environment,
  };
  if (report.screenshotRaw && report.screenshotAnnotated) {
    const [raw, annotated] = await Promise.all([
      blobToBase64(report.screenshotRaw),
      blobToBase64(report.screenshotAnnotated),
    ]);
    payload.screenshot_raw_png_base64 = raw;
    payload.screenshot_annotated_png_base64 = annotated;
  }
  if (report.attachment) {
    payload.attachment_filename = report.attachment.filename;
    payload.attachment_mime_type = report.attachment.mimeType;
    payload.attachment_data_base64 = await blobToBase64(report.attachment.data);
  }
  if (report.products.length > 0) {
    payload.product_keys = report.products.map((p) => p.key);
    payload.products = report.products.map((p) => ({
      key: p.key,
      name: p.name,
      description: p.description ?? "",
      is_default: p.isDefault ?? false,
    }));
  }
  if (report.logs.length > 0) payload.logs = report.logs;
  if (identity.reporterId) payload.reporter_id = identity.reporterId;
  if (identity.user) payload.reporter = identity.user;
  return payload;
}

export async function submitReport(
  report: FeedbackReport,
  configuration: FeedbackKitConfiguration,
  identity: { reporterId?: string; user?: FeedbackUser | null } = {},
): Promise<void> {
  if (!configuration.projectKey) {
    throw new FeedbackSubmissionError("FeedbackKit is not configured with a project key.", "not_configured");
  }
  const body = JSON.stringify(await encodePayload(report, configuration.projectKey, identity));
  let response: Response;
  try {
    response = await fetch(configuration.endpoint ?? DEFAULT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
  } catch (error) {
    throw new FeedbackSubmissionError(
      `Network error: ${error instanceof Error ? error.message : String(error)}`,
      "network",
    );
  }
  if (!response.ok) {
    let code = "";
    try {
      const json = (await response.json()) as { error?: string };
      code = json.error ?? "";
    } catch {
      // Non-JSON error body; the status alone is enough.
    }
    const detail = code ? ` (${code})` : "";
    const message =
      code === "origin_not_allowed"
        ? `This site (${location.origin}) isn't in the project's allowed origins.`
        : response.status === 401 || response.status === 403
        ? `Server rejected the project key or origin (HTTP ${response.status})${detail}.`
        : response.status === 429
          ? "Too many reports right now — please try again in a minute."
          : `Server returned HTTP ${response.status}${detail}.`;
    throw new FeedbackSubmissionError(message, "server", response.status);
  }
}

/** `GET <endpoint>?project_key=…` — the products configured for the project in the dashboard. */
export async function fetchProducts(configuration: FeedbackKitConfiguration): Promise<FeedbackProduct[]> {
  const url = new URL(configuration.endpoint ?? DEFAULT_ENDPOINT);
  url.searchParams.set("project_key", configuration.projectKey);
  const response = await fetch(url.toString());
  if (!response.ok) throw new FeedbackSubmissionError(`HTTP ${response.status}`, "server", response.status);
  const json = (await response.json()) as {
    products?: { key: string; name: string; description?: string; is_default?: boolean }[];
  };
  return (json.products ?? []).map((p) => ({
    key: p.key,
    name: p.name,
    description: p.description ?? "",
    isDefault: p.is_default ?? false,
  }));
}
