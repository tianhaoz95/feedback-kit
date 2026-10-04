import { invoke, isTauri } from "@tauri-apps/api/core";
import { mountDemo } from "feedbackkit-desktop-demo-ui";
import { configure } from "feedbackkit-tauri";
import { runSelfTest } from "./selftest";

async function start(): Promise<void> {
  // FEEDBACKKIT_DEMO_SELFTEST=<endpoint> runs the end-to-end self-test (e2e/selftest.mjs).
  const selfTestEndpoint = isTauri() ? await invoke<string | null>("selftest_endpoint") : null;
  if (selfTestEndpoint) {
    localStorage.setItem("com.feedbackkit.demo.apiKey", "pk_test_tauri");
    localStorage.setItem("com.feedbackkit.demo.endpointURL", selfTestEndpoint);
  }

  // The frontend side: one configure() call. It adds the real OS, device and
  // app details from tauri-plugin-feedbackkit and listens for its Help-menu item.
  let configured: Promise<void> = Promise.resolve();
  mountDemo(document.getElementById("app")!, {
    runtimeName: "Tauri",
    triggerHints: ["Help → Report a Problem… (⌘⇧F / Ctrl+Shift+F)"],
    applySettings: ({ apiKey, endpointUrl }) =>
      (configured = configure(apiKey ? { projectKey: apiKey, endpoint: endpointUrl } : null)),
  });

  if (selfTestEndpoint) await runSelfTest(configured);
}

void start();
