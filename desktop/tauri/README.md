# tauri-plugin-feedbackkit / feedbackkit-tauri

In-app feedback for Tauri 2 apps on Windows, Linux and macOS. Users capture
the window, mark it up, describe the problem, and the report goes to the
[FeedbackKit](https://github.com/tianhaoz95/feedback-kit) dashboard, or to
your own code.

The flow itself is FeedbackKit's web SDK (`feedbackkit-web`) running in your
webview. The screenshot is re-rendered from the page, so there's no
screen-recording prompt on any OS. This plugin adds what a webview can't know
or do on its own:

- **Real device details**: the OS version (Windows 11 vs 10, the Linux
  distribution), the machine model, and your app's identifier and version.
  Reports carry `runtime: "tauri"`, and the dashboard labels them e.g.
  "Tauri · Windows".
- **Native triggers**: a "Report a Problem…" menu item, and `present()` for
  trays and global shortcuts.

## Install

```sh
cargo add tauri-plugin-feedbackkit --manifest-path src-tauri/Cargo.toml
npm install feedbackkit-tauri feedbackkit-web
```

Until the crate is on crates.io, use a git dependency:
`tauri-plugin-feedbackkit = { git = "https://github.com/tianhaoz95/feedback-kit" }`.

## Rust

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

Then add `"feedbackkit:default"` to your capability's `permissions`, for
example in `src-tauri/capabilities/default.json`.

From a tray item or a global shortcut, call `tauri_plugin_feedbackkit::present(app.handle())`.

## Frontend

```ts
import { configure, FeedbackKit } from "feedbackkit-tauri";

await configure({ projectKey: "pk_live_..." }); // or configure(null) for local-only use

FeedbackKit.showFloatingTriggerButton();
FeedbackKit.currentScreen = "Checkout"; // as the user navigates
await FeedbackKit.presentAndSubmit();   // from your own button
```

`FeedbackKit` is the web SDK's object, so everything in its
[docs](https://feedback-kit.hejitech.workers.dev/docs/web-sdk) applies. The
report's `appBuild` defaults to the version in `tauri.conf.json`. Pass
`configure(config, { appBuild })` if your build number differs, and announce
releases with the same value (`npx feedbackkit-cli release --build <n>`).

## Demo app and tests

`../tauri-demo` is the same Home / Cart / Settings sample as the other
FeedbackKit demos (`npm run dev`). Its end-to-end self-test drives the real
dialog inside the app and checks the posted report:

```sh
cd ../tauri-demo
npx tauri build --debug --no-bundle && node e2e/selftest.mjs   # this OS
e2e/run-linux.sh                                               # Linux, in Docker
e2e/run-linux.sh --clean                                       # remove its image and volumes
```

Rust unit tests: `cargo test` here.
