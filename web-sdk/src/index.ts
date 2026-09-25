import { canvasToPngBlob, captureViewport } from "./capture";
import { installLogCapture, setIgnoredUrlPrefix, type LogBuffer, type LogCaptureOptions } from "./logs";
import { DEFAULT_ENDPOINT, fetchProducts, submitReport } from "./submit";
import { fetchFixUpdates, getUser, reporterId, sendFixAction, setUser, type FixAction } from "./fixes";
import type {
  CaptureOptions,
  FeedbackKitConfiguration,
  FeedbackProduct,
  FeedbackReport,
  FeedbackTheme,
  FeedbackUser,
  FixUpdate,
} from "./types";
import { Widget, type TriggerOptions } from "./ui/widget";

export type * from "./types";
export type { TriggerOptions } from "./ui/widget";
export type { LogCaptureOptions } from "./logs";
export { FeedbackSubmissionError, DEFAULT_ENDPOINT, encodePayload, type IngestPayload } from "./submit";
export { parseUserAgent, redactUrl } from "./environment";
export { compareBuilds, reporterUpdatesEndpoint, type FixAction } from "./fixes";
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
  identity: () => ({ reporterId: reporterId(), user: getUser() }),
});

// ---- "Is it fixed?" loop (see fixes.ts) --------------------------------

/** Don't hit the network more than this often from page-visibility checks. */
const FIX_CHECK_INTERVAL_MS = 60_000;
let fixVerificationEnabled = false;
let lastFixCheck = 0;
let fixCheckInFlight = false;
const handledThisPage = new Set<string>();

function onVisibilityChange(): void {
  if (document.visibilityState === "visible") void checkAndShowFix(false);
}

async function checkAndShowFix(force: boolean): Promise<void> {
  const config = configuration;
  if (!fixVerificationEnabled || !config || fixCheckInFlight || widget.isOpen || widget.isShowingFixCard) return;
  if (!force && Date.now() - lastFixCheck < FIX_CHECK_INTERVAL_MS) return;
  fixCheckInFlight = true;
  lastFixCheck = Date.now();
  let next: FixUpdate | undefined;
  try {
    next = (await fetchFixUpdates(config)).find((u) => !handledThisPage.has(u.feedbackId));
  } catch {
    return;
  } finally {
    fixCheckInFlight = false;
  }
  if (!next || !fixVerificationEnabled) return;
  // Resolve once the card is up; the reporter answers in their own time.
  void handleFixCard(config, next);
}

async function handleFixCard(config: FeedbackKitConfiguration, update: FixUpdate): Promise<void> {
  const outcome = await widget.showFixCard(update);
  handledThisPage.add(update.feedbackId);
  const send = (action: FixAction) =>
    sendFixAction(config, update.feedbackId, action).catch((error: unknown) =>
      console.warn("[FeedbackKit] Couldn't send fix verification.", error),
    );
  switch (outcome.type) {
    case "verified":
      await send({ type: "verify" });
      void checkAndShowFix(true);
      break;
    case "replied":
      await send({ type: "reply", text: outcome.text });
      void checkAndShowFix(true);
      break;
    case "stillBroken": {
      // Same capture → annotate flow, delivered as a reopen of the original
      // report so the fix's author sees exactly what's still wrong.
      const report = await widget.open({
        submit: false,
        deliver: (r) => sendFixAction(config, update.feedbackId, { type: "reopen", report: r }),
        copy: {
          title: "Still broken",
          label: "What's still wrong?",
          placeholder: "Show us on the screenshot and describe what you still see…",
          thanksTitle: "Thanks — we're on it",
          thanksBody: "Your report was reopened and sent back to the team.",
        },
      });
      // Closed the dialog without sending: they still said it's broken.
      if (!report) await send({ type: "reopen" });
      break;
    }
    case "later":
      break;
  }
}

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
    return submitReport(report, configuration, { reporterId: reporterId(), user: getUser() });
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

  /**
   * Optional identity of the person using your site, attached to every
   * report they submit. Not needed for fix verification (that uses an
   * anonymous per-browser id, `reporterId`). Pass `null` on sign-out.
   */
  setUser(user: FeedbackUser | null): void {
    setUser(user);
  },

  /** The anonymous per-browser id attached to reports — how a fix finds its way back here. */
  get reporterId(): string {
    return reporterId();
  },

  /**
   * This browser's reports that need the reporter's attention: shipped
   * fixes to confirm and developer/agent questions. For a custom UI — the
   * built-in one is `enableFixVerification`.
   */
  checkForFixUpdates(): Promise<FixUpdate[]> {
    if (!configuration) {
      return Promise.reject(new Error("FeedbackKit.configure({ projectKey }) must be called before checkForFixUpdates()."));
    }
    return fetchFixUpdates(configuration);
  },

  /** Answers one update directly (custom UIs): verify, reopen, or reply. */
  respondToFixUpdate(feedbackId: string, action: FixAction): Promise<void> {
    if (!configuration) {
      return Promise.reject(new Error("FeedbackKit.configure({ projectKey }) must be called before respondToFixUpdate()."));
    }
    return sendFixAction(configuration, feedbackId, action);
  },

  /**
   * Closes the loop with the person who reported a bug: once a fix for one
   * of their reports ships (announced with `feedbackkit release`), a small
   * card shows their original screenshot and asks "is it fixed?". "Still
   * broken" reopens the capture dialog so they can show what's wrong now,
   * and the report goes straight back to the developer. Also surfaces
   * questions the developer or their coding agent asked.
   *
   * Checks now and whenever the tab becomes visible (at most once a minute).
   * With `appBuild` configured, only fixes shipped in that build or earlier
   * are shown; without it, a fix counts as live as soon as it's released.
   */
  enableFixVerification(): void {
    if (fixVerificationEnabled) return;
    fixVerificationEnabled = true;
    document.addEventListener("visibilitychange", onVisibilityChange);
    whenBodyReady(() => void checkAndShowFix(true));
  },

  disableFixVerification(): void {
    fixVerificationEnabled = false;
    document.removeEventListener("visibilitychange", onVisibilityChange);
    widget.hideFixCard();
  },

  /**
   * Checks right now (ignoring the throttle) and shows the card if there's
   * something. Resolves once the check is done and any card is on screen.
   */
  presentFixUpdatesIfNeeded(): Promise<void> {
    return checkAndShowFix(true);
  },

  /** Removes every trace of the SDK from the page (trigger, dialog host, listeners, log hooks). */
  destroy(): void {
    FeedbackKit.disableFixVerification();
    FeedbackKit.disableKeyboardShortcut();
    logCapture?.uninstall();
    logCapture = null;
    widget.destroy();
  },
};

export default FeedbackKit;
