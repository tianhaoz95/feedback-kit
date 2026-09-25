// Public ingestion endpoint the FeedbackKit SDKs POST to — the Swift SDK
// (iOS/macOS/watchOS) and the web SDK (web-sdk/, npm `feedbackkit-web`).
//
// Auth model: there's no user auth here at all — the request is identified
// purely by `project_key`, which is safe to embed in a shipped app binary (it
// only ever lets someone *create* feedback or list configured products for a project,
// never read feedback or other projects). This function uses the service-role key,
// bypassing dashboard RLS policies by design.
//
// Wire format is documented in Sources/FeedbackKit/Networking/FeedbackSubmitter.swift
// (the `IngestPayload` type) and web-sdk/src/submit.ts — keep all three in sync.
//
// Abuse controls (see supabase/migrations/0013_web_sdk.sql): an optional
// per-project `allowed_origins` list checked against the browser's `Origin`
// header, and a per-project submissions-per-minute cap. Both fail open if
// the columns they read don't exist yet, so a function deploy that lands
// before its migration can never take ingestion down.
import { createClient } from "jsr:@supabase/supabase-js@2";

interface IngestProduct {
  key: string;
  name?: string;
  description?: string;
  is_default?: boolean;
}

interface IngestPayload {
  project_key: string;
  id: string;
  created_at: string;
  text: string;
  screenshot_raw_png_base64?: string;
  screenshot_annotated_png_base64?: string;
  annotations: unknown;
  environment: Record<string, unknown>;
  attachment_filename?: string;
  attachment_mime_type?: string;
  attachment_data_base64?: string;
  product_keys?: string[];
  products?: IngestProduct[];
  /** Web SDK only: recent console/network log entries. */
  logs?: unknown;
}

interface IngestLogEntry {
  level: string;
  message: string;
  timestamp: string;
}

