# Tauri & Electron (`desktop/`)

Desktop apps built with Tauri 2 or Electron use the web SDK in their webview,
plus a package per shell that adds real OS/device/app details and native
triggers. User-facing docs are on the dashboard at `/docs/desktop`; the
design reasoning is in `DESIGN.md` §1d.

| Path | What |
|---|---|
| `desktop/tauri/` | Rust crate `tauri-plugin-feedbackkit`: the `environment` command (`src/environment.rs`), the menu item and `present()` (`src/lib.rs`), generated permissions |
| `desktop/tauri/guest-js/` | npm `feedbackkit-tauri`: `configure()` applies the plugin's details to the web SDK and listens for `feedbackkit://present` |
| `desktop/electron/` | npm `feedbackkit-electron`: `main` (IPC, `capturePage`, menu item, global shortcut, session preload), `preload` (self-contained bridge), `renderer` (`configure()`) |
| `desktop/demo-ui/` | The Home / Cart / Settings sample, shared by both demos |
| `desktop/tauri-demo/` | Tauri demo app; `e2e/selftest.mjs` (+ `src/selftest.ts`), `e2e/run-linux.sh` |
| `desktop/electron-demo/` | Electron demo app; `e2e/run.mjs` (Playwright) |

## Web SDK hooks they rely on

- `FeedbackKit.environment` / `configure({ environment })`: fields merged
  over the detected ones (`EnvironmentOverrides`). An explicit
  `appVersion`/`appBuild` in the configuration still wins.
- `captureOptions.provider`: returns a canvas, PNG blob or data URL. The
  widget hides itself first, and the built-in capture takes over if the
  provider returns `null` or throws.

## Tests

```bash
cd desktop/electron && npm test                  # OS-detail parsers, preload stays self-contained
cd desktop/electron-demo && npm run test:e2e     # menu trigger + full flow, checks the posted payload
cd desktop/tauri && cargo test
cd desktop/tauri-demo && npx tauri build --debug --no-bundle && node e2e/selftest.mjs
desktop/tauri-demo/e2e/run-linux.sh              # Linux (WebKitGTK + xvfb) in Docker; --clean afterwards
```

`desktop-ci.yml` runs all of them on Ubuntu, Windows and macOS.
