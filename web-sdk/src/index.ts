import { canvasToPngBlob, captureViewport } from "./capture";
import { installLogCapture, setIgnoredUrlPrefix, type LogBuffer, type LogCaptureOptions } from "./logs";
import { DEFAULT_ENDPOINT, fetchProducts, submitReport } from "./submit";
import type {
  CaptureOptions,
  FeedbackKitConfiguration,
  FeedbackProduct,
  FeedbackReport,
  FeedbackTheme,
} from "./types";
import { Widget, type TriggerOptions } from "./ui/widget";

export type * from "./types";
export type { TriggerOptions } from "./ui/widget";
export type { LogCaptureOptions } from "./logs";
export { FeedbackSubmissionError, DEFAULT_ENDPOINT, encodePayload, type IngestPayload } from "./submit";
export { parseUserAgent, redactUrl } from "./environment";
export {
  drawAnnotation,
  drawAnnotations,
  hitTest,
  readPoint,
  textBubbleRect,
  STROKE_WIDTH,
  type Point,
  type Size,
} from "./renderer";

export interface PresentOptions {
  /** Called with the finished report when the user taps Send. */
  onReport?: (report: FeedbackReport) => void | Promise<void>;
}

export interface PresentAndSubmitOptions {
  /** Called after the report has been accepted by the ingestion endpoint. */
  onSubmitted?: (report: FeedbackReport) => void;
  /** Called when a submit attempt fails (the dialog stays open for a retry). */
  onError?: (error: unknown) => void;
}

export interface ShortcutOptions {
  /** Key to combine with ⌘ (macOS) / Ctrl (elsewhere) + Shift. Default "F" — e.g. ⌘⇧F. */
  key?: string;
}

let configuration: FeedbackKitConfiguration | null = null;
let products: FeedbackProduct[] = [];
let productsPromise: Promise<FeedbackProduct[]> | null = null;
let logCapture: { buffer: LogBuffer; uninstall: () => void } | null = null;
let shortcutHandler: ((e: KeyboardEvent) => void) | null = null;

const widget = new Widget({
  configuration: () => configuration,
  theme: () => FeedbackKit.theme,
  products: () => resolveProducts(),
  defaultProductKey: () => configuration?.defaultProductKey,
  logs: () => logCapture?.buffer.snapshot() ?? [],
  captureOptions: () => FeedbackKit.captureOptions,
  currentScreen: () => FeedbackKit.currentScreen,
});

function resolveProducts(): Promise<FeedbackProduct[]> {
  if (products.length > 0 || !configuration) return Promise.resolve(products);
  if (!productsPromise) {
    const config = configuration;
    productsPromise = fetchProducts(config)
      .then((fetched) => {
        if (configuration === config) products = fetched;
        return fetched;
      })
      .catch(() => {
        productsPromise = null; // Retry next time the dialog opens.
        return [];
      });
  }
  return productsPromise;
}

function whenBodyReady(fn: () => void): void {
  if (document.body) fn();
  else document.addEventListener("DOMContentLoaded", fn, { once: true });
}

/**
 * FeedbackKit for the web — the browser counterpart of the Swift SDK's
 * `FeedbackKit` namespace. Same flow (capture → annotate → describe → a
 * structured `FeedbackReport`), same report shape, same optional delivery
 * to the hosted dashboard.
 */
