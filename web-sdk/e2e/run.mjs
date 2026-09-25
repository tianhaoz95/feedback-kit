// End-to-end check of the built IIFE bundle in real Chromium, WebKit and
// Firefox: trigger → capture → annotate → describe → submit, asserting the
// exact JSON that reaches the (mocked) ingestion endpoint — then the closed
// loop: the "is it fixed?" card against a mocked reporter-updates endpoint.
//
//   npm run test:e2e              # all three engines
//   BROWSERS=chromium npm run test:e2e
import { chromium, firefox, webkit } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = "file://" + path.join(here, "fixture.html");
const outDir = path.join(here, "output");
fs.mkdirSync(outDir, { recursive: true });

const ENDPOINT = "https://ingest.feedbackkit.test/functions/v1/ingest-feedback";
const UPDATES = "https://ingest.feedbackkit.test/functions/v1/reporter-updates";
// 1×1 PNG, standing in for the signed screenshot URL.
const PIXEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const engines = { chromium, webkit, firefox };
const selected = (process.env.BROWSERS ?? "chromium,webkit,firefox").split(",");

let failures = 0;
for (const name of selected) {
  const browser = await engines[name].launch();
  try {
    await runSuite(name, browser);
    await runFixSuite(name, browser);
    console.log(`✓ ${name}`);
  } catch (error) {
    failures++;
    console.error(`✗ ${name}\n`, error);
  } finally {
    await browser.close();
  }
}
process.exit(failures ? 1 : 0);

