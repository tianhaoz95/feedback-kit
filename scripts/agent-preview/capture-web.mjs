#!/usr/bin/env node
// Captures the dashboard/website (web/) as it is in this working tree, at
// the page a FeedbackKit report was filed from, and optionally attaches the
// PNG to that report as an after-fix preview (attach-preview, shown in the
// report's timeline and After view).
//
// Coding agents run it after fixing a web report (the agent workflows'
// prompts say so), and `.github/workflows/feedbackkit-agent-antigravity.yml`
// runs it as a fallback when the agent didn't attach anything.
//
//   node scripts/agent-preview/capture-web.mjs --feedback <id> [--attach] [--caption "…"]
//   node scripts/agent-preview/capture-web.mjs --path /docs/agents --out /tmp/after.png
//
// Options:
//   --feedback <id>   Report to read (needs FEEDBACKKIT_TOKEN: a run token for it, or any
//                     token with feedback:read); its page URL picks the route.
//   --report-file <f> A report as JSON ({ item, events?, project? }) instead of --feedback's
//                     hosted one, e.g. for testing this script.
//   --path <route>    Route to open instead, e.g. "/projects/<id>?feedback=<id>" or a full URL.
//   --out <file.png>  Where to write it (default: a temp file, printed on stdout).
//   --attach          Attach it to --feedback (the token needs previews:write).
//   --caption <text>  Caption for --attach.
//   --since <iso>     With --attach: skip if the report already got a preview after this time.
//   --width/--height  Viewport (default 1440×900).
//
// Public pages (landing, docs, legal, login) render straight from `vite`.
// Signed-in pages need a backend, and this never gives the page a real
// session: it starts a throwaway local Supabase stack (its own project id and
// ports, so a developer's `supabase start` stack is untouched), applies this
// tree's migrations, copies in just this one report (same ids, so the route
// resolves), and signs in as a local preview user. Needs Docker and the
// Supabase CLI for that. Exit code 3 means there was nothing to capture
// (e.g. a native app report, or already attached).
import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer as createNetServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomBytes } from "node:crypto";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const WEB = join(ROOT, "web");
const WEB_SDK = join(ROOT, "web-sdk");

// Same defaults as cli/src/supabaseClient.ts (the hosted backend's public URL and publishable key).
const API_URL = (process.env.FEEDBACKKIT_API_URL ?? "https://gpucoladcyvijefdjudf.supabase.co").replace(/\/+$/, "");
const ANON_KEY = process.env.FEEDBACKKIT_ANON_KEY ?? "sb_publishable_crkqEdaacVS02etk6k16ag_ATIk-8Kn";
const TOKEN = process.env.FEEDBACKKIT_TOKEN?.trim() || null;

/** A dependency from web/ or web-sdk/ node_modules (CommonJS or ESM). */
async function importFrom(dir, name) {
  const mod = await import(pathToFileURL(createRequire(join(dir, "package.json")).resolve(name)).href);
  return mod.default && !Object.keys(mod).some((k) => k !== "default" && k !== "module.exports") ? mod.default : { ...mod.default, ...mod };
}

const PUBLIC_ROUTES = [/^\/$/, /^\/docs(\/|$)/, /^\/privacy$/, /^\/terms$/, /^\/login$/, /^\/invite\//];
const SKIP = 3;

function parseArgs(argv) {
  const args = { width: 1440, height: 900 };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    const value = () => {
      const v = argv[++i];
      if (v === undefined) fail(`${key} needs a value`);
      return v;
    };
    if (key === "--feedback") args.feedback = value();
    else if (key === "--path") args.path = value();
    else if (key === "--report-file") args.reportFile = resolve(value());
    else if (key === "--out") args.out = resolve(value());
    else if (key === "--attach") args.attach = true;
    else if (key === "--caption") args.caption = value();
    else if (key === "--since") args.since = value();
    else if (key === "--width") args.width = Number(value());
    else if (key === "--height") args.height = Number(value());
    else if (key === "--help" || key === "-h") {
      console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").filter((l) => l.startsWith("//")).join("\n"));
      process.exit(0);
    } else fail(`Unknown option ${key}`);
  }
  if (!args.feedback && !args.path && !args.reportFile) fail("Pass --feedback <id> or --path <route>.");
  if (args.attach && !args.feedback) fail("--attach needs --feedback.");
  return args;
}

