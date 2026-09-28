// End-to-end check of access tokens and after-fix previews against a *local*
// Supabase stack: 0025_access_tokens_and_previews.sql (token RLS, report-
// limited run tokens, the token guard, resolved_at, retention) and the
// attach-preview / cleanup-previews / ci-release Edge Functions, plus the
// CLI's token mode.
//
// Not part of `npm test` (it needs Docker). Run it with:
//
//   supabase start && supabase db reset
//   printf 'MAINTENANCE_SECRET=testmaint\nGITHUB_WEBHOOK_SECRET=testsecret\n' > /tmp/fk.env
//   supabase functions serve --env-file /tmp/fk.env     # in another terminal
//   cd cli && npm run build && node --test test/access-tokens.integration.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHmac, randomUUID, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const status = JSON.parse(execFileSync("supabase", ["status", "-o", "json"], { encoding: "utf8" }));
const API = status.API_URL;
const ANON = status.ANON_KEY;
const PUBLISHABLE = status.PUBLISHABLE_KEY ?? status.ANON_KEY;
const SERVICE = status.SERVICE_ROLE_KEY;
const FUNCTIONS = `${API}/functions/v1`;
const MAINTENANCE_SECRET = process.env.MAINTENANCE_SECRET ?? "testmaint";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
const admin = createClient(API, SERVICE, { auth: { persistSession: false } });

function mintJwt(userId) {
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: userId, role: "authenticated", aud: "authenticated", iat: now, exp: now + 3600 })}`;
  return `${unsigned}.${createHmac("sha256", status.JWT_SECRET).update(unsigned).digest("base64url")}`;
}

async function newMember() {
  const { data, error } = await admin.auth.admin.createUser({
    email: `tokens-${randomUUID()}@example.com`,
    password: randomBytes(12).toString("hex"),
    email_confirm: true,
  });
  assert.ifError(error);
  const jwt = mintJwt(data.user.id);
  return { client: createClient(API, ANON, { accessToken: async () => jwt }), user: data.user, jwt };
}

async function waitForOrg(client) {
  for (let i = 0; i < 20; i++) {
    const { data } = await client.from("organizations").select("id").limit(1);
    if (data?.length) return data[0].id;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("no organization created for user");
}

/** A client that acts as an access token, the way the CLI's token mode does. */
function tokenClient(token) {
  return createClient(API, PUBLISHABLE, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-feedbackkit-token": token } },
  });
}

async function ingest(project, text) {
  const id = randomUUID();
  const res = await fetch(`${FUNCTIONS}/ingest-feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      project_key: project.project_key,
      id,
      created_at: new Date().toISOString(),
      text,
      screenshot_raw_png_base64: PNG.toString("base64"),
      screenshot_annotated_png_base64: PNG.toString("base64"),
      annotations: [],
      environment: { osName: "iOS", osVersion: "26.0", deviceModel: "iPhone", appVersion: "1.0", appBuild: "100", bundleIdentifier: "x", locale: "en", screenWidthPoints: 1, screenHeightPoints: 1, screenScale: 1 },
    }),
  });
  assert.equal(res.status, 201, await res.text());
  return id;
}

function box(type, body) {
  const out = Buffer.alloc(8 + body.length);
  out.writeUInt32BE(out.length, 0);
  out.write(type, 4, "ascii");
  body.copy(out, 8);
  return out;
}

function mp4(seconds) {
  const mvhd = Buffer.alloc(96);
  mvhd.writeUInt32BE(1000, 12);
  mvhd.writeUInt32BE(Math.round(seconds * 1000), 16);
  return Buffer.concat([box("ftyp", Buffer.from("isom\0\0\0\0isom")), box("mdat", Buffer.alloc(64)), box("moov", box("mvhd", mvhd))]);
}

async function attach(feedbackId, bytes, headers) {
  const res = await fetch(`${FUNCTIONS}/attach-preview?feedback_id=${feedbackId}&caption=After&actor_label=test-agent`, {
    method: "POST",
    headers: { apikey: PUBLISHABLE, "Content-Type": "application/octet-stream", ...headers },
    body: bytes,
  });
  return { status: res.status, body: await res.json() };
}

