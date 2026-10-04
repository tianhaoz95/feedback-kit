---
name: setup-electron-sdk
description: Integrate FeedbackKit into an Electron desktop app (Windows, Linux, macOS) — installs feedbackkit-electron, calls setupFeedbackKit and adds the Help-menu item in the main process, configures the project key in the renderer, and enables "is it fixed?" verification.
---

# setup-electron-sdk

Integrates FeedbackKit into an Electron app. The feedback flow is FeedbackKit's web SDK running in the renderer. `feedbackkit-electron` adds native screenshots (`webContents.capturePage`), the real OS version, machine model and app details, a "Report a Problem…" Help-menu item, and an optional global shortcut.

## When to Use

- Use when adding in-app feedback or bug reporting with annotated screenshots to an Electron app.
- Trigger phrases: "add feedbackkit to my electron app", "setup feedbackkit electron", "bug report menu item in electron".
- For Tauri use `setup-tauri-sdk`.

## Prerequisites

- Electron 35 or newer.
- A FeedbackKit project key and endpoint URL from the dashboard's **SDK setup** tab. Optional for local-only use.

## Step-by-Step Instructions

### Step 1 -- Install

```bash
npm install feedbackkit-electron feedbackkit-web
```

### Step 2 -- Main process

Before any window is created (e.g. at the top of `main.js` / `src/main/index.ts`):

```js
const { setupFeedbackKit, feedbackMenuItem } = require("feedbackkit-electron/main");
// or: import { setupFeedbackKit, feedbackMenuItem } from "feedbackkit-electron/main";

setupFeedbackKit({
  bundleIdentifier: "<the app id, e.g. electron-builder's appId>",
  // appBuild: "<build number, if it isn't app.getVersion()>",
  // globalShortcut: "CommandOrControl+Alt+F",
});
```

Then add `feedbackMenuItem()` to the application menu's Help submenu, creating one if the app has no menu:

```js
{ role: "help", submenu: [feedbackMenuItem()] }
```

`setupFeedbackKit` registers its own preload next to the app's (it works in sandboxed renderers), so the app's preload doesn't change.

### Step 3 -- Renderer

In the renderer entry point:

```ts
import { configure, FeedbackKit } from "feedbackkit-electron/renderer";

await configure({
  projectKey: "<project key>",
  endpoint: "<endpoint from the dashboard>",
});
FeedbackKit.showFloatingTriggerButton();
FeedbackKit.enableFixVerification();
```

If the renderer has a Content-Security-Policy, add the endpoint's origin to `connect-src`. Set `FeedbackKit.currentScreen = "<screen name>"` on route changes.

### Step 4 -- Close the loop

Reports carry `app.getVersion()` as their build unless `appBuild` is passed to `setupFeedbackKit`. Announce each release with the same value:

```bash
npx feedbackkit-cli release --build <appBuild>
```

### Step 5 -- Verify

Start the app. Open the flow from the floating button and from Help → Report a Problem…, draw, describe and send. The report appears in the dashboard labeled e.g. "Electron · Windows".
