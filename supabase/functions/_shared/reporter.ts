// Reporter identity sent by the SDKs (see 0014_closed_loop.sql). `reporter_id`
// is a random per-install id — treat anything that doesn't look like one as
// absent rather than rejecting the whole report.

const REPORTER_ID = /^[A-Za-z0-9_-]{16,128}$/;

export function sanitizeReporterId(raw: unknown): string | null {
  return typeof raw === "string" && REPORTER_ID.test(raw) ? raw : null;
}

export interface ReporterInfo {
  id?: string;
  email?: string;
  name?: string;
}

/** `FeedbackKit.setUser(...)` — host-app-supplied, optional, camelCase JSONB. */
export function sanitizeReporter(raw: unknown): ReporterInfo | null {
  if (!raw || typeof raw !== "object") return null;
  const source = raw as Record<string, unknown>;
  const out: ReporterInfo = {};
  for (const key of ["id", "email", "name"] as const) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) out[key] = value.trim().slice(0, 200);
  }
  return Object.keys(out).length > 0 ? out : null;
}