function cli(args, env) {
  return execFileSync(process.execPath, ["dist/index.js", ...args], {
    encoding: "utf8",
    env: { ...process.env, FEEDBACKKIT_API_URL: API, FEEDBACKKIT_ANON_KEY: PUBLISHABLE, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

test("access tokens: scopes, report-limited run tokens, previews, retention", async () => {
  const member = await newMember();
  const orgId = await waitForOrg(member.client);
  // Two projects: past the free plan's limit (0019_plan_limits.sql).
  await admin.from("organization_billing").update({ limits_exempt: true }).eq("organization_id", orgId);
  const mkProject = async (name) => {
    const { data, error } = await member.client.from("projects").insert({ organization_id: orgId, name }).select().single();
    assert.ifError(error);
    return data;
  };
  const project = await mkProject("Tokens");
  const other = await mkProject("Other");
  const reportA = await ingest(project, "Report A");
  const reportB = await ingest(project, "Report B");
  const otherReport = await ingest(other, "Other project's report");

  // --- A member creates tokens; nobody else can.
  const create = (name, scopes, expires = null) =>
    member.client.rpc("create_access_token", { p_project_id: project.id, p_name: name, p_scopes: scopes, p_expires_at: expires });
  const { data: agentToken, error: createError } = await create("runner", ["feedback:read", "feedback:write", "reporter:ask", "previews:write", "tokens:issue"]);
  assert.ifError(createError);
  assert.match(agentToken, /^fkt_[0-9a-f]{48}$/);
  const { data: readToken } = await create("reader", ["feedback:read"]);
  const { data: ciToken } = await create("ci", ["releases:write"]);
  const { error: badScope } = await create("bad", ["everything"]);
  assert.ok(badScope, "unknown scopes are rejected");
  const outsider = await newMember();
  const { error: outsiderError } = await outsider.client.rpc("create_access_token", { p_project_id: project.id, p_name: "x", p_scopes: ["feedback:read"], p_expires_at: null });
  assert.ok(outsiderError, "non-members can't create tokens for the project");
  const { data: listed } = await member.client.from("access_tokens").select("name, scopes, token_hash").eq("project_id", project.id);
  assert.equal(listed.length, 3);
  const { data: outsiderList } = await outsider.client.from("access_tokens").select("id").eq("project_id", project.id);
  assert.equal(outsiderList.length, 0);

  // --- A project token reads its own project only.
  const agent = tokenClient(agentToken);
  const { data: info } = await agent.rpc("access_token_info");
  assert.equal(info.project_id, project.id);
  const { data: agentItems } = await agent.from("feedback_items").select("id");
  assert.deepEqual(new Set(agentItems.map((i) => i.id)), new Set([reportA, reportB]));
  const { data: leaked } = await agent.from("feedback_items").select("id").eq("id", otherReport);
  assert.equal(leaked.length, 0, "no access to another project's reports");
  const { data: projects } = await agent.from("projects").select("id");
  assert.deepEqual(projects.map((p) => p.id), [project.id]);
  const { data: orgs } = await agent.from("organizations").select("id");
  assert.equal(orgs.length, 0);
  const { data: noTokens } = await agent.from("access_tokens").select("id");
  assert.equal(noTokens.length, 0, "tokens can't read the token table");

  // No header, a made-up token, or a revoked one: nothing.
  const { data: anonItems } = await tokenClient("fkt_" + "0".repeat(48)).from("feedback_items").select("id");
  assert.equal(anonItems.length, 0);

  // --- Run tokens: limited to one report, can't issue further tokens.
  const { data: runToken, error: issueError } = await agent.rpc("issue_access_token", { p_feedback_id: reportA, p_ttl_minutes: 30 });
  assert.ifError(issueError);
  const run = tokenClient(runToken);
  const { data: runInfo } = await run.rpc("access_token_info");
  assert.equal(runInfo.feedback_id, reportA);
  assert.deepEqual(runInfo.scopes.sort(), ["feedback:read", "feedback:write", "previews:write", "reporter:ask"]);
  const { data: runItems } = await run.from("feedback_items").select("id");
  assert.deepEqual(runItems.map((i) => i.id), [reportA]);
  const { error: nestedIssue } = await run.rpc("issue_access_token", { p_feedback_id: reportA });
  assert.ok(nestedIssue, "run tokens can't issue tokens");
  const { error: readerIssue } = await tokenClient(readToken).rpc("issue_access_token", { p_feedback_id: reportA });
  assert.ok(readerIssue, "issuing needs tokens:issue");
  const { error: otherIssue } = await agent.rpc("issue_access_token", { p_feedback_id: otherReport });
  assert.ok(otherIssue, "can't issue for another project's report");

  // Screenshots: signed URLs for its own report only.
  const { data: itemA } = await member.client.from("feedback_items").select("*").eq("id", reportA).single();
  const { data: itemB } = await member.client.from("feedback_items").select("*").eq("id", reportB).single();
  const { data: signedA } = await run.storage.from("feedback-screenshots").createSignedUrl(itemA.screenshot_annotated_path, 60);
  assert.ok(signedA?.signedUrl, "run token can sign its report's screenshot");
  const { data: signedB } = await run.storage.from("feedback-screenshots").createSignedUrl(itemB.screenshot_annotated_path, 60);
  assert.equal(signedB, null, "but not another report's");

  // --- Writing: the agent's part of the loop only.
  const event = (kind, extra = {}) => ({
    feedback_id: reportA, project_id: project.id, kind, actor_type: "agent", actor_user_id: null, actor_label: "test-agent", body: "x", ...extra,
  });
  assert.ifError((await run.from("feedback_events").insert(event("claimed"))).error);
  assert.ifError((await run.from("feedback_events").insert(event("question", { visible_to_reporter: true }))).error);
  assert.ok((await run.from("feedback_events").insert(event("verified"))).error, "can't write verified");
  assert.ok((await run.from("feedback_events").insert(event("claimed", { actor_type: "reporter" }))).error, "can't pose as the reporter");
  assert.ok((await run.from("feedback_events").insert(event("claimed", { actor_user_id: member.user.id }))).error, "can't pose as a member");
  assert.ok((await run.from("feedback_events").insert(event("claimed", { feedback_id: reportB }))).error, "can't write to another report");
  const reader = tokenClient(readToken);
  assert.ok((await reader.from("feedback_events").insert(event("claimed"))).error, "feedback:read can't write");

  const upd = await run.from("feedback_items").update({ fix_stage: "agent_working", status: "in_progress" }).eq("id", reportA).select("fix_stage");
  assert.ifError(upd.error);
  assert.equal(upd.data[0].fix_stage, "agent_working");
  const verify = await run.from("feedback_items").update({ fix_stage: "verified" }).eq("id", reportA);
  assert.ok(verify.error, "tokens can't verify");
  const rewrite = await run.from("feedback_items").update({ text: "rewritten" }).eq("id", reportA);
  assert.ok(rewrite.error, "tokens can't rewrite a report");
  const otherUpd = await run.from("feedback_items").update({ fix_stage: "agent_working" }).eq("id", reportB).select("id");
  assert.equal(otherUpd.data.length, 0, "can't update another report");

  // --- Previews through attach-preview.
  const png = await attach(reportA, PNG, { "x-feedbackkit-token": runToken });
  assert.equal(png.status, 200, JSON.stringify(png.body));
  assert.equal(png.body.media_type, "image/png");
  const video = await attach(reportA, mp4(12), { "x-feedbackkit-token": runToken });
  assert.equal(video.status, 200, JSON.stringify(video.body));
  assert.equal(video.body.media_type, "video/mp4");
  assert.equal((await attach(reportA, mp4(45), { "x-feedbackkit-token": runToken })).status, 422, "videos over 30 s are refused");
  assert.equal((await attach(reportA, Buffer.from("<svg/>"), { "x-feedbackkit-token": runToken })).status, 415);
  assert.equal((await attach(reportB, PNG, { "x-feedbackkit-token": runToken })).status, 404, "run token is limited to its report");
  assert.equal((await attach(reportA, PNG, { "x-feedbackkit-token": readToken })).status, 403, "needs previews:write");
  assert.equal((await attach(reportA, PNG, {})).status, 401);
  const byMember = await attach(reportB, PNG, { Authorization: `Bearer ${member.jwt}` });
  assert.equal(byMember.status, 200, JSON.stringify(byMember.body));
  assert.equal((await attach(otherReport, PNG, { Authorization: `Bearer ${outsider.jwt}` })).status, 404);

  const { data: previews } = await member.client.from("feedback_events").select("*").eq("feedback_id", reportA).eq("kind", "after_screenshot").order("created_at");
  assert.equal(previews.length, 2);
  assert.equal(previews[0].data.screenshot_path, previews[0].data.media_path, "images keep screenshot_path for older Portal builds");
  assert.equal(previews[1].data.screenshot_path, undefined, "videos don't");
  assert.equal(previews[1].data.duration_seconds, 12);
  assert.equal(previews[0].actor_user_id, null);

  // --- CLI token mode.
  assert.match(cli(["whoami"], { FEEDBACKKIT_TOKEN: runToken }), /limited to report/);
  assert.match(cli(["timeline", reportA], { FEEDBACKKIT_TOKEN: runToken }), /after_screenshot/);
  const cliIssued = cli(["token", "issue", "--feedback", reportB, "--ttl", "10"], { FEEDBACKKIT_TOKEN: agentToken });
  assert.match(cliIssued, /^fkt_[0-9a-f]{48}$/);

  // --- The MCP tools in token mode (what a CI agent runs).
  {
    const { createMcpServer } = await import("../dist/mcp/server.js");
    const { writeFileSync, mkdtempSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");
    const dir = mkdtempSync(join(tmpdir(), "fk-preview-"));
    writeFileSync(join(dir, "after.png"), PNG);
    writeFileSync(join(dir, "after.mp4"), mp4(5));
    writeFileSync(join(dir, "after.txt"), "nope");
    const saved = { ...process.env };
    Object.assign(process.env, { FEEDBACKKIT_TOKEN: runToken, FEEDBACKKIT_API_URL: API, FEEDBACKKIT_ANON_KEY: PUBLISHABLE });
    try {
      const tools = createMcpServer()._registeredTools;
      const ok = await tools["attach_preview"].handler({ feedback_id: reportA, path: join(dir, "after.mp4"), caption: "Cart after the fix" });
      assert.equal(ok.isError, undefined, JSON.stringify(ok));
      assert.match(ok.content[0].text, /video\/mp4/);
      const alias = await tools["attach_after_screenshot"].handler({ feedback_id: reportA, png_path: join(dir, "after.png") });
      assert.equal(alias.isError, undefined, JSON.stringify(alias));
      assert.equal((await tools["attach_preview"].handler({ feedback_id: reportA, path: join(dir, "after.txt") })).isError, true);
      assert.equal((await tools["attach_preview"].handler({ feedback_id: reportB, path: join(dir, "after.png") })).isError, true, "limited to its report");
      const claim = await tools["claim_feedback"].handler({ feedback_id: reportA, note: "on it" });
      assert.equal(claim.isError, undefined, JSON.stringify(claim));
    } finally {
      for (const k of ["FEEDBACKKIT_TOKEN", "FEEDBACKKIT_API_URL", "FEEDBACKKIT_ANON_KEY"]) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
      }
    }
  }

  // --- ci-release: releases:write only; old fkr_ tokens still work.
  const ciGet = (token) => fetch(`${FUNCTIONS}/ci-release`, { headers: { "x-release-token": token } });
  assert.equal((await ciGet(ciToken)).status, 200);
  assert.equal((await ciGet(agentToken)).status, 403);
  const { data: legacy } = await member.client.rpc("create_release_token", { p_project_id: project.id, p_name: "legacy" });
  assert.match(legacy, /^fkr_/);
  assert.equal((await ciGet(legacy)).status, 200);
  const { data: legacyView } = await member.client.from("release_tokens").select("name").eq("project_id", project.id);
  assert.deepEqual(legacyView.map((r) => r.name).sort(), ["ci", "legacy"]);

  // --- Revoking a parent kills its run tokens; expiry is enforced.
  const { data: agentRow } = await member.client.from("access_tokens").select("id").eq("name", "runner").single();
  await member.client.from("access_tokens").update({ revoked_at: new Date().toISOString() }).eq("id", agentRow.id);
  assert.equal((await run.rpc("access_token_info")).data, null, "run token dies with its parent");
  assert.equal((await agent.from("feedback_items").select("id")).data.length, 0);
  const { data: soon } = await create("expiring", ["feedback:read"], new Date(Date.now() + 60_000).toISOString());
  await admin.from("access_tokens").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("name", "expiring").eq("project_id", project.id);
  assert.equal((await tokenClient(soon).rpc("access_token_info")).data, null, "expired tokens don't work");

  // --- resolved_at follows the report, and drives retention.
  await member.client.from("feedback_items").update({ status: "resolved" }).eq("id", reportA);
  let { data: resolved } = await member.client.from("feedback_items").select("resolved_at").eq("id", reportA).single();
  assert.ok(resolved.resolved_at);
  await member.client.from("feedback_items").update({ status: "in_progress" }).eq("id", reportA);
  ({ data: resolved } = await member.client.from("feedback_items").select("resolved_at").eq("id", reportA).single());
  assert.equal(resolved.resolved_at, null, "reopening clears it");
  await member.client.from("feedback_items").update({ status: "resolved" }).eq("id", reportA);
  await admin.from("feedback_items").update({ resolved_at: new Date(Date.now() - 15 * 86400e3).toISOString() }).eq("id", reportA);

  const cleanup = (secret) => fetch(`${FUNCTIONS}/cleanup-previews`, { method: "POST", headers: secret ? { "x-maintenance-secret": secret } : {} });
  assert.equal((await cleanup()).status, 401);
  assert.equal((await cleanup("wrong")).status, 401);
  const cleaned = await cleanup(MAINTENANCE_SECRET);
  const cleanedBody = await cleaned.json();
  assert.equal(cleaned.status, 200, JSON.stringify(cleanedBody));
  assert.ok(cleanedBody.expired >= 4);
  const { data: after } = await member.client.from("feedback_events").select("data").eq("feedback_id", reportA).eq("kind", "after_screenshot");
  for (const e of after) {
    assert.ok(e.data.expired_at);
    assert.equal(e.data.media_path, undefined);
  }
  const { data: gone } = await admin.storage.from("feedback-screenshots").list(`${project.id}/${reportA}/after`);
  assert.equal(gone.length, 0, "files removed");
  const { data: kept } = await member.client.from("feedback_events").select("data").eq("feedback_id", reportB).eq("kind", "after_screenshot");
  assert.ok(kept[0].data.media_path, "unresolved report's preview is kept");
});
