import { getAuthenticatedClient } from "../supabaseClient.js";
import { recordRelease, resolveCommit, resolveProjectId, selectReleaseCandidates } from "../loop.js";

export interface ReleaseOptions {
  build: string;
  version?: string;
  commit?: string;
  product?: string;
  project?: string;
  /** Extra feedback ids to ship regardless of git ancestry. */
  include?: string[];
  dryRun?: boolean;
  cwd?: string;
}

/**
 * `feedbackkit release --build 123` — announces a build, marking every merged
 * fix it contains as shipped. Reporters running that build (or newer) get
 * asked "is it fixed?" in the app. Meant to run from the release script, in
 * the repo, right after the build is uploaded (see scripts/release_testflight.sh).
 */
export async function release(options: ReleaseOptions): Promise<void> {
  const build = options.build.trim();
  if (!build) throw new Error("--build is required.");
  const cwd = options.cwd ?? process.cwd();

  const client = await getAuthenticatedClient();
  const projectId = await resolveProjectId(client, options.project ?? process.env.FEEDBACKKIT_PROJECT_ID);

  const rev = options.commit ?? "HEAD";
  const releaseCommit = resolveCommit(rev, cwd);
  if (!releaseCommit && options.commit) {
    throw new Error(`Couldn't resolve commit "${options.commit}" in ${cwd}.`);
  }
  if (!releaseCommit) {
    console.warn("Not in a git repository — shipping every merged fix without checking it's in this build.");
  }

  const candidates = await selectReleaseCandidates(client, projectId, {
    releaseCommit,
    productKey: options.product,
    cwd,
  });
  const include = new Set((options.include ?? []).map((id) => id.toLowerCase()));
  const shipping = candidates.filter((c) => c.included || include.has(c.item.id)).map((c) => c.item.id);
  for (const id of include) {
    if (!candidates.some((c) => c.item.id === id)) shipping.push(id);
  }

  console.log(`Build ${build}${options.version ? ` (${options.version})` : ""}${releaseCommit ? ` @ ${releaseCommit.slice(0, 7)}` : ""}`);
  if (candidates.length === 0 && include.size === 0) {
    console.log("No merged fixes waiting to ship.");
  }
  for (const c of candidates) {
    const mark = c.included || include.has(c.item.id) ? "ship" : "skip";
    const text = c.item.text.length > 50 ? `${c.item.text.slice(0, 47)}...` : c.item.text;
    console.log(`  ${mark}  ${c.item.id}  ${text}  — ${c.reason}`);
  }

  if (options.dryRun) {
    console.log(`Dry run: would ship ${shipping.length} fix(es).`);
    return;
  }

  // Record the release even with nothing to ship — it's still the build
  // reporters are on, and the dashboard lists it.
  const shipped = await recordRelease(client, {
    projectId,
    build,
    version: options.version,
    commitSha: releaseCommit,
    productKey: options.product,
    feedbackIds: shipping,
  });
  console.log(
    shipped.length > 0
      ? `Shipped ${shipped.length} fix(es). Their reporters will be asked to confirm on build ${build} or newer.`
      : "Release recorded; no fixes shipped.",
  );
}
