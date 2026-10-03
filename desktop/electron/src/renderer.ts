import { FeedbackKit, type FeedbackKitConfiguration } from "feedbackkit-web";
import { BRIDGE_KEY, type FeedbackKitElectronBridge } from "./shared";

export { FeedbackKit } from "feedbackkit-web";
export type * from "feedbackkit-web";

export interface ElectronConfigureOptions {
  /**
   * What the menu item / global shortcut does. Default: `presentAndSubmit()`
   * when a project key is configured, else `present()`.
   */
  onPresent?: () => void;
  /** Use Electron's native page capture (default `true`); `false` keeps the web SDK's DOM capture. */
  nativeCapture?: boolean;
}

let unsubscribe: (() => void) | null = null;

function bridge(): FeedbackKitElectronBridge | undefined {
  return (globalThis as unknown as Record<string, FeedbackKitElectronBridge | undefined>)[BRIDGE_KEY];
}

/** Whether FeedbackKit's preload is present (i.e. `setupFeedbackKit()` ran in the main process). */
export function isElectron(): boolean {
  return bridge() !== undefined;
}

/**
 * `FeedbackKit.configure` for an Electron renderer: adds the real OS, device
 * and app details from the main process (`environment.runtime: "electron"`),
 * switches screenshots to Electron's native `capturePage`, and listens for
 * the menu item / global shortcut. Falls back to plain web behavior when the
 * main process didn't call `setupFeedbackKit()`.
 */
export async function configure(
  configuration: FeedbackKitConfiguration | null,
  options: ElectronConfigureOptions = {},
): Promise<void> {
  const electron = bridge();
  if (!electron) {
    console.warn("[FeedbackKit] feedbackkit-electron's preload isn't loaded — call setupFeedbackKit() in the main process. Using plain web behavior.");
    if (configuration) FeedbackKit.configure(configuration);
    return;
  }

  // Applies to local-only reports too (no project key); the configuration's own `environment` still wins.
  FeedbackKit.environment = await electron.environment();
  if (configuration) FeedbackKit.configure(configuration);
  if (options.nativeCapture !== false) {
    FeedbackKit.captureOptions = { ...FeedbackKit.captureOptions, provider: () => electron.capture() };
  }

  unsubscribe?.();
  unsubscribe = electron.onPresent(
    options.onPresent ??
      (() => {
        void (configuration ? FeedbackKit.presentAndSubmit() : FeedbackKit.present());
      }),
  );
}
