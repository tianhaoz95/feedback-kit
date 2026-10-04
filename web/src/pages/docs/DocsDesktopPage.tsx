import { CodeBlock } from "@/components/docs/CodeBlock";
import { DocsCallout, DocsList, DocsSection, DocsTable, DocsTitle, InlineCode } from "@/components/docs/DocsProse";

const tauriInstall = `cargo add tauri-plugin-feedbackkit --manifest-path src-tauri/Cargo.toml
npm install feedbackkit-tauri feedbackkit-web`;

const tauriRust = `use tauri::menu::{Menu, Submenu};

tauri::Builder::default()
    .plugin(tauri_plugin_feedbackkit::init())
    .setup(|app| {
        let menu = Menu::default(app.handle())?;
        let report = tauri_plugin_feedbackkit::menu_item(app)?; // ⌘⇧F / Ctrl+Shift+F
        menu.append(&Submenu::with_items(app, "Help", true, &[&report])?)?;
        app.set_menu(menu)?;
        Ok(())
    })`;

const tauriCapability = `{
  "identifier": "default",
  "windows": ["main"],
  "permissions": ["core:default", "feedbackkit:default"]
}`;

const tauriFrontend = `import { configure, FeedbackKit } from "feedbackkit-tauri";

await configure({ projectKey: "pk_live_..." }); // or configure(null) for local-only use
FeedbackKit.showFloatingTriggerButton();
FeedbackKit.currentScreen = "Checkout";            // as the user navigates
await FeedbackKit.presentAndSubmit();              // from your own button`;

const electronInstall = `npm install feedbackkit-electron feedbackkit-web`;

const electronMain = `const { app, Menu } = require("electron");
const { setupFeedbackKit, feedbackMenuItem } = require("feedbackkit-electron/main");

setupFeedbackKit({
  bundleIdentifier: "com.example.notes",     // default: app.getName()
  appBuild: "421",                            // default: app.getVersion()
  globalShortcut: "CommandOrControl+Alt+F",   // optional, system-wide
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    // …your menus…
    { role: "help", submenu: [feedbackMenuItem()] }, // ⌘⇧F / Ctrl+Shift+F
  ]));
});`;

const electronRenderer = `import { configure, FeedbackKit } from "feedbackkit-electron/renderer";

await configure({ projectKey: "pk_live_..." });
FeedbackKit.showFloatingTriggerButton();`;

export function DocsDesktopPage() {
  return (
    <div>
      <DocsTitle
        eyebrow="SDK"
        title="Tauri & Electron"
        description="Feedback for desktop apps built with Tauri or Electron, on Windows, Linux and macOS.
          The flow is FeedbackKit's web SDK running in your app's webview. A small package for each
          shell adds what a webview can't know or do: the real OS and machine, your app's identity, and
          native triggers."
      />

      <DocsSection title="What the desktop packages add">
        <DocsTable
          columns={["", "Tauri", "Electron"]}
          rows={[
            [<>Packages</>, <><InlineCode>tauri-plugin-feedbackkit</InlineCode> (Rust) + <InlineCode>feedbackkit-tauri</InlineCode></>, <InlineCode>feedbackkit-electron</InlineCode>],
            [<>Screenshot</>, <>Re-rendered from the page (no permission prompt)</>, <>Native <InlineCode>capturePage</InlineCode>: pixel-exact, no prompt</>],
            [<>Device details</>, <>OS version (Windows 11 vs 10, Linux distribution), machine model, app id and version</>, <>Same</>],
            [<>Triggers</>, <>Help-menu item, <InlineCode>present()</InlineCode> for trays and shortcuts</>, <>Help-menu item, optional global shortcut</>],
            [<>Dashboard label</>, <>Tauri · Windows</>, <>Electron · macOS</>],
          ]}
        />
        <p>
          Reports are web-SDK reports with <InlineCode>environment.runtime</InlineCode> set to{" "}
          <InlineCode>tauri</InlineCode> or <InlineCode>electron</InlineCode>. They keep the page URL and console
          logs, and the coding-agent prompt calls them a &ldquo;Tauri app on Windows&rdquo; rather than a website.
        </p>
      </DocsSection>

      <DocsSection title="Tauri">
        <p>For Tauri 2 apps.</p>
        <CodeBlock code={tauriInstall} label="Terminal" />
        <CodeBlock code={tauriRust} label="src-tauri/src/lib.rs" />
        <CodeBlock code={tauriCapability} label="src-tauri/capabilities/default.json" />
        <CodeBlock code={tauriFrontend} label="TypeScript" />
        <p className="text-neutral-600">
          The build number reports carry is the <InlineCode>version</InlineCode> in tauri.conf.json. Pass{" "}
          <InlineCode>configure(config, {"{ appBuild }"})</InlineCode> if yours differs.
        </p>
      </DocsSection>

      <DocsSection title="Electron">
        <p>
          Electron 35 or later. <InlineCode>setupFeedbackKit()</InlineCode> registers its own preload next to yours, and it
          works in sandboxed renderers, so your preload doesn&apos;t change.
        </p>
        <CodeBlock code={electronInstall} label="Terminal" />
        <CodeBlock code={electronMain} label="main.js" />
        <CodeBlock code={electronRenderer} label="renderer.ts" />
        <DocsCallout>
          If your renderer sets a Content-Security-Policy, allow <InlineCode>connect-src</InlineCode> to your FeedbackKit
          endpoint&apos;s host.
        </DocsCallout>
      </DocsSection>

      <DocsSection title="Everything else is the web SDK">
        <p>
          <InlineCode>FeedbackKit</InlineCode> in both packages is the web SDK&apos;s object. Theming, products, the
          composer&apos;s + menu, console and network logs, <InlineCode>currentScreen</InlineCode> and fix verification
          all work as described in the web SDK docs. For fix verification, announce each release with the build
          number your reports carry:
        </p>
        <CodeBlock code="npx feedbackkit-cli release --build <appBuild>" label="Terminal" />
      </DocsSection>

      <DocsSection title="Try it">
        <DocsList
          items={[
            <><InlineCode>desktop/tauri-demo</InlineCode>: <InlineCode>npm run dev</InlineCode> (the Home / Cart / Settings sample)</>,
            <><InlineCode>desktop/electron-demo</InlineCode>: <InlineCode>npm start</InlineCode></>,
          ]}
        />
      </DocsSection>
    </div>
  );
}
