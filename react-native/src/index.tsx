import NativeFeedbackKit from './NativeFeedbackKit';
import type {
  FeedbackKitConfiguration,
  FeedbackReport,
  FeedbackSubmissionResult,
  FeedbackTheme,
  FeedbackUser,
} from './types';

export * from './types';

/**
 * In-app feedback for React Native. A thin bridge over the native FeedbackKit
 * SDKs: capture, the annotation editor and the transport are the iOS (Swift)
 * and Android (Kotlin) SDKs, so reports match native ones exactly.
 *
 * ```ts
 * FeedbackKit.configure({ endpointUrl, projectKey: 'pk_live_...' }); // optional
 * FeedbackKit.showFloatingTriggerButton();
 * FeedbackKit.enableShakeToReport();
 * const report = await FeedbackKit.present();
 * ```
 */
export const FeedbackKit = {
  /** Configures hosted-dashboard submission; null returns to local-only delivery. */
  configure(configuration: FeedbackKitConfiguration | null): void {
    NativeFeedbackKit.configure(configuration as unknown as Object | null);
  },

  get isConfigured(): boolean {
    return NativeFeedbackKit.isConfigured();
  },

  /** Labels reports with the screen the user is on — call it as they navigate. */
  setCurrentScreen(name: string | null): void {
    NativeFeedbackKit.setCurrentScreen(name);
  },

  /** Brands the native feedback screen; null restores the default blue. */
  setTheme(theme: FeedbackTheme | null): void {
    NativeFeedbackKit.setTheme(theme as unknown as Object | null);
  },

  /** Attaches the person using the app to every report they submit. */
  setUser(user: FeedbackUser | null): void {
    NativeFeedbackKit.setUser(user as unknown as Object | null);
  },

  setDefaultProductKey(key: string | null): void {
    NativeFeedbackKit.setDefaultProductKey(key);
  },

  /** The anonymous per-install id fix updates are matched by. */
  get reporterId(): string {
    return NativeFeedbackKit.getReporterId();
  },

  /** Captures the screen and presents the native flow. Null if the user cancelled. */
  async present(): Promise<FeedbackReport | null> {
    return (await NativeFeedbackKit.present()) as FeedbackReport | null;
  },

  /** Presents the flow and submits to the hosted dashboard. Null if cancelled. */
  async presentAndSubmit(): Promise<FeedbackSubmissionResult | null> {
    return (await NativeFeedbackKit.presentAndSubmit()) as FeedbackSubmissionResult | null;
  },

  /** Submits if configured; otherwise resolves with the local report as a success. */
  async presentAndSubmitIfConfigured(): Promise<FeedbackSubmissionResult | null> {
    return (await NativeFeedbackKit.presentAndSubmitIfConfigured()) as FeedbackSubmissionResult | null;
  },

  /** The native floating, draggable "report feedback" button. */
  showFloatingTriggerButton(): void {
    NativeFeedbackKit.showFloatingTriggerButton();
  },
  hideFloatingTriggerButton(): void {
    NativeFeedbackKit.hideFloatingTriggerButton();
  },

  /** Shaking the device opens the flow (and submits, if configured). */
  enableShakeToReport(): void {
    NativeFeedbackKit.enableShakeToReport();
  },
  disableShakeToReport(): void {
    NativeFeedbackKit.disableShakeToReport();
  },

  /** Asks "is it fixed?" once a fix for this device's report ships. Requires `configure`. */
  enableFixVerification(): void {
    NativeFeedbackKit.enableFixVerification();
  },
  disableFixVerification(): void {
    NativeFeedbackKit.disableFixVerification();
  },
  presentFixUpdatesIfNeeded(): void {
    NativeFeedbackKit.presentFixUpdatesIfNeeded();
  },

  /**
   * Called whenever a submission to the dashboard finishes, including ones
   * started natively by the floating button or a shake. Returns an unsubscribe.
   */
  onSubmissionResult(listener: (result: FeedbackSubmissionResult) => void): () => void {
    const subscription = NativeFeedbackKit.onSubmissionResult((value) =>
      listener(value as unknown as FeedbackSubmissionResult)
    );
    return () => subscription.remove();
  },
};

export default FeedbackKit;
