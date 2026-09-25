import type { LogCaptureOptions } from "./logs";

/**
 * Public data model. Mirrors the Swift SDK's `FeedbackReport` family
 * (Sources/FeedbackKit/Model/FeedbackReport.swift) so a report captured on
 * the web is interchangeable with one captured on iOS/macOS/watchOS.
 *
 * Like the Swift SDK, the public API is camelCase and the wire format
 * (see `submit.ts`) is snake_case at the top level — except `environment`,
 * `annotations`, and `logs`, which are stored as opaque JSONB and read
 * directly by the dashboard, the Developer Portal, and the CLI, so their
 * property names are part of the cross-platform contract and must stay in
 * sync with `web/src/lib/types.ts` and the Swift model by hand.
 */

/**
 * A point normalized to 0...1 relative to the screenshot's width/height.
 * Encoded as a `[x, y]` tuple because that's exactly how Swift's `CGPoint`
 * encodes through `Codable` — the Developer Portal decodes web reports with
 * the Swift SDK's own `FeedbackAnnotation`, so any other shape would fail.
 */
export type NormalizedPoint = [x: number, y: number];

export type AnnotationKind = "rectangle" | "arrow" | "freehand" | "text";

export interface FeedbackAnnotation {
  kind: AnnotationKind;
  /** Freehand: every point on the stroke. Rectangle/arrow: exactly two (start, end). Text: one (top-left). */
  points: NormalizedPoint[];
  colorHex: string;
  /** Only set for `text` annotations. */
  label?: string;
  /** Uniform scale around the shape's center (rectangle/arrow) or font size (text). */
  scale: number;
  /** Rotation in radians around the shape's center (rectangle/arrow only). */
  rotation: number;
}

/**
 * Device/app/page context. Every field the Swift `FeedbackEnvironment` has
 * is required here too (the Developer Portal can't decode a report missing
 * any of them); the trailing web-only fields are optional additions that
 * Swift's `Codable` simply ignores.
 */
export interface FeedbackEnvironment {
  /** The real OS the browser runs on, e.g. "macOS", "Windows", "iOS", "Android". */
  osName: string;
  osVersion: string;
  /** Browser name and major version, e.g. "Chrome 141". */
  deviceModel: string;
  appVersion: string;
  appBuild: string;
  /** The page's host, e.g. "app.example.com". */
  bundleIdentifier: string;
  /** Developer-set `FeedbackKit.currentScreen`, else `location.pathname`. */
  screenName: string | null;
  locale: string;
  /** Viewport size in CSS pixels. */
  screenWidthPoints: number;
  screenHeightPoints: number;
  /** `devicePixelRatio`. */
  screenScale: number;
  /** Always `"web"` for reports from this SDK. Native SDKs leave it unset. */
  platform?: "web";
  /** Full page URL at capture time, with the query string's sensitive values redacted. */
  pageUrl?: string;
  userAgent?: string;
  /** Browser name alone, e.g. "Chrome". */
  browserName?: string;
  /** Full browser version, e.g. "141.0.7390.54". */
  browserVersion?: string;
}

export type LogLevel = "log" | "info" | "warn" | "error" | "debug" | "network";

/** One console message, uncaught error, or failed network request from before the report was made. */
export interface FeedbackLogEntry {
  level: LogLevel;
  message: string;
  /** ISO-8601 timestamp. */
  timestamp: string;
}

export interface FeedbackAttachment {
  filename: string;
  mimeType: string;
  data: Blob;
}

export interface FeedbackProduct {
  key: string;
  name: string;
  description?: string;
  isDefault?: boolean;
}

/**
 * The complete report handed back to the developer on submit. FeedbackKit's
 * job ends at producing this value — what happens to it (logging it,
 * POSTing it to your own backend, or `FeedbackKit.submit` to the hosted
 * dashboard) is up to you.
 */
export interface FeedbackReport {
  id: string;
  createdAt: Date;
  text: string;
  /** Raw viewport capture. Null if the user turned the screenshot off. */
  screenshotRaw: Blob | null;
  /** Same capture with annotations flattened in. Null under the same conditions. */
  screenshotAnnotated: Blob | null;
  /** Empty when there's no screenshot. */
  annotations: FeedbackAnnotation[];
  environment: FeedbackEnvironment;
  attachment: FeedbackAttachment | null;
  products: FeedbackProduct[];
  /** Recent console output / errors / failed requests (web only). Empty if log capture is off. */
  logs: FeedbackLogEntry[];
}

/** Brand colors for the widget, as hex strings (`#RRGGBB`). Mirrors Swift's `FeedbackTheme`. */
export interface FeedbackTheme {
  /** Send button, selected tool, screenshot toggle, trigger button. */
  primaryColorHex?: string;
  /** Cancel and attach buttons. */
  secondaryColorHex?: string;
}

export type CaptureMode = "dom" | "display";

export interface FeedbackKitConfiguration {
  /** The project key from the dashboard's project settings. A routing key, not a secret. */
  projectKey: string;
  /**
   * The ingestion endpoint, e.g. `https://<ref>.supabase.co/functions/v1/ingest-feedback`.
   * Defaults to the hosted FeedbackKit dashboard.
   */
  endpoint?: string;
  /** Static product list. When empty, products are fetched from the backend using `projectKey`. */
  products?: FeedbackProduct[];
  /** Product preselected in the composer (e.g. "web"). */
  defaultProductKey?: string;
  /** Your app's version/build, since a browser can't know them. */
  appVersion?: string;
  appBuild?: string;
  /**
   * Record recent console warnings/errors, uncaught exceptions, and failed
   * network requests to attach to reports (the user can untick them per
   * report). Default `true`; pass options to tune, or `false` to disable.
   */
  captureLogs?: boolean | LogCaptureOptions;
  /**
   * Where fix updates for this browser's reports come from (the
   * `reporter-updates` function). Defaults to the sibling of `endpoint`.
   */
  reporterUpdatesEndpoint?: string;
}

/** Optional identity of the person using your site, attached to their reports. Mirrors Swift's `FeedbackUser`. */
export interface FeedbackUser {
  id?: string;
  email?: string;
  name?: string;
}

/**
 * Something that happened to a report this browser filed: a fix that
 * shipped ("is it fixed?") and/or a question from the developer or their
 * coding agent. Mirrors Swift's `FixUpdate`.
 */
export interface FixUpdate {
  feedbackId: string;
  /** What the reporter originally wrote. */
  text: string;
  createdAt: string;
  screenName: string | null;
  fixStage: string | null;
  fixedInBuild: string | null;
  /** One plain-language line on what was fixed, if the developer/agent wrote one. */
  fixSummary: string | null;
  /** A fix shipped (in a build this page is at least, when `appBuild` is configured) and hasn't been confirmed. */
  needsVerification: boolean;
  openQuestion: { id: string; body: string; createdAt: string } | null;
  /** Short-lived signed URL of the original annotated screenshot. */
  screenshotUrl: string | null;
  messages: { id: string; kind: string; body: string; author: string; createdAt: string }[];
}

export interface CaptureOptions {
  /**
   * `"dom"` (default): re-render the page into an image — silent, no
   * permission prompt. `"display"`: the browser's Screen Capture API —
   * pixel-exact but shows a picker every time; falls back to `"dom"` where
   * unsupported or declined.
   */
  mode?: CaptureMode;
  /** Upper bound on the capture's pixel ratio, to keep uploads small on dense displays. Default 2. */
  maxPixelRatio?: number;
}
