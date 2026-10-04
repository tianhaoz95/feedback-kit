import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  session,
  type MenuItemConstructorOptions,
  type Session,
} from "electron";
import path from "node:path";
import { osDetails } from "./environment";
import { CHANNELS, type DesktopEnvironment } from "./shared";

export type { DesktopEnvironment } from "./shared";

export interface SetupOptions {
  /**
   * The build number reports carry (fix verification compares it to the
   * build a fix shipped in — announce releases with `feedbackkit release
   * --build <same value>`). Defaults to `app.getVersion()`.
   */
  appBuild?: string;
  /** Defaults to `app.getVersion()`. */
  appVersion?: string;
  /** Your app id (e.g. electron-builder's `appId`). Defaults to `app.getName()`. */
  bundleIdentifier?: string;
  /** A system-wide shortcut that opens the feedback flow, e.g. "CommandOrControl+Shift+F". Off by default. */
  globalShortcut?: string;
  /** Sessions to inject FeedbackKit's preload into. Defaults to the default session. */
  sessions?: Session[];
}

let environmentPromise: Promise<DesktopEnvironment> | null = null;
let registered = false;

/**
 * Call once in the main process, before creating windows. Registers the
 * IPC handlers and FeedbackKit's preload (next to your own), and optionally a
 * global shortcut. In the renderer, call `configure()` from
 * `feedbackkit-electron/renderer`.
 */
export function setupFeedbackKit(options: SetupOptions = {}): void {
  if (registered) return;
  registered = true;

  ipcMain.handle(CHANNELS.environment, () => {
    environmentPromise ??= osDetails(process.getSystemVersion()).then((osInfo) => ({
      ...osInfo,
      appVersion: options.appVersion ?? app.getVersion(),
      appBuild: options.appBuild ?? app.getVersion(),
      bundleIdentifier: options.bundleIdentifier ?? app.getName(),
      runtime: "electron" as const,
      runtimeVersion: process.versions.electron,
    }));
    return environmentPromise;
  });

  // Native capture of the calling window's page: pixel-exact, including
  // canvas/WebGL and cross-origin iframes, and no permission prompt.
  ipcMain.handle(CHANNELS.capture, async (event) => {
    try {
      const image = await event.sender.capturePage();
      return image.isEmpty() ? null : image.toDataURL();
    } catch {
      return null;
    }
  });

  const preload = path.join(__dirname, "preload.js");
  const register = (target: Session) => target.registerPreloadScript({ type: "frame", filePath: preload });
  if (app.isReady()) {
    (options.sessions ?? [session.defaultSession]).forEach(register);
  } else {
    void app.whenReady().then(() => (options.sessions ?? [session.defaultSession]).forEach(register));
  }

  if (options.globalShortcut) {
    const accelerator = options.globalShortcut;
    void app.whenReady().then(() => {
      if (!globalShortcut.register(accelerator, () => presentFeedback())) {
        console.warn(`[FeedbackKit] Couldn't register the global shortcut ${accelerator} (taken by another app?).`);
      }
    });
    app.on("will-quit", () => globalShortcut.unregister(accelerator));
  }
}

/** Opens the feedback flow in `window` (default: the focused window). */
export function presentFeedback(window?: BrowserWindow | null): void {
  const target = window ?? BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  target?.webContents.send(CHANNELS.present);
}

/** A "Report a Problem…" menu item (⌘⇧F / Ctrl+Shift+F) for your Help menu. */
export function feedbackMenuItem(overrides: Partial<MenuItemConstructorOptions> = {}): MenuItemConstructorOptions {
  return {
    label: "Report a Problem…",
    accelerator: "CmdOrCtrl+Shift+F",
    click: (_item, window) => presentFeedback(window as BrowserWindow | undefined),
    ...overrides,
  };
}
