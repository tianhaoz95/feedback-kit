// Build ordering for the closed loop ("was this fix shipped in the build the
// reporter is running?"). Mirrors, and must stay in sync with:
//   - supabase/migrations/0014_closed_loop.sql `compare_builds`
//   - Sources/FeedbackKit/Model/FixUpdate.swift `FeedbackBuild.compare`
//   - web-sdk/src/fixes.ts `compareBuilds`
//   - cli/src/loop.ts `compareBuilds`
//
// Dotted numeric builds ("42", "1.2.10", the UTC-timestamp builds
// scripts/release_testflight.sh produces) compare numerically segment by
// segment. Anything else can only be equal (0) or incomparable (null).

const NUMERIC_BUILD = /^[0-9]+(\.[0-9]+)*$/;

export function compareBuilds(a: string | null | undefined, b: string | null | undefined): -1 | 0 | 1 | null {
  if (a == null || b == null || a === "" || b === "") return null;
  if (a === b) return 0;
  if (!NUMERIC_BUILD.test(a) || !NUMERIC_BUILD.test(b)) return null;
  const pa = a.split(".");
  const pb = b.split(".");
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    // BigInt, not Number: timestamp builds (yyyyMMddHHmmss) exceed 2^53 once
    // a segment gets long enough to matter.
    const na = BigInt(pa[i] ?? "0");
    const nb = BigInt(pb[i] ?? "0");
    if (na < nb) return -1;
    if (na > nb) return 1;
  }
  return 0;
}

/**
 * Whether a reporter running `clientBuild` has the fix that shipped in
 * `fixedInBuild`. Unknown on either side, or incomparable (e.g. a git SHA
 * web build), counts as "yes": the item is only `shipped` once a release was
 * announced, and on the web every page load after a deploy runs new code.
 */
export function buildIncludesFix(clientBuild: string | null | undefined, fixedInBuild: string | null | undefined): boolean {
  const cmp = compareBuilds(clientBuild, fixedInBuild);
  return cmp === null || cmp >= 0;
}
