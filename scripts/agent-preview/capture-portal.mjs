#!/usr/bin/env node
// Captures the iOS Developer Portal (DeveloperApp/) as it is in this working
// tree, in the iOS Simulator, and optionally attaches the PNG to a FeedbackKit
// report as an after-fix preview. The iOS counterpart of capture-web.mjs.
//
//   node scripts/agent-preview/capture-portal.mjs --feedback <id> [--attach] [--caption "…"]
//   node scripts/agent-preview/capture-portal.mjs --tab projects --out /tmp/after.png
//
// Options:
//   --feedback <id>   Report to read (FEEDBACKKIT_TOKEN); its screen name picks the tab.
//   --tab <tab>       feedback (the inbox, default), activity, projects or settings.
//   --out <file.png>  Where to write it (default: a temp file, printed on stdout).
//   --attach          Attach it to --feedback (the token needs previews:write).
//   --caption <text>  Caption for --attach.
//   --since <iso>     With --attach: skip if the report already got a preview after this time.
//   --no-build        Reuse the last build in DeveloperApp/.build.
//
// The Portal needs a GitHub sign-in, which a capture can't do, so it runs in
// the Portal's offline demo mode (`-portal_demo_mode "<true/>"`, sample projects and
// reports, no backend) and opens the tab with `-portal_preview_tab`. Neither
// is persisted. Screens deeper than a tab (a report's detail, a sheet) need
// driving the UI, e.g. with a UI test; capture those yourself with
// `xcrun simctl io <device> screenshot` and attach them with attach.mjs.
// Uses a simulator named "FeedbackKit Preview" (created on first run) so it
// never disturbs one you're using. Exit code 3: nothing to capture.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { attach, fetchReport, hasPreviewSince, log, SKIP } from "./feedbackkit.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const APP_DIR = join(ROOT, "DeveloperApp");
const BUILD_DIR = join(APP_DIR, ".build");
const BUNDLE_ID = "com.feedbackkit.developer";
const DEVICE_NAME = "FeedbackKit Preview";
const TABS = ["feedback", "activity", "projects", "settings"];

function fail(message, code = 1) {
  console.error(`capture-portal: ${message}`);
  process.exit(code);
}

function parseArgs(argv) {
  const args = { build: true };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    const value = () => {
      const v = argv[++i];
      if (v === undefined) fail(`${key} needs a value`);
      return v;
    };
    if (key === "--feedback") args.feedback = value();
    else if (key === "--tab") args.tab = value();
    else if (key === "--out") args.out = resolve(value());
    else if (key === "--attach") args.attach = true;
    else if (key === "--caption") args.caption = value();
    else if (key === "--since") args.since = value();
    else if (key === "--no-build") args.build = false;
    else fail(`Unknown option ${key}`);
  }
  if (args.tab && !TABS.includes(args.tab)) fail(`--tab is one of ${TABS.join(", ")}.`);
  if (args.attach && !args.feedback) fail("--attach needs --feedback.");
  return args;
}

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options });
  if (result.status !== 0) {
    const out = `${result.stdout ?? ""}${result.stderr ?? ""}`.split("\n").slice(-40).join("\n");
    throw new Error(`${cmd} ${args.slice(0, 3).join(" ")}… failed:\n${out}`);
  }
  return result.stdout;
}

/** The Portal tab a report's screen name points at (the Portal's own reports name their screen). */
function tabForScreen(screenName = "") {
  const s = screenName.toLowerCase();
  if (/activity|notification/.test(s)) return "activity";
  if (/project|team|sdk|release/.test(s)) return "projects";
  if (/setting|account|cli/.test(s)) return "settings";
  return "feedback";
}

