// End-to-end test of feedbackkit-electron in the real demo app: launches
// Electron with Playwright, opens the flow from the page and from the Help
// menu, annotates, sends to a local mock ingestion endpoint, and checks the
// exact report — real OS/device/app details, runtime "electron", and a
// screenshot from the native capture.
import { _electron as electron } from "playwright";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const out = `${here}output`;
mkdirSync(out, { recursive: true });

// ---- Mock ingestion endpoint ------------------------------------------------
const received = [];
const server = createServer((req, res) => {
  const cors = {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type, x-project-key",
    "access-control-allow-methods": "POST, GET, OPTIONS",
  };
  if (req.method === "OPTIONS") return res.writeHead(204, cors).end();
  if (req.method === "GET") {
    return res.writeHead(200, { ...cors, "content-type": "application/json" }).end(JSON.stringify({ products: [], updates: [] }));
  }
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    received.push(JSON.parse(body));
    res.writeHead(201, { ...cors, "content-type": "application/json" }).end('{"id":"ok"}');
  });
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const endpoint = `http://127.0.0.1:${server.address().port}/functions/v1/ingest-feedback`;

// Linux CI runners restrict the unprivileged user namespaces Chromium's
// sandbox needs, so it's off there (and only there).
const sandboxArgs = process.platform === "linux" && process.env.CI ? ["--no-sandbox"] : [];
// path.resolve drops the trailing separator: on Windows a trailing "\" before
// the closing quote escapes it, and Electron never sees the app path.
const appDir = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const app = await electron.launch({ args: [...sandboxArgs, appDir] });
try {
  let page = await app.firstWindow();
  await page.waitForSelector("#report-problem");

  // Configure through the demo's own settings storage, then reload.
  await page.evaluate(({ endpoint }) => {
    localStorage.setItem("com.feedbackkit.demo.apiKey", "pk_test_electron");
    localStorage.setItem("com.feedbackkit.demo.endpointURL", endpoint);
  }, { endpoint });
  await page.reload();
  await page.waitForSelector("#report-problem");

  // 1. The Help-menu item opens the flow (main → renderer IPC).
  await app.evaluate(({ Menu }) => Menu.getApplicationMenu().getMenuItemById("feedbackkit-report").click());
  await page.locator(".fk-ink").waitFor({ timeout: 15000 });
  await page.keyboard.press("Escape");
  await page.locator(".fk-overlay").waitFor({ state: "detached" });

  // 2. The page's own button: annotate, describe, send.
  await page.locator("#report-problem").click();
  const ink = page.locator(".fk-ink");
  await ink.waitFor({ timeout: 15000 });
  await page.screenshot({ path: `${out}/dialog.png` });
  const box = await ink.boundingBox();
  await page.locator('.fk-tool[aria-label="Rectangle"]').click();
  await page.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.45, { steps: 5 });
  await page.mouse.up();
  await page.locator("#fk-text").fill("The Add button overlaps the price");
  await page.locator(".fk-btn-primary").click();
  await page.locator(".fk-done").waitFor({ timeout: 20000 });

  assert.equal(received.length, 1, "one report posted");
  const report = received[0];
  writeFileSync(`${out}/payload.json`, JSON.stringify({ ...report, screenshot_raw_png_base64: "…", screenshot_annotated_png_base64: "…" }, null, 2));
  writeFileSync(`${out}/annotated.png`, Buffer.from(report.screenshot_annotated_png_base64, "base64"));

  const env = report.environment;
  assert.equal(report.project_key, "pk_test_electron");
  assert.equal(report.text, "The Add button overlaps the price");
  assert.equal(report.annotations.length, 1);
  assert.equal(report.annotations[0].kind, "rectangle");
  assert.equal(env.platform, "web");
  assert.equal(env.runtime, "electron");
  assert.match(env.runtimeVersion, /^\d+\.\d+\.\d+/);
  assert.equal(env.bundleIdentifier, "com.feedbackkit.demo.electron");
  assert.equal(env.appVersion, "1.0.62");
  assert.equal(env.screenName, "Home");
  if (process.platform === "darwin") {
    assert.equal(env.osName, "macOS");
    assert.equal(env.deviceModel, execFileSync("sysctl", ["-n", "hw.model"]).toString().trim());
  } else {
    assert.equal(env.osName, process.platform === "win32" ? "Windows" : "Linux");
  }
  const png = Buffer.from(report.screenshot_raw_png_base64, "base64");
  assert.equal(png.subarray(1, 4).toString(), "PNG", "raw screenshot is a PNG");
  console.log(`✓ Electron e2e passed — ${env.osName} ${env.osVersion}, ${env.deviceModel}, Electron ${env.runtimeVersion}`);
} finally {
  await app.close();
  server.close();
}