function fail(message, code = 1) {
  console.error(`capture-web: ${message}`);
  process.exit(code);
}

function log(message) {
  console.error(`capture-web: ${message}`);
}

// ---- The hosted report (read with the FeedbackKit token) ----------------------

async function hosted(path, init = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { apikey: ANON_KEY, "x-feedbackkit-token": TOKEN, ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${path.split("?")[0]}: ${res.status} ${await res.text()}`);
  return res;
}

async function fetchReport(id) {
  if (!TOKEN) fail("--feedback needs FEEDBACKKIT_TOKEN (a FeedbackKit access token that can read the report).");
  const [item] = await (await hosted(`/rest/v1/feedback_items?id=eq.${id}&select=*`)).json();
  if (!item) fail(`Report ${id} not found (or the token can't read it).`);
  const events = await hosted(`/rest/v1/feedback_events?feedback_id=eq.${id}&select=*&order=created_at`)
    .then((r) => r.json())
    .catch(() => []);
  const project = await hosted(`/rest/v1/projects?id=eq.${item.project_id}&select=id,name`)
    .then((r) => r.json())
    .then((rows) => rows[0] ?? null)
    .catch(() => null);
  const images = {};
  for (const path of [item.screenshot_raw_path, item.screenshot_annotated_path].filter(Boolean)) {
    try {
      const { signedURL } = await (
        await hosted(`/storage/v1/object/sign/feedback-screenshots/${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expiresIn: 300 }),
        })
      ).json();
      const res = await fetch(`${API_URL}/storage/v1${signedURL}`);
      if (res.ok) images[path] = new Uint8Array(await res.arrayBuffer());
    } catch {
      // The viewer shows a placeholder instead; the page itself is what matters.
    }
  }
  return { item, events, project, images };
}

async function attach(id, png, caption) {
  const url = new URL(`${API_URL}/functions/v1/attach-preview`);
  url.searchParams.set("feedback_id", id);
  url.searchParams.set("actor_label", process.env.FEEDBACKKIT_ACTOR_LABEL ?? "Coding agent");
  url.searchParams.set("actor_type", "agent");
  if (caption) url.searchParams.set("caption", caption);
  const res = await hosted(`${url.pathname}${url.search}`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: png,
  });
  return res.json();
}

// ---- A throwaway local backend for signed-in pages ---------------------------

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { encoding: "utf8", ...options });
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed:\n${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

/**
 * This tree's supabase/ in a temp dir with its own project id and ports
 * (543xx → 553xx), email sign-in on (only the preview user can use it, and
 * only on this machine), and the services a page doesn't need left out.
 */
function isolatedSupabase() {
  const dir = mkdtempSync(join(tmpdir(), "fk-preview-"));
  cpSync(join(ROOT, "supabase"), join(dir, "supabase"), {
    recursive: true,
    filter: (src) => !/[\\/](\.temp|\.branches|functions)([\\/]|$)/.test(src.slice(ROOT.length)),
  });
  const configPath = join(dir, "supabase", "config.toml");
  let config = readFileSync(configPath, "utf8");
  config = config.replace(/^project_id = ".*"$/m, `project_id = "fk-preview-${randomBytes(3).toString("hex")}"`);
  config = config.replace(/^(\s*(?:port|shadow_port|smtp_port|pop3_port|inspector_port) = )54(\d{3})$/gm, "$155$2");
  config = config.replace(/(\[auth\.email\][^[]*?enable_signup = )false/, "$1true");
  config = config.replace(/(\[db\.seed\][^[]*?enabled = )true/, "$1false");
  writeFileSync(configPath, config);
  return dir;
}

async function startBackend() {
  if (spawnSync("supabase", ["--version"]).status !== 0) {
    throw new Error("Signed-in pages need the Supabase CLI (and Docker) to run a throwaway backend.");
  }
  const workdir = isolatedSupabase();
  const stop = () => {
    spawnSync("supabase", ["stop", "--no-backup", "--workdir", workdir], { stdio: "ignore" });
    rmSync(workdir, { recursive: true, force: true });
  };
  try {
    log("starting a throwaway local Supabase stack (first run pulls Docker images)…");
    run("supabase", [
      "start",
      "--workdir",
      workdir,
      "-x",
      "studio,imgproxy,mailpit,logflare,vector,supavisor,edge-runtime,postgres-meta,realtime",
    ]);
    const status = JSON.parse(run("supabase", ["status", "-o", "json", "--workdir", workdir]));
    return { url: status.API_URL, anonKey: status.ANON_KEY, serviceKey: status.SERVICE_ROLE_KEY, stop };
  } catch (err) {
    stop();
    throw err;
  }
}

/** Inserts a row, dropping columns this tree's schema doesn't have (a newer hosted schema). */
async function insertLenient(client, table, row) {
  let data = { ...row };
  for (let i = 0; i < 20; i++) {
    const { error } = await client.from(table).insert(data);
    if (!error) return;
    const missing = /Could not find the '([^']+)' column/.exec(error.message)?.[1];
    if (!missing || !(missing in data)) throw new Error(`${table}: ${error.message}`);
    delete data[missing];
  }
}

/** One organization, project and report (same ids as the hosted ones) for a local preview user. */
async function seed(backend, report) {
  const { createClient } = await importFrom(WEB, "@supabase/supabase-js");
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const admin = createClient(backend.url, backend.serviceKey, options);
  const email = "preview@feedbackkit.local";
  const password = randomBytes(18).toString("hex");
  const { error: userError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { user_name: "preview", full_name: "Preview" },
  });
  if (userError) throw new Error(`preview user: ${userError.message}`);
  const anon = createClient(backend.url, backend.anonKey, options);
  const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`preview sign-in: ${signInError.message}`);
  const session = signIn.session;

  if (report) {
    const user = createClient(backend.url, backend.anonKey, {
      ...options,
      global: { headers: { Authorization: `Bearer ${session.access_token}` } },
    });
    const { data: orgId, error: orgError } = await user.rpc("create_organization", { p_name: "Preview" });
    if (orgError) throw new Error(`organization: ${orgError.message}`);
    const { item, events, project, images } = report;
    // The hosted read only has id/name; a --report-file project may carry more (e.g. dispatch settings).
    await insertLenient(admin, "projects", { name: "Preview project", ...project, id: item.project_id, organization_id: orgId });
    await insertLenient(admin, "feedback_items", item);
    for (const event of events) {
      await insertLenient(admin, "feedback_events", { ...event, actor_user_id: null }).catch((err) => log(`skipped an event: ${err.message}`));
    }
    for (const [path, bytes] of Object.entries(images)) {
      await admin.storage.from("feedback-screenshots").upload(path, bytes, { contentType: "image/png", upsert: true });
    }
  }
  return session;
}

// ---- Render and capture -------------------------------------------------------

function ensureDependencies() {
  for (const dir of [WEB, WEB_SDK]) {
    if (!existsSync(join(dir, "node_modules"))) {
      log(`installing ${dir.slice(ROOT.length + 1)}/ dependencies…`);
      run("npm", ["ci", "--no-audit", "--no-fund"], { cwd: dir });
    }
  }
  // Playwright comes from web-sdk (its e2e); make sure its Chromium is there.
  run("npx", ["playwright", "install", "chromium"], { cwd: WEB_SDK });
}

function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createNetServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolvePort(port));
    });
  });
}

async function capture({ route, backend, session, width, height, out }) {
  // The page talks to the throwaway backend only; the FeedbackKit token and
  // anything else FEEDBACKKIT_* never reach the dev server.
  const env = {
    ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("FEEDBACKKIT_"))),
    VITE_SUPABASE_URL: backend?.url ?? "http://127.0.0.1:9",
    VITE_SUPABASE_ANON_KEY: backend?.anonKey ?? "preview",
    VITE_FEEDBACKKIT_PROJECT_KEY: "",
  };
  const port = await freePort();
  const vite = spawn("npx", ["vite", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
    cwd: WEB,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let viteOutput = "";
  vite.stdout.on("data", (d) => (viteOutput += d));
  vite.stderr.on("data", (d) => (viteOutput += d));
  const origin = `http://127.0.0.1:${port}`;
  try {
    for (let i = 0; ; i++) {
      if (vite.exitCode !== null) throw new Error(`vite exited:\n${viteOutput}`);
      if (await fetch(origin).then((r) => r.ok).catch(() => false)) break;
      if (i > 120) throw new Error(`vite didn't start:\n${viteOutput}`);
      await new Promise((r) => setTimeout(r, 500));
    }
    const { chromium } = await importFrom(WEB_SDK, "playwright");
    const browser = await chromium.launch();
    try {
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
      if (session && backend) {
        // supabase-js's default storage key: sb-<first label of the API host>-auth-token.
        const key = `sb-${new URL(backend.url).hostname.split(".")[0]}-auth-token`;
        await context.addInitScript(([k, v]) => localStorage.setItem(k, v), [key, JSON.stringify(session)]);
      }
      const page = await context.newPage();
      await page.goto(`${origin}${route}`, { waitUntil: "networkidle", timeout: 90_000 });
      // Signed-in pages fetch after auth resolves, and images/fonts settle after that.
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1500);
      if (new URL(page.url()).pathname === "/login" && !route.startsWith("/login")) {
        throw new Error(`${route} redirected to /login: the preview session wasn't accepted.`);
      }
      await page.screenshot({ path: out });
    } finally {
      await browser.close();
    }
  } finally {
    vite.kill("SIGTERM");
  }
}

function routeFrom(value) {
  if (!value) return null;
  try {
    const url = new URL(value, "http://placeholder");
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = args.reportFile
    ? { events: [], project: null, images: {}, ...JSON.parse(readFileSync(args.reportFile, "utf8")) }
    : args.feedback
    ? await fetchReport(args.feedback)
    : null;

  if (args.attach && args.since && report) {
    const since = Date.parse(args.since);
    const already = report.events.some((e) => e.kind === "after_screenshot" && Date.parse(e.created_at) >= since);
    if (already) {
      log("the report already has a preview from this run; nothing to do.");
      process.exit(SKIP);
    }
  }

  const route = routeFrom(args.path ?? report?.item.environment?.pageUrl);
  if (!route) {
    log("the report has no web page URL (not a web report?); pass --path to pick a route.");
    process.exit(SKIP);
  }
  const needsBackend = !PUBLIC_ROUTES.some((re) => re.test(route.split(/[?#]/)[0]));
  const out = args.out ?? join(mkdtempSync(join(tmpdir(), "fk-capture-")), "after.png");

  ensureDependencies();
  const backend = needsBackend ? await startBackend() : null;
  try {
    const session = backend ? await seed(backend, report) : null;
    log(`capturing ${route}…`);
    await capture({ route, backend, session, width: args.width, height: args.height, out });
  } finally {
    backend?.stop();
  }
  console.log(out);

  if (args.attach) {
    const result = await attach(args.feedback, readFileSync(out), args.caption ?? `After the fix: ${route.split(/[?#]/)[0]}`);
    log(`attached (${result.media_type ?? "image"}).`);
  }
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
