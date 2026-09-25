// End-to-end check of the closed loop against a *local* Supabase stack —
// schema (0014_closed_loop.sql), RLS, and the ingest-feedback /
// github-webhook / reporter-updates Edge Functions together.
//
// Not part of `npm test` (it needs Docker). Run it with:
//
//   supabase start && supabase db reset
//   echo GITHUB_WEBHOOK_SECRET=testsecret > /tmp/fk.env
//   supabase functions serve --env-file /tmp/fk.env     # in another terminal
//   cd cli && node --test test/closed-loop.integration.mjs
//
// Reads URL/keys from `supabase status -o json`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHmac, randomUUID, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const status = JSON.parse(execFileSync("supabase", ["status", "-o", "json"], { encoding: "utf8" }));
const API = status.API_URL;
const ANON = status.ANON_KEY;
const SERVICE = status.SERVICE_ROLE_KEY;
const JWT_SECRET = status.JWT_SECRET;
const FUNCTIONS = `${API}/functions/v1`;
const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET ?? "testsecret";

// 1x1 transparent PNG.
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

const admin = createClient(API, SERVICE, { auth: { persistSession: false } });

// Auth is GitHub-OAuth-only (email logins disabled), so mint the session JWT
// the way GoTrue would, with the local stack's JWT secret.
function mintJwt(userId) {
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({
    sub: userId, role: "authenticated", aud: "authenticated", iat: now, exp: now + 3600,
  })}`;
  return `${unsigned}.${createHmac("sha256", JWT_SECRET).update(unsigned).digest("base64url")}`;
}

async function newUser() {
  const email = `loop-${randomUUID()}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: randomBytes(12).toString("hex"), email_confirm: true });
  assert.ifError(error);
  const jwt = mintJwt(data.user.id);
  const client = createClient(API, ANON, { accessToken: async () => jwt });
  return { client, user: data.user };
}