const MAX_LOG_ENTRIES = 100;
const MAX_LOG_MESSAGE_LENGTH = 2000;
const RATE_LIMIT_PER_MINUTE = Number(Deno.env.get("INGEST_RATE_LIMIT_PER_MINUTE") ?? "30");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-project-key",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // GET /ingest-feedback?project_key=pk_... returns products for the given project
  if (req.method === "GET") {
    const url = new URL(req.url);
    const projectKey = url.searchParams.get("project_key") || req.headers.get("x-project-key");

    if (!projectKey) {
      return json({ error: "missing project_key parameter" }, 400);
    }

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id")
      .eq("project_key", projectKey)
      .single();

    if (projectError || !project) {
      return json({ error: "unknown project_key" }, 401);
    }

    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, key, name, description, is_default, created_at")
      .eq("project_id", project.id)
      .order("created_at", { ascending: true });

    if (productsError) {
      return json({ error: "failed to fetch products", detail: productsError.message }, 500);
    }

    return json({ products: products ?? [] }, 200);
  }

  if (req.method !== "POST") {
    return json({ error: "method not allowed" }, 405);
  }

  let payload: IngestPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }

  if (!payload.project_key || !payload.id || payload.text === undefined) {
    return json({ error: "missing required fields" }, 400);
  }

  // `*` rather than naming `allowed_origins`, so this query still works
  // against a database where 0013_web_sdk.sql hasn't been applied yet.
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("project_key", payload.project_key)
    .single();

  if (projectError || !project) {
    return json({ error: "unknown project_key" }, 401);
  }

  const origin = req.headers.get("origin");
  if (!isOriginAllowed(origin, project.allowed_origins)) {
    return json({ error: "origin_not_allowed", origin }, 403);
  }

  if (RATE_LIMIT_PER_MINUTE > 0) {
    const since = new Date(Date.now() - 60_000).toISOString();
    const { count, error: countError } = await supabase
      .from("feedback_items")
      .select("id", { count: "exact", head: true })
      .eq("project_id", project.id)
      .gte("received_at", since);
    // countError (e.g. column missing before the migration) → fail open.
    if (!countError && (count ?? 0) >= RATE_LIMIT_PER_MINUTE) {
      return json({ error: "rate_limited" }, 429);
    }
  }

  // Resolve products for this feedback report
  let resolvedProducts: IngestProduct[] = [];
  let resolvedProductKeys: string[] = [];

  if (payload.product_keys && payload.product_keys.length > 0) {
    resolvedProductKeys = Array.from(new Set(payload.product_keys));
    const { data: dbProducts } = await supabase
      .from("products")
      .select("key, name, description, is_default")
      .eq("project_id", project.id)
      .in("key", resolvedProductKeys);

    const dbMap = new Map((dbProducts ?? []).map((p) => [p.key, p]));
    resolvedProducts = resolvedProductKeys.map((key) => {
      const match = dbMap.get(key);
      const passedProduct = payload.products?.find((p) => p.key === key);
      return {
        key,
        name: match?.name ?? passedProduct?.name ?? key,
        description: match?.description ?? passedProduct?.description ?? "",
        is_default: match?.is_default ?? passedProduct?.is_default ?? false,
      };
    });
  } else if (payload.products && payload.products.length > 0) {
    resolvedProducts = payload.products;
    resolvedProductKeys = payload.products.map((p) => p.key);
  }

  // Screenshots are optional — the user can toggle them off before
  // submitting, e.g. for a pure-description report.
  let rawPath: string | null = null;
  let annotatedPath: string | null = null;
  if (payload.screenshot_raw_png_base64 && payload.screenshot_annotated_png_base64) {
    rawPath = `${project.id}/${payload.id}/raw.png`;
    annotatedPath = `${project.id}/${payload.id}/annotated.png`;

    const [rawUpload, annotatedUpload] = await Promise.all([
      supabase.storage
        .from("feedback-screenshots")
        .upload(rawPath, decodeBase64(payload.screenshot_raw_png_base64), {
          contentType: "image/png",
          upsert: true,
        }),
      supabase.storage
        .from("feedback-screenshots")
        .upload(annotatedPath, decodeBase64(payload.screenshot_annotated_png_base64), {
          contentType: "image/png",
          upsert: true,
        }),
    ]);

    if (rawUpload.error || annotatedUpload.error) {
      return json(
        { error: "failed to store screenshots", detail: rawUpload.error ?? annotatedUpload.error },
        500,
      );
    }
  }

  let attachmentPath: string | null = null;
  if (payload.attachment_data_base64 && payload.attachment_filename) {
    attachmentPath = `${project.id}/${payload.id}/attachment/${sanitizeFilename(payload.attachment_filename)}`;
    const { error: attachmentError } = await supabase.storage
      .from("feedback-screenshots")
      .upload(attachmentPath, decodeBase64(payload.attachment_data_base64), {
        contentType: payload.attachment_mime_type || "application/octet-stream",
        upsert: true,
      });
    if (attachmentError) {
      return json({ error: "failed to store attachment", detail: attachmentError }, 500);
    }
  }

  const logs = sanitizeLogs(payload.logs);

  const { error: insertError } = await supabase.from("feedback_items").insert({
    id: payload.id,
    project_id: project.id,
    text: payload.text,
    screenshot_raw_path: rawPath,
    screenshot_annotated_path: annotatedPath,
    annotations: payload.annotations ?? [],
    environment: payload.environment ?? {},
    created_at: payload.created_at ?? new Date().toISOString(),
    attachment_path: attachmentPath,
    attachment_filename: attachmentPath ? payload.attachment_filename : null,
    attachment_mime_type: attachmentPath ? (payload.attachment_mime_type ?? null) : null,
    products: resolvedProducts,
    product_keys: resolvedProductKeys,
    // Only sent when present, so native reports insert exactly as before.
    ...(logs.length > 0 ? { logs } : {}),
  });

  if (insertError) {
    return json({ error: "failed to record feedback", detail: insertError.message }, 500);
  }

  return json({ id: payload.id }, 201);
});

/**
 * `allowed_origins` entries are exact origins (`https://app.example.com`) or
 * a leading-wildcard subdomain pattern (`https://*.example.com`). An empty
 * list allows everything, and a request with no `Origin` header (native
 * apps, server-to-server) is never blocked.
 */
function isOriginAllowed(origin: string | null, allowed: unknown): boolean {
  if (!origin || !Array.isArray(allowed) || allowed.length === 0) return true;
  const normalized = origin.toLowerCase().replace(/\/+$/, "");
  return allowed.some((entry) => {
    if (typeof entry !== "string") return false;
    const rule = entry.trim().toLowerCase().replace(/\/+$/, "");
    if (rule === "*" || rule === normalized) return true;
    const wildcard = rule.match(/^(https?:\/\/)\*\.(.+)$/);
    if (!wildcard) return false;
    const [, scheme, domain] = wildcard;
    return normalized.startsWith(scheme) && normalized.slice(scheme.length).endsWith(`.${domain}`);
  });
}

function sanitizeLogs(raw: unknown): IngestLogEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object")
    .slice(-MAX_LOG_ENTRIES)
    .map((entry) => ({
      level: typeof entry.level === "string" ? entry.level.slice(0, 16) : "log",
      message: String(entry.message ?? "").slice(0, MAX_LOG_MESSAGE_LENGTH),
      timestamp: typeof entry.timestamp === "string" ? entry.timestamp.slice(0, 40) : new Date().toISOString(),
    }));
}

// Keeps the original filename (for nicer downloads) while stripping
// anything that could be read as a path separator or otherwise escape the
// `{project_id}/{feedback_id}/attachment/` prefix it's uploaded under.
function sanitizeFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() || "attachment";
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-200);
}

function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
