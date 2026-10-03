# feedbackkit-electron

In-app feedback for Electron apps. Users capture the window, mark it up,
describe the problem, and the report goes to the
[FeedbackKit](https://github.com/tianhaoz95/feedback-kit) dashboard, or to
your own code.

It's FeedbackKit's web SDK (`feedbackkit-web`) running in your renderer, plus
what only the main process can provide:

- **Native screenshots**: Electron's `webContents.capturePage()`. It's
  pixel-exact (canvas, WebGL, video, cross-origin iframes) and shows no
  permission prompt.
- **Real device details**: the OS version (Windows 11 vs 10, the Linux
  distribution), the machine model, and your app's id, version and build.
  Reports carry `runtime: "electron"`, and the dashboard labels them e.g.
  "Electron · Windows".
- **Native triggers**: a "Report a Problem…" Help-menu item, and an optional
  global shortcut.

Requires Electron 35+.

## Install

```sh
npm install feedbackkit-electron feedbackkit-web
```

## Main process

```js
const { app, Menu } = require("electron");
const { setupFeedbackKit, feedbackMenuItem } = require("feedbackkit-electron/main");

// Before creating windows. Registers IPC and FeedbackKit's preload (next to
// your own preload; it runs in sandboxed renderers too).
setupFeedbackKit({
  bundleIdentifier: "com.example.notes", // default: app.getName()
  appBuild: "421",                        // default: app.getVersion()
  globalShortcut: "CommandOrControl+Alt+F", // optional, system-wide
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    // …your menus…
    { role: "help", submenu: [feedbackMenuItem()] }, // ⌘⇧F / Ctrl+Shift+F
  ]));
});
```

Use `presentFeedback(window)` to open the flow from a tray menu or your own IPC.

## Renderer

```ts
import { configure, FeedbackKit } from "feedbackkit-electron/renderer";

await configure({ projectKey: "pk_live_..." }); // or configure(null) for local-only use

FeedbackKit.showFloatingTriggerButton();
FeedbackKit.currentScreen = "Checkout"; // as the user navigates

// From your own button:
await FeedbackKit.presentAndSubmit();
```

`FeedbackKit` here is the web SDK's object, so everything in its
[docs](https://feedback-kit.hejitech.workers.dev/docs/web-sdk) applies:
theming, products, fix verification, console logs and more.

For fix verification ("is it fixed?"), announce each release with the same
build number you passed as `appBuild`:
`npx feedbackkit-cli release --build 421`.

## Demo app

`../electron-demo` is the same Home / Cart / Settings sample as the other
FeedbackKit demos. `npm start` runs it, and `npm run test:e2e` runs the
Playwright end-to-end test against a mock endpoint.
