---
name: setup-tauri-sdk
description: Integrate FeedbackKit into a Tauri 2 desktop app (Windows, Linux, macOS) — adds tauri-plugin-feedbackkit and feedbackkit-tauri, registers the plugin, its Help-menu item and capability permission, configures the project key in the frontend, and enables "is it fixed?" verification.
---

# setup-tauri-sdk

Integrates FeedbackKit into a Tauri 2 app. The feedback flow is FeedbackKit's web SDK running in the webview. The Rust plugin `tauri-plugin-feedbackkit` adds the real OS version, machine model and app details to every report, plus a native "Report a Problem…" menu item. The frontend package `feedbackkit-tauri` connects the two.

## When to Use

- Use when adding in-app feedback or bug reporting with annotated screenshots to a Tauri desktop app.
- Trigger phrases: "add feedbackkit to my tauri app", "setup feedbackkit tauri", "bug report menu item in tauri".
- For Electron use `setup-electron-sdk`.

## Prerequisites

- A Tauri 2 app (`src-tauri/` with `tauri = "2"`).
- A FeedbackKit project key and endpoint URL from the dashboard's **SDK setup** tab. Optional for local-only use.

## Step-by-Step Instructions

### Step 1 -- Add the dependencies

```bash
cargo add tauri-plugin-feedbackkit --manifest-path src-tauri/Cargo.toml
npm install feedbackkit-tauri feedbackkit-web
```

If `cargo add` can't find the crate (not on crates.io yet), add it as a git dependency in `src-tauri/Cargo.toml`:

```toml
tauri-plugin-feedbackkit = { git = "https://github.com/tianhaoz95/feedback-kit" }
```

### Step 2 -- Register the plugin and the menu item

In `src-tauri/src/lib.rs` (or `main.rs`):

```rust
use tauri::menu::{Menu, Submenu};

tauri::Builder::default()
    .plugin(tauri_plugin_feedbackkit::init())
    .setup(|app| {
        let menu = Menu::default(app.handle())?;
        let report = tauri_plugin_feedbackkit::menu_item(app)?; // ⌘⇧F / Ctrl+Shift+F
        menu.append(&Submenu::with_items(app, "Help", true, &[&report])?)?;
        app.set_menu(menu)?;
        Ok(())
    })
```

If the app already builds a menu, append `tauri_plugin_feedbackkit::menu_item(app)?` to its existing Help submenu. For a tray item or a global shortcut, call `tauri_plugin_feedbackkit::present(app.handle())`.

### Step 3 -- Allow the plugin's command

Add `"feedbackkit:default"` to the `permissions` of the main window's capability, e.g. `src-tauri/capabilities/default.json`.

### Step 4 -- Configure in the frontend

In the frontend entry point (e.g. `src/main.ts`):

```ts
import { configure, FeedbackKit } from "feedbackkit-tauri";

await configure({
  projectKey: "<project key>",
  endpoint: "<endpoint from the dashboard>",
});
FeedbackKit.showFloatingTriggerButton();
FeedbackKit.enableFixVerification();
```

Set `FeedbackKit.currentScreen = "<screen name>"` on route changes.

### Step 5 -- Close the loop

Reports carry the `version` from `tauri.conf.json` as their build. Pass `configure(config, { appBuild })` if the app uses a different build number. Announce each release with the same value:

```bash
npx feedbackkit-cli release --build <appBuild>
```

### Step 6 -- Verify

Run `npm run tauri dev` (or `npx tauri dev`). Open the flow from the floating button and from Help → Report a Problem…, draw on the screenshot, describe and send. The report appears in the dashboard labeled e.g. "Tauri · macOS".