async function waitForOrg(client) {
  for (let i = 0; i < 20; i++) {
    const { data } = await client.from("organizations").select("id").limit(1);
    if (data?.length) return data[0].id;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("no organization created for user");
}

async function webhook(event, payload, { sign = true } = {}) {
  const body = JSON.stringify(payload);
  const headers = { "Content-Type": "application/json", "x-github-event": event };
  if (sign) headers["x-hub-signature-256"] = "sha256=" + createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");
  const res = await fetch(`${FUNCTIONS}/github-webhook`, { method: "POST", headers, body });
  return { status: res.status, body: await res.json() };
}

async function reporter(method, params) {
  if (method === "GET") {
    const url = new URL(`${FUNCTIONS}/reporter-updates`);
    for (const [k, v] of Object.entries(params)) if (v != null) url.searchParams.set(k, v);
    const res = await fetch(url);
    return { status: res.status, body: await res.json() };
  }
  const res = await fetch(`${FUNCTIONS}/reporter-updates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return { status: res.status, body: await res.json() };
}

test("report → PR → merge → release → reporter reopens → reply → release → verified", async () => {
  const { client, user } = await newUser();
  const orgId = await waitForOrg(client);
  const repo = `acme-${randomUUID().slice(0, 8)}/app`;
  const { data: project, error: projectError } = await client
    .from("projects")
    .insert({ organization_id: orgId, name: "Loop", github_repo: repo })
    .select()
    .single();
  assert.ifError(projectError);

  // 1. The SDK files a report carrying its per-install reporter id.
  const reporterId = randomUUID().replace(/-/g, "");
  const feedbackId = randomUUID();
  const ingest = await fetch(`${FUNCTIONS}/ingest-feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      project_key: project.project_key,
      id: feedbackId,
      created_at: new Date().toISOString(),
      text: "Checkout button is cut off",
      screenshot_raw_png_base64: PNG,
      screenshot_annotated_png_base64: PNG,
      annotations: [],
      environment: { osName: "iOS", osVersion: "26.0", deviceModel: "iPhone", appVersion: "1.0", appBuild: "100", bundleIdentifier: "x", locale: "en", screenWidthPoints: 1, screenHeightPoints: 1, screenScale: 1 },
      reporter_id: reporterId,
      reporter: { email: "tester@example.com", bogus: 1 },
    }),
  });
  assert.equal(ingest.status, 201);
  let { data: item } = await client.from("feedback_items").select("*").eq("id", feedbackId).single();
  assert.equal(item.reporter_id, reporterId);
  assert.deepEqual(item.reporter, { email: "tester@example.com" });

  // 2. An agent (acting as the logged-in user) claims it.
  const { error: claimError } = await client.from("feedback_events").insert({
    feedback_id: feedbackId,
    project_id: project.id,
    kind: "claimed",
    actor_type: "agent",
    actor_user_id: user.id,
    actor_label: "Claude Code",
    body: "On it",
  });
  assert.ifError(claimError);
  // …but can't impersonate the reporter.
  const { error: spoofError } = await client.from("feedback_events").insert({
    feedback_id: feedbackId,
    project_id: project.id,
    kind: "verified",
    actor_type: "reporter",
    actor_user_id: user.id,
  });
  assert.ok(spoofError, "members must not be able to write reporter events");

  // 3. Webhook: unsigned deliveries are rejected, signed ones link the PR.
  const pr = { number: 7, html_url: `https://github.com/${repo}/pull/7`, title: "Fix checkout", body: `FeedbackKit: ${feedbackId}`, head: { ref: "fix" } };
  assert.equal((await webhook("pull_request", { action: "opened", pull_request: pr, repository: { full_name: repo } }, { sign: false })).status, 401);
  // A PR in a *different* repo mentioning the same id must not match.
  await webhook("pull_request", { action: "opened", pull_request: pr, repository: { full_name: "someone/else" } });
  ({ data: item } = await client.from("feedback_items").select("*").eq("id", feedbackId).single());
  assert.equal(item.fix_stage, null);

  assert.equal((await webhook("pull_request", { action: "opened", pull_request: pr, repository: { full_name: repo } })).status, 200);
  ({ data: item } = await client.from("feedback_items").select("*").eq("id", feedbackId).single());
  assert.equal(item.fix_stage, "pr_open");
  assert.equal(item.fix_pr_number, 7);
  assert.equal(item.status, "in_progress");

  await webhook("pull_request", {
    action: "closed",
    pull_request: { ...pr, merged: true, merge_commit_sha: "abc123" },
    repository: { full_name: repo.toUpperCase() },
  });
  ({ data: item } = await client.from("feedback_items").select("*").eq("id", feedbackId).single());
  assert.equal(item.fix_stage, "merged");
  assert.equal(item.fix_commit_sha, "abc123");

  // The merged PR's "Fixes #n" closes the issue on GitHub — that must not
  // resolve a report whose reporter hasn't verified the fix yet.
  await admin.from("feedback_items").update({ github_issue_number: 12 }).eq("id", feedbackId);
  await webhook("issues", { action: "closed", issue: { number: 12, html_url: `https://github.com/${repo}/issues/12` }, repository: { full_name: repo } });
  ({ data: item } = await client.from("feedback_items").select("*").eq("id", feedbackId).single());
  assert.equal(item.status, "in_progress", "issue close waits for the reporter");
  assert.equal(item.fix_stage, "merged");

  // 4. Nothing to show the reporter before a release.
  let updates = await reporter("GET", { project_key: project.project_key, reporter_id: reporterId, build: "100" });
  assert.equal(updates.status, 200);
  assert.equal(updates.body.updates.length, 0);

  // 5. `feedbackkit release --build 101` → shipped.
  const { data: shippedIds, error: releaseError } = await client.rpc("record_release", {
    p_project_id: project.id,
    p_build: "101",
    p_version: "1.0.1",
    p_commit_sha: "def456",
    p_product_key: null,
    p_feedback_ids: [feedbackId],
  });
  assert.ifError(releaseError);
  assert.deepEqual(shippedIds, [feedbackId]);

  // Old build: not yet. New build: ask. Another reporter: nothing.
  updates = await reporter("GET", { project_key: project.project_key, reporter_id: reporterId, build: "100" });
  assert.equal(updates.body.updates.length, 0);
  updates = await reporter("GET", { project_key: project.project_key, reporter_id: reporterId, build: "101" });
  assert.equal(updates.body.updates.length, 1);
  assert.equal(updates.body.updates[0].needs_verification, true);
  assert.equal(updates.body.updates[0].fixed_in_build, "101");
  assert.ok(updates.body.updates[0].screenshot_url);
  const other = await reporter("GET", { project_key: project.project_key, reporter_id: randomUUID().replace(/-/g, ""), build: "101" });
  assert.equal(other.body.updates.length, 0);
  assert.equal((await reporter("POST", { project_key: project.project_key, reporter_id: randomUUID().replace(/-/g, ""), feedback_id: feedbackId, action: "verify" })).status, 404);

  // 6. Still broken → reopened, with a fresh screenshot.
  const reopen = await reporter("POST", {
    project_key: project.project_key,
    reporter_id: reporterId,
    feedback_id: feedbackId,
    action: "reopen",
    text: "Still cut off in landscape",
    build: "101",
    screenshot_raw_png_base64: PNG,
    screenshot_annotated_png_base64: PNG,
  });
  assert.equal(reopen.status, 200, JSON.stringify(reopen.body));
  ({ data: item } = await client.from("feedback_items").select("*").eq("id", feedbackId).single());
  assert.equal(item.fix_stage, "reopened");
  assert.equal(item.reopen_count, 1);
  const { data: reopenEvent } = await client.from("feedback_events").select("*").eq("feedback_id", feedbackId).eq("kind", "reopened").single();
  assert.equal(reopenEvent.body, "Still cut off in landscape");
  const { data: signed } = await client.storage.from("feedback-screenshots").createSignedUrl(reopenEvent.data.screenshot_annotated_path, 60);
  assert.ok(signed?.signedUrl, "members can read the reopen screenshot");

  // 7. A question for the reporter shows up on device until answered.
  await client.from("feedback_events").insert({
    feedback_id: feedbackId,
    project_id: project.id,
    kind: "question",
    actor_type: "agent",
    actor_user_id: user.id,
    actor_label: "Claude Code",
    body: "Which iPhone model?",
    visible_to_reporter: true,
  });
  updates = await reporter("GET", { project_key: project.project_key, reporter_id: reporterId, build: "101" });
  assert.equal(updates.body.updates[0].open_question.body, "Which iPhone model?");
  assert.equal(updates.body.updates[0].needs_verification, false);
  assert.equal((await reporter("POST", { project_key: project.project_key, reporter_id: reporterId, feedback_id: feedbackId, action: "reply", text: "iPhone SE" })).status, 200);
  updates = await reporter("GET", { project_key: project.project_key, reporter_id: reporterId, build: "101" });
  assert.equal(updates.body.updates.length, 0);

  // 8. The second fix ships in 102 and the reporter confirms it.
  await client.rpc("record_release", {
    p_project_id: project.id, p_build: "102", p_version: null, p_commit_sha: null, p_product_key: null, p_feedback_ids: [feedbackId],
  });
  const verify = await reporter("POST", { project_key: project.project_key, reporter_id: reporterId, feedback_id: feedbackId, action: "verify", build: "102" });
  assert.equal(verify.status, 200);
  ({ data: item } = await client.from("feedback_items").select("*").eq("id", feedbackId).single());
  assert.equal(item.fix_stage, "verified");
  assert.equal(item.status, "resolved");
  assert.ok(item.verified_at);

  // A verified item isn't re-shipped by a later release.
  const { data: reshipped } = await client.rpc("record_release", {
    p_project_id: project.id, p_build: "103", p_version: null, p_commit_sha: null, p_product_key: null, p_feedback_ids: [feedbackId],
  });
  assert.deepEqual(reshipped, []);

  const { data: kinds } = await client.from("feedback_events").select("kind").eq("feedback_id", feedbackId).order("created_at");
  assert.deepEqual(
    kinds.map((k) => k.kind),
    ["claimed", "pr_opened", "pr_merged", "status_changed", "shipped", "reopened", "question", "reporter_reply", "shipped", "verified"],
  );

  // 9. Tenancy: another user sees none of it.
  const { client: stranger, user: strangerUser } = await newUser();
  const { data: leaked } = await stranger.from("feedback_events").select("id").eq("feedback_id", feedbackId);
  assert.deepEqual(leaked, []);
  const { error: strangerInsert } = await stranger.from("feedback_events").insert({
    feedback_id: feedbackId, project_id: project.id, kind: "comment", actor_type: "user", actor_user_id: strangerUser.id,
  });
  assert.ok(strangerInsert);
});

