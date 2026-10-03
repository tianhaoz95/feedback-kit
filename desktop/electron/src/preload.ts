/**
 * Registered automatically by `setupFeedbackKit()` (session preload scripts),
 * alongside the app's own preload. Requires only `electron`, so it runs in
 * sandboxed renderers — the default — without bundling.
 */
import { contextBridge, ipcRenderer } from "electron";
// Type-only: a sandboxed preload can't require anything but "electron", so
// the channel names are repeated here (keep them equal to shared.ts).
import type { FeedbackKitElectronBridge } from "./shared";

const BRIDGE_KEY = "feedbackkitElectron";
const CHANNELS = {
  environment: "feedbackkit:environment",
  capture: "feedbackkit:capture",
  present: "feedbackkit:present",
} as const;

const bridge: FeedbackKitElectronBridge = {
  environment: () => ipcRenderer.invoke(CHANNELS.environment),
  capture: () => ipcRenderer.invoke(CHANNELS.capture),
  onPresent(listener) {
    const handler = () => listener();
    ipcRenderer.on(CHANNELS.present, handler);
    return () => {
      ipcRenderer.removeListener(CHANNELS.present, handler);
    };
  },
};

try {
  contextBridge.exposeInMainWorld(BRIDGE_KEY, bridge);
} catch {
  // contextIsolation off: expose directly.
  (globalThis as Record<string, unknown>)[BRIDGE_KEY] = bridge;
}
