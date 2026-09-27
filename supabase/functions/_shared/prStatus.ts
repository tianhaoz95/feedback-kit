// The "FeedbackKit" commit status on a pull request, for projects that deliver
// fixes on branches (projects.delivery_mode = 'branch', 0024_delivery_modes.sql):
// pending until every report the PR fixes is verified on a preview build,
// success once they all are, failure while one is reopened as still broken.
// Branch protection can require it, so a fix merges only after it's verified.
//
// Called by github-webhook (a PR opened / pushed to), ci-release (a preview
// build shipped), reporter-updates (the reporter verified or reopened) and
// pr-status (the team pressed "Mark verified"). Always best effort: GitHub
// errors are logged, never thrown, so they can't fail the caller.
import { getProjectInstallationToken, githubRequest } from "./github.ts";

const DASHBOARD_URL = Deno.env.get("DASHBOARD_URL") ?? "https://feedback-kit.hejitech.workers.dev";

export interface PrVerification {
  state: "pending" | "success" | "failure";
  description: string;
}

/** What the status says, from the stages of the reports linked to the PR. Pure, for tests. */
export function prVerification(stages: Array<string | null>): PrVerification | null {
  if (stages.length === 0) return null;
  const total = stages.length;
  const verified = stages.filter((s) => s === "verified").length;
  const reopened = stages.filter((s) => s === "reopened").length;
  const noun = total === 1 ? "report" : "reports";
  if (reopened > 0) {
    return { state: "failure", description: `${reopened} of ${total} ${noun} still broken on the preview` };
  }
  if (verified === total) {
    return { state: "success", description: total === 1 ? "Report verified" : `All ${total} reports verified` };
  }
  const shipped = stages.filter((s) => s === "shipped").length;
  return {
    state: "pending",
    description: shipped > 0
      ? `${verified}/${total} ${noun} verified; waiting on the preview check`
      : `${verified}/${total} ${noun} verified; ship a preview build to check it`,
  };
}

// deno-lint-ignore no-explicit-any
type Client = any;

export async function syncPrStatus(adminClient: Client, projectId: string, prNumber: number): Promise<void> {
  try {
    const { data: project } = await adminClient.from("projects").select("*").eq("id", projectId).maybeSingle();
    if (!project || project.delivery_mode !== "branch" || !project.github_repo) return;

    const { data: items } = await adminClient
      .from("feedback_items")
      .select("id, fix_stage")
      .eq("project_id", projectId)
      .eq("fix_pr_number", prNumber)
      .eq("is_archived", false);
    const verification = prVerification((items ?? []).map((i: { fix_stage: string | null }) => i.fix_stage));
    if (!verification) return;

    const token = await getProjectInstallationToken(adminClient, project);
    if (!token) return;
    // The PR's current head, so the status lands on the commit GitHub checks.
    const prRes = await githubRequest(token, "GET", `/repos/${project.github_repo}/pulls/${prNumber}`);
    if (!prRes.ok) return;
    const pr = await prRes.json();
    if (pr.state !== "open" || !pr.head?.sha) return;

    const res = await githubRequest(token, "POST", `/repos/${project.github_repo}/statuses/${pr.head.sha}`, {
      state: verification.state,
      context: "FeedbackKit",
      description: verification.description.slice(0, 140),
      target_url: `${DASHBOARD_URL}/projects/${projectId}`,
    });
    if (!res.ok) {
      // Most often: the GitHub App lacks "Commit statuses: Read and write".
      console.warn(`FeedbackKit PR status failed (${res.status}):`, await res.text());
    }
  } catch (err) {
    console.warn("syncPrStatus failed:", err);
  }
}
