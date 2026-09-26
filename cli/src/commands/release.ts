import { getAuthenticatedClient } from "../supabaseClient.js";
import {
  CiReleaseClient,
  DEFAULT_API_URL,
  classifyReleaseCandidates,
  recordRelease,
  resolveCommit,
  resolveProjectId,
  selectReleaseCandidates,
  type CandidateItem,
  type ReleaseCandidate,
  type ReleaseChannel,
} from "../loop.js";

export interface ReleaseOptions {
  build: string;
  version?: string;
  commit?: string;
  product?: string;
  project?: string;
  channel?: string;
  /** Project release token (CI). Falls back to FEEDBACKKIT_RELEASE_TOKEN. */
  token?: string;
  apiUrl?: string;
  /** Extra feedback ids to ship regardless of git ancestry. */
  include?: string[];
  dryRun?: boolean;
  cwd?: string;
}

/**
 * `feedbackkit release --build 123` — announces a build, marking every merged
 * fix it contains as shipped. Reporters running that build (or newer) get
 * asked "is it fixed?" in the app.
 *
 * Two ways to authenticate:
 *   - a `feedbackkit login` session (a developer's machine), or
 *   - a project release token (`--token` / FEEDBACKKIT_RELEASE_TOKEN) — what
 *     CI uses on every push to main, since a CI job has no dashboard session.
 * Either way, deciding *which* fixes are in the build happens here, in the
 * git checkout (CI: `actions/checkout` with `fetch-depth: 0`).
 */
export async function release(options: ReleaseOptions): Promise<void> {
  const build = options.build.trim();
  if (!build) throw new Error("--build is required.");
  const channel = parseChannel(options.channel);
  const cwd = options.cwd ?? process.cwd();

  const rev = options.commit ?? "HEAD";
  const releaseCommit = resolveCommit(rev, cwd);
  if (!releaseCommit && options.commit) {
    throw new Error(`Couldn't resolve commit "${options.commit}" in ${cwd}.`);
  }
  if (!releaseCommit) {
    console.warn("Not in a git repository — shipping every merged fix without checking it's in this build.");
  }

  const token = options.token ?? process.env.FEEDBACKKIT_RELEASE_TOKEN;
  const include = new Set((options.include ?? []).map((id) => id.toLowerCase()));

  let items: CandidateItem[];
  let record: (feedbackIds: string[]) => Promise<string[]>;
  let classify: (items: CandidateItem[]) => ReleaseCandidate[];

  if (token) {
    const ci = new CiReleaseClient(token, options.apiUrl ?? process.env.FEEDBACKKIT_API_URL ?? DEFAULT_API_URL);
    const { project, candidates } = await ci.candidates();
    console.log(`Project: ${project.name} (release token)`);
    items = candidates;
    classify = (list) => classifyReleaseCandidates(list, { releaseCommit, productKey: options.product, cwd });
    record = async (feedbackIds) =>
      (await ci.record({ build, version: options.version, commitSha: releaseCommit, productKey: options.product, channel, feedbackIds })).shipped;
  } else {
    const client = await getAuthenticatedClient();
    const projectId = await resolveProjectId(client, options.project ?? process.env.FEEDBACKKIT_PROJECT_ID);
    const candidates = await selectReleaseCandidates(client, projectId, { releaseCommit, productKey: options.product, cwd });
    items = candidates.map((c) => c.item);
    classify = () => candidates;
    record = (feedbackIds) =>
      recordRelease(client, {
        projectId,
        build,
        version: options.version,
        commitSha: releaseCommit,
        productKey: options.product,
        channel,
        feedbackIds,
      });
  }

  const candidates = classify(items);
  const shipping = candidates.filter((c) => c.included || include.has(c.item.id)).map((c) => c.item.id);
  for (const id of include) {
    if (!candidates.some((c) => c.item.id === id)) shipping.push(id);
  }

  console.log(
    `Build ${build}${options.version ? ` (${options.version})` : ""}${releaseCommit ? ` @ ${releaseCommit.slice(0, 7)}` : ""} — ${channel}`,
  );
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
  // reporters are on, and the release-readiness view lists it.
  const shipped = await record(shipping);
  console.log(
    shipped.length > 0
      ? `Shipped ${shipped.length} fix(es). Their reporters will be asked to confirm on build ${build} or newer.`
      : "Release recorded; no fixes shipped.",
  );
}

export function parseChannel(value: string | undefined): ReleaseChannel {
  if (value === undefined || value === "beta") return "beta";
  if (value === "production") return "production";
  throw new Error(`--channel must be beta or production, not "${value}".`);
}