export const FeedbackKit = {
  /**
   * The current screen/page name included in reports. Falls back to
   * `location.pathname` when unset. Set it from your router for nicer names.
   */
  currentScreen: null as string | null,

  /** Brand colors for the trigger button and dialog. */
  theme: null as FeedbackTheme | null,

  /** Screenshot capture settings. See `CaptureOptions`. */
  captureOptions: {} as CaptureOptions,

  /** The hosted dashboard's ingestion endpoint, used when `configure` gets no `endpoint`. */
  DEFAULT_ENDPOINT,

  /**
   * Configures delivery to the FeedbackKit dashboard (or your own deployment
   * of it). Pass `null` to go back to local-only delivery via `present`.
   * Also starts console/network log capture unless `captureLogs: false`.
   */
  configure(config: FeedbackKitConfiguration | null): void {
    configuration = config ? { ...config, endpoint: config.endpoint ?? DEFAULT_ENDPOINT } : null;
    products = config?.products ?? [];
    productsPromise = null;
    setIgnoredUrlPrefix(configuration?.endpoint ?? null);
    if (configuration && products.length === 0) void resolveProducts();
    if (config && config.captureLogs !== false && !logCapture) {
      FeedbackKit.enableLogCapture(typeof config.captureLogs === "object" ? config.captureLogs : {});
    }
  },

  get isConfigured(): boolean {
    return configuration !== null;
  },

  get configuration(): Readonly<FeedbackKitConfiguration> | null {
    return configuration;
  },

  /** Products for the composer's chips — static from `configure`, else fetched from the backend. */
  fetchProducts(): Promise<FeedbackProduct[]> {
    return resolveProducts();
  },

  /**
   * Opens the feedback dialog and resolves with the finished report — or
   * `null` if the user cancels. Nothing is sent anywhere; delivery is yours.
   */
  present(options: PresentOptions = {}): Promise<FeedbackReport | null> {
    return widget.open({ submit: false, onReport: options.onReport });
  },

  /**
   * Opens the dialog and, on Send, delivers the report to the configured
   * endpoint (showing progress, errors with retry, and a thank-you state).
   * Resolves with the submitted report, or `null` if cancelled.
   */
  presentAndSubmit(options: PresentAndSubmitOptions = {}): Promise<FeedbackReport | null> {
    if (!configuration) {
      return Promise.reject(new Error("FeedbackKit.configure({ projectKey }) must be called before presentAndSubmit()."));
    }
    return widget.open({ submit: true, onReport: options.onSubmitted, onError: options.onError });
  },

  /** Sends an already-built report (e.g. one from `present`) to the configured endpoint. */
  submit(report: FeedbackReport): Promise<void> {
    if (!configuration) {
      return Promise.reject(new Error("FeedbackKit.configure({ projectKey }) must be called before submit()."));
    }
    return submitReport(report, configuration);
  },

  get isPresenting(): boolean {
    return widget.isOpen;
  },

  /**
   * A floating "Feedback" button. Clicking it runs `presentAndSubmit` when
   * configured, otherwise `present` and logs the report to the console.
   */
  showFloatingTriggerButton(options: TriggerOptions = {}): void {
    whenBodyReady(() =>
      widget.showTrigger(options, () => {
        if (configuration) void FeedbackKit.presentAndSubmit();
        else void FeedbackKit.present({ onReport: (r) => console.info("[FeedbackKit] report", r) });
      }),
    );
  },

  hideFloatingTriggerButton(): void {
    widget.hideTrigger();
  },

  /**
   * The web's stand-in for the native SDKs' shake-to-report: a keyboard
   * shortcut, ⌘⇧F on macOS / Ctrl+Shift+F elsewhere by default.
   */
  enableKeyboardShortcut(options: ShortcutOptions = {}): void {
    FeedbackKit.disableKeyboardShortcut();
    const key = (options.key ?? "F").toLowerCase();
    shortcutHandler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || !e.shiftKey || e.altKey || e.key.toLowerCase() !== key) return;
      e.preventDefault();
      if (configuration) void FeedbackKit.presentAndSubmit();
      else void FeedbackKit.present({ onReport: (r) => console.info("[FeedbackKit] report", r) });
    };
    window.addEventListener("keydown", shortcutHandler);
  },

  disableKeyboardShortcut(): void {
    if (shortcutHandler) window.removeEventListener("keydown", shortcutHandler);
    shortcutHandler = null;
  },

  /**
   * Starts recording recent console warnings/errors, uncaught exceptions,
   * and failed network requests, attached to each report (users can opt out
   * per report). Call as early as possible so errors before the first
   * report are caught. `false` turns it off.
   */
  enableLogCapture(options: LogCaptureOptions | false = {}): void {
    logCapture?.uninstall();
    logCapture = options === false ? null : installLogCapture(options);
  },

  /** Captures the current viewport as a PNG, without opening any UI. */
  async captureScreenshot(options: CaptureOptions = {}): Promise<Blob> {
    const shot = await captureViewport({ ...FeedbackKit.captureOptions, ...options, exclude: widget.isOwnNode });
    return canvasToPngBlob(shot.canvas);
  },

  /** Removes every trace of the SDK from the page (trigger, dialog host, listeners, log hooks). */
  destroy(): void {
    FeedbackKit.disableKeyboardShortcut();
    logCapture?.uninstall();
    logCapture = null;
    widget.destroy();
  },
};

export default FeedbackKit;
