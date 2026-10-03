import { invoke } from "@tauri-apps/api/core";

/**
 * Drives the real feedback dialog from inside the page — open, draw a
 * rectangle, describe, send — then reports back to Rust, which exits the app.
 * Used by e2e/selftest.mjs because Tauri has no WebDriver on macOS; on
 * Windows and Linux it runs the same way in CI.
 */
export async function runSelfTest(configured: Promise<void>): Promise<void> {
  const log = (message: string) => void invoke("selftest_log", { message });
  // Surface the page's own errors and warnings in the run's output.
  for (const level of ["warn", "error"] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      log(`console.${level}: ${args.map(String).join(" ")}`);
      original(...args);
    };
  }
  window.addEventListener("error", (e) => log(`error: ${e.message}`));
  window.addEventListener("unhandledrejection", (e) => log(`unhandled rejection: ${String(e.reason)}`));
  const heartbeat = setInterval(() => log(`waiting… overlay=${Boolean(inShadow(".fk-capture-overlay"))} dialog=${Boolean(inShadow(".fk-overlay"))}`), 3000);
  try {
    // 1. The native trigger (Help menu / tauri_plugin_feedbackkit::present) opens the flow.
    await configured;
    log("opening the dialog from Rust");
    await invoke("selftest_present");
    await waitFor(() => inShadow(".fk-ink"), 20000);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await waitFor(() => (inShadow(".fk-overlay") ? null : true));

    // 2. The page's own button: annotate, describe, send.
    log("opening the dialog from the page");
    await waitFor(() => document.querySelector<HTMLButtonElement>("#report-problem")).then((b) => b.click());
    const ink = await waitFor(() => inShadow<HTMLCanvasElement>(".fk-ink"), 20000);
    // Synthetic pointer events have no active pointer to capture.
    ink.setPointerCapture = () => {};

    log("dialog open; drawing");
    inShadow<HTMLButtonElement>('.fk-tool[aria-label="Rectangle"]')?.click();
    const box = ink.getBoundingClientRect();
    const at = (fx: number, fy: number) => ({ clientX: box.left + box.width * fx, clientY: box.top + box.height * fy });
    const pointer = (type: string, point: { clientX: number; clientY: number }) =>
      ink.dispatchEvent(new PointerEvent(type, { ...point, pointerId: 1, pointerType: "mouse", bubbles: true, buttons: 1 }));
    pointer("pointerdown", at(0.1, 0.3));
    for (let i = 1; i <= 5; i++) pointer("pointermove", at(0.1 + i * 0.1, 0.3 + i * 0.03));
    pointer("pointerup", at(0.6, 0.45));

    const text = await waitFor(() => inShadow<HTMLTextAreaElement>("#fk-text"));
    text.value = "The Add button overlaps the price";
    text.dispatchEvent(new Event("input", { bubbles: true }));
    log("sending");
    inShadow<HTMLButtonElement>(".fk-btn-primary")?.click();
    await waitFor(() => inShadow(".fk-done"), 20000);
    clearInterval(heartbeat);
    await invoke("selftest_finish", { ok: true, message: "sent" });
  } catch (error) {
    clearInterval(heartbeat);
    await invoke("selftest_finish", { ok: false, message: String(error) });
  }
}

/** The widget renders in an open shadow root. */
function inShadow<T extends Element = Element>(selector: string): T | null {
  for (const host of document.querySelectorAll("body > *")) {
    const found = host.shadowRoot?.querySelector<T>(selector);
    if (found) return found;
  }
  return null;
}

async function waitFor<T>(find: () => T | null, timeoutMs = 10000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = find();
    if (value) return value;
    if (Date.now() > deadline) throw new Error(`Timed out waiting (${find.toString().slice(0, 80)})`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
