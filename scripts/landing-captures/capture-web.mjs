// Captures web/src/assets/demo-web-feedback.webp's source PNG: the web SDK's
// dialog over store.html, with a rectangle around the first "Add to cart"
// button, a description, and "Notify me" on from the + menu.
// Usage: node capture-web.mjs <out.png>   (after `cd web-sdk && npm run build`)
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
// Playwright is one of web-sdk's dev dependencies.
const { chromium } = createRequire(join(here, "../../web-sdk/package.json"))("playwright");
const out = process.argv[2] ?? join(here, "web.png");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 891 }, deviceScaleFactor: 2 });
await page.goto(`file://${join(here, "store.html")}`);
await page.waitForTimeout(500);
// The button's place in the viewport, before the dialog covers the page.
const btn = await page.evaluate(() => {
  const r = document.getElementById("first-add").getBoundingClientRect();
  return { x: r.x / innerWidth, y: r.y / innerHeight, w: r.width / innerWidth, h: r.height / innerHeight };
});
await page.evaluate(() => {
  window.FeedbackKit.configure({ projectKey: "pk_demo", endpoint: "https://example.invalid" });
  window.FeedbackKit.present();
});
await page.locator(".fk-ink").waitFor();
await page.waitForTimeout(800);
await page.getByRole("button", { name: "Rectangle" }).click();
const ink = await page.locator(".fk-ink").boundingBox();
const pad = 6;
await page.mouse.move(ink.x + btn.x * ink.width - pad, ink.y + btn.y * ink.height - pad);
await page.mouse.down();
await page.mouse.move(ink.x + (btn.x + btn.w) * ink.width + pad, ink.y + (btn.y + btn.h) * ink.height + pad, { steps: 12 });
await page.mouse.up();
await page.locator("#fk-text").fill("Add to cart does nothing on the headphones");
await page.locator(".fk-plus").click();
await page.locator('.fk-menu-item:has-text("Notify me")').click();
await page.locator("#fk-text").evaluate((el) => el.blur());
await page.waitForTimeout(400);
const box = await page.locator(".fk-dialog").boundingBox();
const m = 8;
await page.screenshot({ path: out, clip: { x: box.x - m, y: box.y - m, width: box.width + 2 * m, height: box.height + 2 * m } });
await browser.close();