test("issue close/reopen is scoped to the delivery's repository", async () => {
  const { client } = await newUser();
  const orgId = await waitForOrg(client);
  const repoA = `a-${randomUUID().slice(0, 8)}/app`;
  const repoB = `b-${randomUUID().slice(0, 8)}/app`;
  const { data: pa } = await client.from("projects").insert({ organization_id: orgId, name: "A", github_repo: repoA }).select().single();
  const { data: pb } = await client.from("projects").insert({ organization_id: orgId, name: "B", github_repo: repoB }).select().single();
  const mk = async (projectId) => {
    const id = randomUUID();
    const { error } = await admin.from("feedback_items").insert({ id, project_id: projectId, text: "x", github_issue_number: 5, status: "in_progress" });
    assert.ifError(error);
    return id;
  };
  const a = await mk(pa.id);
  const b = await mk(pb.id);
  await webhook("issues", { action: "closed", issue: { number: 5, html_url: `https://github.com/${repoA}/issues/5` }, repository: { full_name: repoA } });
  const { data: rows } = await admin.from("feedback_items").select("id, status").in("id", [a, b]);
  const byId = Object.fromEntries(rows.map((r) => [r.id, r.status]));
  assert.equal(byId[a], "resolved");
  assert.equal(byId[b], "in_progress");
});

