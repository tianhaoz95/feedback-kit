/** IPC channels between the main process, the preload and the renderer. */
export const CHANNELS = {
  environment: "feedbackkit:environment",
  capture: "feedbackkit:capture",
  present: "feedbackkit:present",
} as const;

/** Where the preload exposes the bridge in the renderer (`window[BRIDGE_KEY]`). */
export const BRIDGE_KEY = "feedbackkitElectron";

/** What the main process knows that the renderer can't. Mirrors `EnvironmentOverrides` in feedbackkit-web. */
export interface DesktopEnvironment {
  osName: string;
  osVersion: string;
  deviceModel: string;
  appVersion: string;
  appBuild: string;
  bundleIdentifier: string;
  runtime: "electron";
  runtimeVersion: string;
}

/** The preload's bridge (contextBridge), as the renderer sees it. */
export interface FeedbackKitElectronBridge {
  environment(): Promise<DesktopEnvironment>;
  /** PNG data URL of the calling window's page, from `webContents.capturePage()`. */
  capture(): Promise<string | null>;
  /** Subscribes to "report a problem" from the menu item / global shortcut. Returns an unsubscribe. */
  onPresent(listener: () => void): () => void;
}
