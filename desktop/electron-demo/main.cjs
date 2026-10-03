// The Electron demo's main process. FeedbackKit needs two calls here:
// setupFeedbackKit() (IPC + preload + optional global shortcut) and
// feedbackMenuItem() in the Help menu.
const { app, BrowserWindow, Menu } = require("electron");
const path = require("node:path");
const { setupFeedbackKit, feedbackMenuItem } = require("feedbackkit-electron/main");

setupFeedbackKit({
  bundleIdentifier: "com.feedbackkit.demo.electron",
  // A system-wide shortcut, separate from the menu item's ⌘⇧F / Ctrl+Shift+F.
  globalShortcut: "CommandOrControl+Alt+F",
});

function createWindow() {
  const window = new BrowserWindow({
    width: 1100,
    height: 760,
    title: "FeedbackKit Electron Demo",
    webPreferences: { sandbox: true, contextIsolation: true },
  });
  window.loadFile(path.join(__dirname, "dist", "index.html"));
}

app.whenReady().then(() => {
  const isMac = process.platform === "darwin";
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      ...(isMac ? [{ role: "appMenu" }] : []),
      { role: "fileMenu" },
      { role: "editMenu" },
      { role: "viewMenu" },
      { role: "windowMenu" },
      { role: "help", submenu: [feedbackMenuItem({ id: "feedbackkit-report" })] },
    ]),
  );
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
