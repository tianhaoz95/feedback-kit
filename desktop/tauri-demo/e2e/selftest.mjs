// End-to-end test of tauri-plugin-feedbackkit + feedbackkit-tauri in the real
// demo app: launches the built binary with FEEDBACKKIT_DEMO_SELFTEST pointing
// at a local mock ingestion endpoint; the app drives the real dialog from the
// page (src/selftest.ts), sends a report and exits. Then checks the report —
// OS/device/app details from the Rust plugin, runtime "tauri", a screenshot.
//
//   npx tauri build --debug --no-bundle && node e2e/selftest.mjs [path/to/binary]
//
// Linux CI runs it under xvfb-run.
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const out = `${here}output`;
mkdirSync(out, { recursive: true });
const binary =
  process.argv[2] ??
  fileURLToPath(new URL(`../src-tauri/target/debug/feedbackkit-tauri-demo${process.platform === "win32" ? ".exe" : ""}`, import.meta.url));
assert.ok(existsSync(binary), `build the app first (npx tauri build --debug --no-bundle): ${binary}`);

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

const child = spawn(binary, [], { env: { ...process.env, FEEDBACKKIT_DEMO_SELFTEST: endpoint }, stdio: ["ignore", "pipe", "inherit"] });
let stdout = "";
child.stdout.on("data", (chunk) => (stdout += chunk));
const timeout = setTimeout(() => child.kill(), 120_000);
const code = await new Promise((resolve) => child.on("exit", resolve));
clearTimeout(timeout);
server.close();

assert.match(stdout, /FEEDBACKKIT_SELFTEST PASS/, `self-test didn't pass (exit ${code}):\n${stdout}`);
assert.equal(received.length, 1, "one report posted");
const report = received[0];
writeFileSync(`${out}/payload.json`, JSON.stringify({ ...report, screenshot_raw_png_base64: "…", screenshot_annotated_png_base64: "…" }, null, 2));
if (report.screenshot_annotated_png_base64) {
  writeFileSync(`${out}/annotated.png`, Buffer.from(report.screenshot_annotated_png_base64, "base64"));
}

const env = report.environment;
assert.equal(report.project_key, "pk_test_tauri");
assert.equal(report.text, "The Add button overlaps the price");
assert.equal(report.annotations.length, 1);
assert.equal(report.annotations[0].kind, "rectangle");
assert.equal(env.platform, "web");
assert.equal(env.runtime, "tauri");
assert.match(env.runtimeVersion, /^2\.\d+\.\d+/);
assert.equal(env.bundleIdentifier, "com.feedbackkit.demo.tauri");
assert.equal(env.appVersion, "1.0.62");
assert.equal(env.screenName, "Home");
const expectedOs = { darwin: "macOS", win32: "Windows", linux: "Linux" }[process.platform];
assert.equal(env.osName, expectedOs);
if (process.platform === "darwin") {
  assert.equal(env.deviceModel, execFileSync("sysctl", ["-n", "hw.model"]).toString().trim());
}
assert.ok(report.screenshot_raw_png_base64, "has a screenshot");
assert.equal(Buffer.from(report.screenshot_raw_png_base64, "base64").subarray(1, 4).toString(), "PNG");
console.log(`✓ Tauri self-test passed — ${env.osName} ${env.osVersion}, ${env.deviceModel}, Tauri ${env.runtimeVersion}`);