/** A dedicated iPhone simulator, booted: the newest runtime's first "iPhone 17"-ish device type. */
function previewDevice() {
  const devices = JSON.parse(run("xcrun", ["simctl", "list", "devices", "available", "-j"])).devices;
  let udid = Object.values(devices).flat().find((d) => d.name === DEVICE_NAME)?.udid;
  if (!udid) {
    const runtimes = JSON.parse(run("xcrun", ["simctl", "list", "runtimes", "available", "-j"])).runtimes.filter((r) =>
      r.identifier.includes("iOS"),
    );
    const runtime = runtimes.at(-1);
    if (!runtime) throw new Error("No iOS Simulator runtime is installed.");
    const types = runtime.supportedDeviceTypes ?? [];
    const type =
      types.find((t) => t.name === "iPhone 17 Pro") ?? types.find((t) => /^iPhone \d+ Pro$/.test(t.name)) ?? types.find((t) => t.name.startsWith("iPhone"));
    if (!type) throw new Error(`No iPhone device type for ${runtime.name}.`);
    udid = run("xcrun", ["simctl", "create", DEVICE_NAME, type.identifier, runtime.identifier]).trim();
  }
  spawnSync("xcrun", ["simctl", "boot", udid], { stdio: "ignore" });
  run("xcrun", ["simctl", "bootstatus", udid, "-b"]);
  spawnSync(
    "xcrun",
    ["simctl", "status_bar", udid, "override", "--time", "9:41", "--dataNetwork", "wifi", "--wifiMode", "active", "--wifiBars", "3", "--batteryState", "discharged", "--batteryLevel", "100"],
    { stdio: "ignore" },
  );
  return udid;
}

function build(udid) {
  log("building the iOS Portal (xcodegen + xcodebuild)…");
  run("xcodegen", ["generate"], { cwd: APP_DIR });
  run("xcodebuild", [
    "build",
    "-project",
    "FeedbackPortal.xcodeproj",
    "-scheme",
    "FeedbackPortal",
    "-destination",
    `id=${udid}`,
    "-derivedDataPath",
    BUILD_DIR,
    "CODE_SIGNING_ALLOWED=NO",
    "-quiet",
  ], { cwd: APP_DIR });
}

function appPath() {
  const products = join(BUILD_DIR, "Build", "Products");
  const dir = existsSync(products) ? readdirSync(products).find((d) => d.endsWith("-iphonesimulator")) : null;
  const app = dir ? join(products, dir, "FeedbackPortal.app") : null;
  if (!app || !existsSync(app)) throw new Error("No FeedbackPortal.app in DeveloperApp/.build (build it first, or drop --no-build).");
  return app;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = args.feedback ? await fetchReport(args.feedback) : null;
  if (args.attach && args.since && report && hasPreviewSince(report, args.since)) {
    log("the report already has a preview from this run; nothing to do.");
    process.exit(SKIP);
  }
  if (report?.item.environment?.platform === "web") {
    log("that's a web report; use capture-web.mjs.");
    process.exit(SKIP);
  }
  const tab = args.tab ?? tabForScreen(report?.item.environment?.screenName);
  const out = args.out ?? join(mkdtempSync(join(tmpdir(), "fk-capture-")), "after.png");

  const udid = previewDevice();
  if (args.build) build(udid);
  run("xcrun", ["simctl", "install", udid, appPath()]);
  spawnSync("xcrun", ["simctl", "terminate", udid, BUNDLE_ID], { stdio: "ignore" });
  log(`launching in demo mode on the ${tab} tab…`);
  run("xcrun", ["simctl", "launch", udid, BUNDLE_ID, "-portal_demo_mode", "<true/>", "-portal_preview_tab", tab]);
  // Demo data is local, but let the first screen lay out and images decode.
  await new Promise((r) => setTimeout(r, 5000));
  run("xcrun", ["simctl", "io", udid, "screenshot", "--type=png", out]);
  spawnSync("xcrun", ["simctl", "terminate", udid, BUNDLE_ID], { stdio: "ignore" });
  console.log(out);

  if (args.attach) {
    const result = await attach(args.feedback, readFileSync(out), args.caption ?? `After the fix: the Portal's ${tab} tab (demo data)`);
    log(`attached (${result.media_type ?? "image"}).`);
  }
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
