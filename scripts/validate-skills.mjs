#!/usr/bin/env node
/**
 * Validate all SKILL.md files in skills/ directory.
 * Checks for YAML frontmatter presence, required name and description fields,
 * and verifies that 'name' matches its enclosing directory basename.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import pc from "picocolors";

const ROOT_DIR = process.cwd();
const SKILLS_DIR = join(ROOT_DIR, "skills");

let checked = 0;
let errors = 0;

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full);
    } else if (entry === "SKILL.md") {
      checked++;
      validateSkillFile(full);
    }
  }
}

function validateSkillFile(file) {
  const relPath = relative(ROOT_DIR, file);
  let content = "";
  try {
    content = readFileSync(file, "utf8");
  } catch (err) {
    fail(relPath, `could not read file: ${err.message}`);
    return;
  }

  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    fail(relPath, "missing YAML frontmatter block (--- ... ---)");
    return;
  }

  const frontmatter = match[1];
  const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
  const descMatch = frontmatter.match(/^description:\s*(.+)$/m);

  if (!nameMatch || !nameMatch[1].trim()) {
    fail(relPath, "frontmatter missing required 'name' field");
  }

  if (!descMatch || !descMatch[1].trim()) {
    fail(relPath, "frontmatter missing required 'description' field");
  }

  const dirName = file.split("/").slice(-2, -1)[0];
  if (nameMatch && nameMatch[1].trim() !== dirName) {
    fail(relPath, `frontmatter name '${nameMatch[1].trim()}' does not match directory basename '${dirName}'`);
  }
}

function fail(file, message) {
  errors++;
  console.error(`${pc.red("✗")} ${pc.bold(file)}: ${message}`);
}

try {
  walk(SKILLS_DIR);
} catch (err) {
  console.error(pc.red(`Could not read '${SKILLS_DIR}': ${err.message}`));
  process.exit(1);
}

if (errors > 0) {
  console.error(`\n${pc.red(pc.bold(`${errors} problem(s) found`))} in ${checked} skill(s).\n`);
  process.exit(1);
}

console.log(`${pc.green("✔")} All ${pc.bold(checked)} skill(s) in ${pc.cyan("skills/")} have valid frontmatter.`);