async function runSuite(name, browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const posted = [];
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e));

  await page.route(`${ENDPOINT}**`, async (route) => {
    const req = route.request();
    if (req.method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: JSON.stringify({
          products: [
            { key: "web", name: "Web app", description: "React SPA", is_default: true },
            { key: "api", name: "Backend API", description: "", is_default: false },
          ],
        }),
      });
    }
    if (req.method() === "OPTIONS") {
      return route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type", "access-control-allow-methods": "POST, GET, OPTIONS" } });
    }
    posted.push(JSON.parse(req.postData()));
    return route.fulfill({ status: 201, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: '{"id":"ok"}' });
  });
  await page.route("https://api.acme.test/**", (route) =>
    route.fulfill({ status: 500, body: "nope", headers: { "access-control-allow-origin": "*" } }),
  );

  await page.goto(fixture);
  await page.evaluate((endpoint) => {
    window.FeedbackKit.configure({ projectKey: "pk_e2e", endpoint, appVersion: "2.3.0", appBuild: "45" });
    window.FeedbackKit.currentScreen = "Settings";
    window.FeedbackKit.theme = { primaryColorHex: "#7C3AED" };
    window.FeedbackKit.showFloatingTriggerButton();
    console.error("Failed to save settings", { code: 42, token: "secret-token" });
    fetch("https://api.acme.test/save?session=abc", { method: "POST" }).catch(() => {});
    window.scrollTo(0, 420);
  }, ENDPOINT);
  await page.waitForTimeout(150);

  // ---- 1. full flow: annotate, describe, pick product, send
  await page.locator(".fk-trigger").click();
  const ink = page.locator(".fk-ink");
  await ink.waitFor();
  await page.screenshot({ path: path.join(outDir, `${name}-1-dialog.png`) });
  const box = await ink.boundingBox();
  assert.ok(box && box.width > 200, "canvas laid out");

  // Freehand (default tool)
  await page.mouse.move(box.x + 40, box.y + 40);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(box.x + 40 + i * 8, box.y + 40 + i * 4);
  await page.mouse.up();
  // Arrow
  await page.locator('.fk-tool[aria-label="Arrow"]').click();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.45, { steps: 5 });
  await page.mouse.up();
  // Rectangle in green
  await page.locator('.fk-swatch[aria-label="Color green"]').click();
  await page.locator('.fk-tool[aria-label="Rectangle"]').click();
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.7, { steps: 5 });
  await page.mouse.up();
  // Text note
  await page.locator('.fk-tool[aria-label="Text"]').click();
  await page.mouse.click(box.x + box.width * 0.7, box.y + box.height * 0.6);
  const note = page.locator(".fk-text-input");
  await note.waitFor();
  await note.fill("Nothing happens");
  await note.press("Enter");
  // Undo + redo-by-drawing sanity: undo removes the note, draw it again
  await page.keyboard.press(process.platform === "darwin" ? "Meta+z" : "Control+z");
  await page.locator('.fk-tool[aria-label="Text"]').click();
  await page.mouse.click(box.x + box.width * 0.7, box.y + box.height * 0.6);
  await note.waitFor();
  await note.fill("Nothing happens");
  await note.press("Enter");
  // Move the rectangle and resize it with the wheel
  await page.locator('.fk-tool[aria-label="Move / resize"]').click();
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.6);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.62, { steps: 4 });
  await page.mouse.up();
  await page.mouse.wheel(0, -200);

  await page.locator("#fk-text").fill("Clicking “Save changes” does nothing.");
  await page.locator('.fk-chip:has-text("Backend API")').click();
  await page.screenshot({ path: path.join(outDir, `${name}-2-annotated.png`) });
  await page.locator(".fk-btn-primary").click();
  await page.locator(".fk-done").waitFor();
  await page.screenshot({ path: path.join(outDir, `${name}-3-thanks.png`) });
  await page.locator(".fk-overlay").waitFor({ state: "detached" });

  assert.equal(posted.length, 1, "one POST");
  const p = posted[0];
  assert.equal(p.project_key, "pk_e2e");
  assert.match(p.reporter_id, /^[A-Za-z0-9_-]{16,128}$/, "reports carry the per-browser reporter id");
  assert.match(p.id, /^[0-9a-f-]{36}$/i);
  assert.equal(p.text, "Clicking “Save changes” does nothing.");
  assert.ok(!Number.isNaN(Date.parse(p.created_at)));
  assert.deepEqual(p.product_keys, ["web", "api"]);
  assert.equal(p.products[0].is_default, true);
  const kinds = p.annotations.map((a) => a.kind);
  assert.deepEqual(kinds, ["freehand", "arrow", "rectangle", "text"]);
  for (const a of p.annotations) {
    for (const pt of a.points) {
      assert.ok(Array.isArray(pt) && pt.length === 2, "points are [x, y] tuples like Swift CGPoint");
      assert.ok(pt[0] >= -0.2 && pt[0] <= 1.2 && pt[1] >= -0.2 && pt[1] <= 1.2, "normalized");
    }
  }
  const rect = p.annotations[2];
  assert.equal(rect.colorHex, "#34C759");
  assert.ok(rect.scale > 1, `wheel scaled the rectangle (${rect.scale})`);
  assert.equal(p.annotations[3].label, "Nothing happens");

  const env = p.environment;
  for (const key of ["osName", "osVersion", "deviceModel", "appVersion", "appBuild", "bundleIdentifier", "locale", "screenWidthPoints", "screenHeightPoints", "screenScale"]) {
    assert.ok(key in env, `environment.${key} present (the Portal's Swift decoder requires it)`);
  }
  assert.equal(env.platform, "web");
  assert.equal(env.screenName, "Settings");
  assert.equal(env.appVersion, "2.3.0");
  assert.equal(env.screenWidthPoints, 1280);
  assert.equal(env.screenScale, 2);
  assert.ok(env.pageUrl.startsWith("file://"));

  const logText = p.logs.map((l) => `${l.level}: ${l.message}`).join("\n");
  assert.match(logText, /error: Failed to save settings/);
  assert.doesNotMatch(logText, /secret-token/, "log redaction");
  assert.match(logText, /network: POST https:\/\/api\.acme\.test\/save\?session=%5Bredacted%5D → 500/);
  assert.doesNotMatch(logText, /ingest\.feedbackkit\.test/, "own endpoint not logged");

  const raw = Buffer.from(p.screenshot_raw_png_base64, "base64");
  const annotated = Buffer.from(p.screenshot_annotated_png_base64, "base64");
  assert.equal(raw.subarray(1, 4).toString(), "PNG");
  assert.equal(raw.readUInt32BE(16), 2560, "raw width = viewport × dpr");
  assert.equal(raw.readUInt32BE(20), 1600, "raw height = viewport × dpr");
  assert.equal(annotated.readUInt32BE(16), 2560);
  assert.ok(!raw.equals(annotated), "annotated differs from raw");
  fs.writeFileSync(path.join(outDir, `${name}-raw.png`), raw);
  fs.writeFileSync(path.join(outDir, `${name}-annotated.png`), annotated);

  // ---- 2. screenshot toggled off, logs opted out → no screenshot fields
  await page.locator(".fk-trigger").click();
  await page.locator(".fk-ink").waitFor();
  await page.locator('.fk-switch:has-text("Screenshot")').click();
  await page.locator('.fk-switch:has-text("Include console")').click();
  await page.locator("#fk-text").fill("Text only");
  await page.keyboard.press(process.platform === "darwin" ? "Meta+Enter" : "Control+Enter");
  await page.locator(".fk-overlay").waitFor({ state: "detached" });
  const q = posted[1];
  assert.equal(q.text, "Text only");
  assert.ok(!("screenshot_raw_png_base64" in q) && !("screenshot_annotated_png_base64" in q));
  assert.deepEqual(q.annotations, []);
  assert.ok(!("logs" in q), "logs opted out");

  // ---- 3. Escape cancels; present() resolves null and sends nothing
  const cancelled = page.evaluate(() => window.FeedbackKit.present());
  await page.locator(".fk-ink").waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await cancelled, null);
  assert.equal(posted.length, 2);

  // ---- 4. present() hands back the report without sending
  const local = page.evaluate(async () => {
    const r = await window.FeedbackKit.present();
    return r && { text: r.text, hasShot: r.screenshotRaw instanceof Blob, platform: r.environment.platform };
  });
  await page.locator("#fk-text").fill("local only");
  await page.locator(".fk-btn-primary").click();
  assert.deepEqual(await local, { text: "local only", hasShot: true, platform: "web" });
  assert.equal(posted.length, 2, "present() never POSTs");

  // ---- 5. server error keeps the dialog open with a retry
  await page.unroute(`${ENDPOINT}**`);
  await page.route(`${ENDPOINT}**`, (route) =>
    route.request().method() === "POST"
      ? route.fulfill({ status: 401, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: '{"error":"unknown project_key"}' })
      : route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*" }, body: '{"products":[]}' }),
  );
  await page.locator(".fk-trigger").click();
  await page.locator("#fk-text").fill("will fail");
  await page.locator(".fk-btn-primary").click();
  await page.locator(".fk-error:not([hidden])").waitFor();
  assert.match(await page.locator(".fk-error").textContent(), /unknown project_key/);
  assert.match(await page.locator(".fk-btn-primary").textContent(), /Retry/);
  await page.keyboard.press("Escape");
  await page.locator(".fk-overlay").waitFor({ state: "detached" });

  // ---- 6. the widget itself never appears in its own screenshot, and cleanup works
  await page.evaluate(() => window.FeedbackKit.destroy());
  assert.equal(await page.locator("[data-feedbackkit-root]").count(), 0);
  assert.equal(await page.evaluate(() => document.documentElement.style.overflow), "");

  assert.deepEqual(pageErrors, [], "no uncaught page errors");
  await context.close();
}

