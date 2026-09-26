import { getAuthenticatedClient } from "../supabaseClient.js";
import { fetchReleaseReadiness, resolveProjectId, type ReadinessVerdict } from "../loop.js";

const LABEL: Record<ReadinessVerdict, string> = {
  production: "in production",
  blocked: "BLOCKED — reopened",
  no_fixes: "no fixes",
  waiting: "waiting on reporters",
  ready: "READY to promote",
};

/** `feedbackkit releases` — the dashboard's Releases tab, for the terminal (and agents). */
export async function listReleases(options: { project?: string; limit?: string; json?: boolean }): Promise<void> {
  const client = await getAuthenticatedClient();
  const projectId = await resolveProjectId(client, options.project ?? process.env.FEEDBACKKIT_PROJECT_ID);
  const rows = await fetchReleaseReadiness(client, projectId, Number(options.limit ?? 20));
  if (options.json) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }
  const { count: waiting } = await client
    .from("feedback_items")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("fix_stage", "merged");
  if (waiting) console.log(`${waiting} merged fix(es) waiting for the next build.\n`);
  if (rows.length === 0) {
    console.log("No releases yet.");
    return;
  }
  for (const r of rows) {
    const scope = r.product_key ? ` [${r.product_key}]` : "";
    const counts = `${r.verified}/${r.fixes} verified${r.reopened ? `, ${r.reopened} reopened` : ""}${r.unreachable ? `, ${r.unreachable} can't be asked` : ""}`;
    console.log(`${r.build}${r.version ? ` (${r.version})` : ""}${scope}  ${r.channel}  ${LABEL[r.verdict]}  — ${counts}  ${r.created_at.slice(0, 16).replace("T", " ")}`);
  }
}
