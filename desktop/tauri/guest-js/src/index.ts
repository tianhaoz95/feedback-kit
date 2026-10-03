import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { FeedbackKit, type EnvironmentOverrides, type FeedbackKitConfiguration } from "feedbackkit-web";

export { FeedbackKit } from "feedbackkit-web";
export type * from "feedbackkit-web";

/** The event the Rust plugin emits from its menu item / `present()` (`PRESENT_EVENT` in lib.rs). */
export const PRESENT_EVENT = "feedbackkit://present";

export interface TauriConfigureOptions {
  /**
   * What the menu item (or `tauri_plugin_feedbackkit::present` from a tray
   * or global shortcut) does. Default: `presentAndSubmit()` when a project
   * key is configured, else `present()`.
   */
  onPresent?: () => void;
  /**
   * The build number reports carry, when it isn't the app's version — fix
   * verification compares it to `feedbackkit release --build <same value>`.
   */
  appBuild?: string;
}

let unlisten: UnlistenFn | null = null;

/** The OS, device and app details from the Rust plugin (`environment.runtime: "tauri"`). */
export function environment(): Promise<EnvironmentOverrides> {
  return invoke<EnvironmentOverrides>("plugin:feedbackkit|environment");
}

/**
 * `FeedbackKit.configure` for a Tauri app: adds the real OS version, machine
 * model and app identifier/version from `tauri-plugin-feedbackkit`, and opens
 * the flow when its menu item is clicked. Pass `null` for local-only use
 * (`FeedbackKit.present()`), which still gets the details. Outside Tauri
 * (e.g. the frontend in a plain browser during development) it behaves like
 * the web SDK.
 */
export async function configure(
  configuration: FeedbackKitConfiguration | null,
  options: TauriConfigureOptions = {},
): Promise<void> {
  // Configure first, synchronously, so a report opened while the details
  // are still loading works (it just lacks them) instead of failing.
  if (configuration) FeedbackKit.configure(configuration);
  if (isTauri()) {
    try {
      const details = await environment();
      FeedbackKit.environment = { ...details, ...(options.appBuild ? { appBuild: options.appBuild } : {}) };
    } catch (error) {
      console.warn(
        '[FeedbackKit] tauri-plugin-feedbackkit isn\'t available — register it with .plugin(tauri_plugin_feedbackkit::init()) and add "feedbackkit:default" to your capability.',
        error,
      );
    }
  }

  if (!isTauri()) return;
  unlisten?.();
  unlisten = await listen(PRESENT_EVENT, () => {
    if (options.onPresent) options.onPresent();
    else void (configuration ? FeedbackKit.presentAndSubmit() : FeedbackKit.present());
  });
}
