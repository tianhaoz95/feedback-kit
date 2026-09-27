#!/usr/bin/env node
// Prints FeedbackKit's product analytics from the hosted project: the
// activation funnel (organizations → project → first report → agent → linked
// fix → announced build → reporter-verified fix), active users, top events
// and pages. See supabase/migrations/0020_analytics.sql.
//
//   node scripts/analytics_report.mjs [days=30]
//
// Uses SUPABASE_SERVICE_ROLE_KEY if set, else asks the logged-in Supabase CLI
// for it (`supabase login`). SUPABASE_PROJECT_REF overrides the project.
import { execFileSync } from "node:child_process";

const ref = process.env.SUPABASE_PROJECT_REF ?? "gpucoladcyvijefdjudf";
const days = Number(process.argv[2] ?? 30);
let key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) {
  const keys = JSON.parse(execFileSync("supabase", ["projects", "api-keys", "--project-ref", ref, "-o", "json"], { encoding: "utf8" }));
  key = keys.find((k) => k.name === "service_role")?.api_key;
}
if (!key) throw new Error("No service role key: set SUPABASE_SERVICE_ROLE_KEY or run `supabase login`.");

const since = new Date(Date.now() - days * 864e5).toISOString();
const res = await fetch(`https://${ref}.supabase.co/rest/v1/rpc/analytics_funnel`, {
  method: "POST",
  headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  body: JSON.stringify({ p_since: since }),
});
if (!res.ok) throw new Error(`analytics_funnel: ${res.status} ${await res.text()}`);
const r = await res.json();

const f = r.funnel;
const pct = (n) => (f.organizations ? ` (${Math.round((100 * n) / f.organizations)}%)` : "");
console.log(`FeedbackKit analytics — last ${days} days (since ${since.slice(0, 10)})\n`);
console.log(`Signups: ${r.signups}`);
console.log(`Active users: ${r.active_users_7d} (7d), ${r.active_users_30d} (30d); visitor sessions (30d): ${r.visitor_sessions_30d}\n`);
console.log("Activation funnel (organizations created in the window):");
for (const [label, n] of [
  ["Organizations", f.organizations],
  ["Created a project", f.created_project],
  ["Received a report", f.received_report],
  ["Sent a report to an agent", f.sent_to_agent],
  ["Linked a fix", f.linked_fix],
  ["Announced a build", f.announced_build],
  ["Reporter verified a fix", f.reporter_verified],
]) console.log(`  ${label.padEnd(28)} ${String(n).padStart(5)}${label === "Organizations" ? "" : pct(n)}`);
console.log("\nTop events (30d):");
for (const [name, n] of Object.entries(r.events_30d)) console.log(`  ${name.padEnd(28)} ${String(n).padStart(5)}`);
console.log("\nTop pages (30d):");
for (const [path, n] of Object.entries(r.top_pages_30d)) console.log(`  ${path.padEnd(40)} ${String(n).padStart(5)}`);
