import { mountDemo } from "feedbackkit-desktop-demo-ui";
import { configure } from "feedbackkit-electron/renderer";

// The renderer side: one configure() call. It adds the real OS, device and
// app details from the main process, switches screenshots to Electron's
// native capturePage, and listens for the Help-menu item / global shortcut.
mountDemo(document.getElementById("app")!, {
  runtimeName: "Electron",
  triggerHints: ["Help → Report a Problem… (⌘⇧F / Ctrl+Shift+F)", "The global shortcut ⌘⌥F / Ctrl+Alt+F, even when the app is in the background"],
  applySettings: ({ apiKey, endpointUrl }) =>
    configure(apiKey ? { projectKey: apiKey, endpoint: endpointUrl } : null),
});