async function runFixSuite(name, browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e));
  const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type", "access-control-allow-methods": "POST, GET, OPTIONS" };

  const update = (id, extra) => ({
    feedback_id: id,
    text: `Report ${id}`,
    created_at: "2026-09-25T10:00:00Z",
    fix_stage: "shipped",
    fixed_in_build: "45",
    fix_summary: null,
    needs_verification: true,
    open_question: null,
    screenshot_url: PIXEL,
    messages: [],
    ...extra,
  });
  // What the fake server still has to show; answered items drop off.
  let pending = [
    update("f1", { fix_summary: "The save button works on the first click now.", messages: [{ id: "m", kind: "comment", body: "Thanks for the arrow — made it obvious.", author: "claude-code", created_at: "t" }] }),
    update("f2", { needs_verification: false, fix_stage: "agent_working", open_question: { id: "q", body: "Which browser tab were you in?", created_at: "t" } }),
  ];
  const gets = [];
  const actions = [];
  await page.route(`${UPDATES}**`, async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 200, headers: cors });
    if (req.method() === "GET") {
      gets.push(new URL(req.url()).searchParams);
      return route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify({ updates: pending }) });
    }
    const body = JSON.parse(req.postData());
    actions.push(body);
    pending = pending.filter((u) => u.feedback_id !== body.feedback_id);
    return route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: '{"ok":true}' });
  });
  await page.route(`${ENDPOINT}**`, (route) => route.fulfill({ status: 200, headers: cors, body: '{"products":[]}' }));

  await page.goto(fixture);
  await page.evaluate((endpoint) => {
    window.FeedbackKit.configure({ projectKey: "pk_e2e", endpoint, appBuild: "45", captureLogs: false });
    window.FeedbackKit.theme = { primaryColorHex: "#7C3AED" };
    window.FeedbackKit.showFloatingTriggerButton();
    window.FeedbackKit.enableFixVerification();
  }, ENDPOINT);

  // ---- 1. shipped fix → "Yes, it's fixed"
  const card = page.locator(".fk-fixcard");
  await card.waitFor();
  assert.match(await card.textContent(), /We fixed something you reported/);
  assert.match(await card.textContent(), /Fixed in build 45/);
  assert.match(await card.textContent(), /The save button works on the first click now/);
  assert.match(await card.textContent(), /claude-code/);
  const reporterId = await page.evaluate(() => window.FeedbackKit.reporterId);
  assert.equal(gets[0].get("reporter_id"), reporterId);
  assert.equal(gets[0].get("build"), "45");
  assert.equal(gets[0].get("project_key"), "pk_e2e");
  await page.waitForTimeout(300); // let the card's fade-in finish
  await page.screenshot({ path: path.join(outDir, `${name}-4-fixcard.png`) });
  await card.locator('button:has-text("Yes, it\'s fixed")').click();

  // ---- 2. the next item is a question → reply
  await page.locator('.fk-fixcard:has-text("Which browser tab")').waitFor();
  assert.deepEqual(actions[0], { project_key: "pk_e2e", reporter_id: reporterId, feedback_id: "f1", action: "verify", build: "45" });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, `${name}-5-question.png`) });
  const answer = page.locator(".fk-fixcard textarea");
  await answer.fill("The billing tab");
  await page.locator('.fk-fixcard button:has-text("Send")').click();
  await card.waitFor({ state: "detached" });
  await page.waitForTimeout(100);
  assert.equal(actions[1].action, "reply");
  assert.equal(actions[1].text, "The billing tab");

  // ---- 3. another fix ships → "No, still broken" → capture dialog in reopen mode
  pending = [update("f3", {})];
  await page.evaluate(() => window.FeedbackKit.presentFixUpdatesIfNeeded());
  await card.waitFor();
  await card.locator('button:has-text("No, still broken")').click();
  await page.locator(".fk-ink").waitFor();
  assert.equal(await page.locator("#fk-title").textContent(), "Still broken");
  assert.equal(await page.locator('label[for="fk-text"]').textContent(), "What's still wrong?");
  const ink = await page.locator(".fk-ink").boundingBox();
  await page.mouse.move(ink.x + 30, ink.y + 30);
  await page.mouse.down();
  await page.mouse.move(ink.x + 90, ink.y + 60, { steps: 5 });
  await page.mouse.up();
  await page.locator("#fk-text").fill("Still does nothing on the second section");
  await page.screenshot({ path: path.join(outDir, `${name}-6-still-broken.png`) });
  await page.locator(".fk-btn-primary").click();
  await page.locator(".fk-done").waitFor();
  assert.match(await page.locator(".fk-done").textContent(), /reopened/);
  await page.locator(".fk-overlay").waitFor({ state: "detached" });
  const reopen = actions[2];
  assert.equal(reopen.action, "reopen");
  assert.equal(reopen.feedback_id, "f3");
  assert.equal(reopen.text, "Still does nothing on the second section");
  assert.equal(Buffer.from(reopen.screenshot_annotated_png_base64, "base64").subarray(1, 4).toString(), "PNG");
  assert.equal(reopen.annotations[0].kind, "freehand");

  // ---- 4. "later" (close button) sends nothing and doesn't re-ask this page load
  pending = [update("f4", {})];
  await page.evaluate(() => window.FeedbackKit.presentFixUpdatesIfNeeded());
  await card.waitFor();
  await card.locator(".fk-close").click();
  await card.waitFor({ state: "detached" });
  await page.evaluate(() => window.FeedbackKit.presentFixUpdatesIfNeeded());
  await page.waitForTimeout(200);
  assert.equal(await card.count(), 0, "snoozed for this page load");
  assert.equal(actions.length, 3);

  assert.deepEqual(pageErrors, [], "no uncaught page errors");
  await context.close();
}
