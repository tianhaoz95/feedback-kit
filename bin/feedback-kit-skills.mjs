#!/usr/bin/env node
// `npx feedback-kit-skills [skills add options]` installs this package's own
// copy of skills/ into the current project's agent directories, e.g.
//
//   npx feedback-kit-skills --skill setup-agent-runner --yes
//
// It's `npx skills add <this package> …` under one name. The skills CLI
// can't take an npm package name itself (it treats a bare name as a git repo
// to clone), and `npm i feedback-kit-skills` alone only puts the files in
// node_modules, where no agent looks. Installing from the bundled copy
// installs this release's skills rather than the repo's main branch.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = "tianhaoz95/feedback-kit";

const packageRoot = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), ".."));
const skillsCli = createRequire(import.meta.url).resolve("skills/bin/cli.mjs");

const result = spawnSync(process.execPath, [skillsCli, "add", packageRoot, ...process.argv.slice(2)], {
  stdio: "inherit",
});
if (result.status === 0) repointLockFile();
process.exit(result.status ?? 1);

/**
 * The skills CLI records a local install's source as a path, which here is
 * npx's cache on this machine: meaningless in a committed skills-lock.json.
 * Record it the way `npx skills add tianhaoz95/feedback-kit` does instead
 * (same files, so the same computedHash), so `skills update` and teammates'
 * installs work.
 */
function repointLockFile() {
  const lockPath = join(process.cwd(), "skills-lock.json");
  if (!existsSync(lockPath)) return; // e.g. a --global install
  try {
    const lock = JSON.parse(readFileSync(lockPath, "utf8"));
    let changed = false;
    for (const [name, entry] of Object.entries(lock.skills ?? {})) {
      if (entry.sourceType !== "local" || !isPackageRoot(entry.source)) continue;
      const skillPath = findSkillPath(name);
      if (!skillPath) continue;
      lock.skills[name] = { ...entry, source: REPO, sourceType: "github", skillPath };
      changed = true;
    }
    if (changed) writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
  } catch {
    // The install itself succeeded; a lock file we can't read is left as the CLI wrote it.
  }
}

function isPackageRoot(source) {
  try {
    return realpathSync(resolve(process.cwd(), source)) === packageRoot;
  } catch {
    return false;
  }
}

/** skills/<category>/<name>/SKILL.md, relative to the repo root (which the package mirrors). */
function findSkillPath(name) {
  const skillsDir = join(packageRoot, "skills");
  for (const category of readdirSync(skillsDir, { withFileTypes: true })) {
    if (!category.isDirectory()) continue;
    const skillMd = join(skillsDir, category.name, name, "SKILL.md");
    if (existsSync(skillMd)) return relative(packageRoot, skillMd).split("\\").join("/");
  }
  return null;
}