test("agent over MCP → `feedbackkit release` in a git repo → reporter sees the fix", async () => {
  const { mkdtempSync, writeFileSync, mkdirSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
  const { StdioClientTransport } = await import("@modelcontextprotocol/sdk/client/stdio.js");

  const cliEntry = join(dirname(fileURLToPath(import.meta.url)), "..", "dist", "index.js");
  const { client, user } = await newUser();
  const orgId = await waitForOrg(client);
  const { data: project } = await client.from("projects").insert({ organization_id: orgId, name: "MCP" }).select().single();

  const reporterId = randomUUID().replace(/-/g, "");
  const ids = [randomUUID(), randomUUID()];
  for (const id of ids) {
    const { error } = await admin.from("feedback_items").insert({ id, project_id: project.id, text: `bug ${id.slice(0, 4)}`, reporter_id: reporterId });
    assert.ifError(error);
  }
  // Give the first one a real screenshot so get_feedback can return image content.
  const shotPath = `${project.id}/${ids[0]}/annotated.png`;
  await admin.storage.from("feedback-screenshots").upload(shotPath, Buffer.from(PNG, "base64"), { contentType: "image/png" });
  await admin.from("feedback_items").update({ screenshot_annotated_path: shotPath }).eq("id", ids[0]);

  // A throwaway HOME holding CLI credentials for this user, and a git repo
  // with two fix commits: one in the release, one on a branch that isn't.
  const home = mkdtempSync(join(tmpdir(), "fk-home-"));
  mkdirSync(join(home, ".feedbackkit"));
  writeFileSync(join(home, ".feedbackkit", "credentials.json"), JSON.stringify({
    supabaseUrl: API, supabaseAnonKey: ANON, accessToken: mintJwt(user.id), refreshToken: "unused", expiresAt: Math.floor(Date.now() / 1000) + 3600,
  }));
  const repoDir = mkdtempSync(join(tmpdir(), "fk-repo-"));
  const sh = (...args) => execFileSync("git", args, { cwd: repoDir, encoding: "utf8" }).trim();
  sh("init", "-q", "-b", "main");
  sh("-c", "user.email=a@b.c", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "base");
  sh("checkout", "-q", "-b", "later");
  sh("-c", "user.email=a@b.c", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "fix not in release");
  const laterSha = sh("rev-parse", "HEAD");
  sh("checkout", "-q", "main");
  sh("-c", "user.email=a@b.c", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "fix in release");
  const fixSha = sh("rev-parse", "HEAD");

  const env = { ...process.env, HOME: home };
  const transport = new StdioClientTransport({ command: process.execPath, args: [cliEntry, "mcp", "--project", project.id], env });
  const mcp = new Client({ name: "loop-test-agent", version: "1.0.0" });
  await mcp.connect(transport);
  try {
    const call = (name, args) => mcp.callTool({ name, arguments: args });

    const detail = await call("get_feedback", { feedback_id: ids[0] });
    assert.ok(!detail.isError, JSON.stringify(detail));
    assert.ok(detail.content.some((c) => c.type === "image" && c.mimeType === "image/png"), "screenshot returned as image content");

    const prompt = await call("get_prompt", { feedback_id: ids[0] });
    assert.match(prompt.content[0].text, new RegExp(`FeedbackKit: ${ids[0]}`));

    assert.ok(!(await call("claim_feedback", { feedback_id: ids[0], note: "looking" })).isError);
    assert.ok(!(await call("ask_reporter", { feedback_id: ids[0], question: "Portrait or landscape?" })).isError);
    const pngFile = join(home, "after.png");
    writeFileSync(pngFile, Buffer.from(PNG, "base64"));
    assert.ok(!(await call("attach_after_screenshot", { feedback_id: ids[0], png_path: pngFile })).isError);
    assert.ok(!(await call("link_fix", { feedback_id: ids[0], commit_sha: fixSha, summary: "Fixed the clipped button" })).isError);
    assert.ok(!(await call("link_fix", { feedback_id: ids[1], commit_sha: laterSha })).isError);

    const stages = await call("list_feedback", { fix_stage: "merged" });
    assert.equal(JSON.parse(stages.content[0].text).length, 2);

    // Scoping still holds for the new write tools.
    const { data: otherProject } = await client.from("projects").insert({ organization_id: orgId, name: "Other" }).select().single();
    const otherId = randomUUID();
    await admin.from("feedback_items").insert({ id: otherId, project_id: otherProject.id, text: "other" });
    assert.equal((await call("claim_feedback", { feedback_id: otherId })).isError, true);
  } finally {
    await mcp.close();
  }

  const { data: events } = await client.from("feedback_events").select("kind, actor_type, actor_label").eq("feedback_id", ids[0]).order("created_at");
  assert.deepEqual(events.map((e) => e.kind), ["claimed", "question", "after_screenshot", "pr_merged"]);
  assert.ok(events.every((e) => e.actor_type === "agent" && e.actor_label === "loop-test-agent"));

  // `feedbackkit release` ships only the fix that's an ancestor of HEAD.
  const out = execFileSync(process.execPath, [cliEntry, "release", "--build", "500", "--project", project.id], { cwd: repoDir, env, encoding: "utf8" });
  assert.match(out, /Shipped 1 fix/);
  const { data: rows } = await admin.from("feedback_items").select("id, fix_stage, fixed_in_build, fix_summary").in("id", ids);
  const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
  assert.equal(byId[ids[0]].fix_stage, "shipped");
  assert.equal(byId[ids[0]].fixed_in_build, "500");
  assert.equal(byId[ids[1]].fix_stage, "merged");

  // The reporter's device now sees the shipped fix (with the agent's summary)
  // — and the unanswered question stays open until they reply.
  const updates = await reporter("GET", { project_key: project.project_key, reporter_id: reporterId, build: "500" });
  assert.equal(updates.body.updates.length, 1);
  assert.equal(updates.body.updates[0].needs_verification, true);
  assert.equal(updates.body.updates[0].fix_summary, "Fixed the clipped button");
  assert.equal(updates.body.updates[0].open_question.body, "Portrait or landscape?");

  const timeline = execFileSync(process.execPath, [cliEntry, "timeline", ids[0]], { env, encoding: "utf8" });
  assert.match(timeline, /shipped/);
});
