#!/usr/bin/env node
/**
 * Interactive skill scaffolder for Agent Skills repositories.
 * Uses @clack/prompts, @clack/core, and picocolors.
 *
 * Usage:
 *   Interactive:      npm run new
 *   Non-interactive:  npm run new -- <category>/<name> ["description"]
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import {
  cancel,
  confirm,
  intro,
  isCancel,
  log,
  note,
  outro,
  select,
  spinner,
  text
} from "@clack/prompts";
import pc from "picocolors";

const ROOT_DIR = process.cwd();
const SKILLS_DIR = join(ROOT_DIR, "skills");
const README_PATH = join(ROOT_DIR, "README.md");

const KEBAB_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function getExistingCategories() {
  if (!existsSync(SKILLS_DIR)) return [];
  try {
    return readdirSync(SKILLS_DIR).filter((entry) => {
      if (entry.startsWith(".")) return false;
      const full = join(SKILLS_DIR, entry);
      return statSync(full).isDirectory();
    });
  } catch {
    return [];
  }
}

function updateReadmeCatalog(category, name, description) {
  if (!existsSync(README_PATH)) return false;
  try {
    let content = readFileSync(README_PATH, "utf8");
    const catalogHeaderMatch = content.match(/##\s+Skills Catalog[\s\S]*?(\|[^\n]+\|[\s\S]*?\n)(?=\n##|\n#[^#]|$)/);
    if (!catalogHeaderMatch) return false;

    const categoryLink = existsSync(join(SKILLS_DIR, category, "README.md"))
      ? `[\`${category}/\`](skills/${category}/README.md)`
      : `\`${category}/\``;
    const skillLink = `[\`${name}\`](skills/${category}/${name}/SKILL.md)`;
    const newRow = `| ${categoryLink} | ${skillLink} | ${description.trim()} |\n`;

    // Avoid duplicate entries
    if (content.includes(`skills/${category}/${name}/SKILL.md`)) {
      return false;
    }

    const tableBlock = catalogHeaderMatch[1];
    const lastRowIndex = content.indexOf(tableBlock) + tableBlock.length;
    content = content.slice(0, lastRowIndex) + newRow + content.slice(lastRowIndex);
    writeFileSync(README_PATH, content, "utf8");
    return true;
  } catch {
    return false;
  }
}

function createSkillFiles({ category, name, description, includeTemplates }) {
  const targetDir = join(SKILLS_DIR, category, name);
  mkdirSync(targetDir, { recursive: true });

  const skillContent = `---
name: ${name}
description: ${description}
---

# ${name}

${description}

## When to Use

- Use when ...
- Trigger phrases: "...", "..."

## Prerequisites

- Required tools, credentials, or environment variables.

## Step-by-Step Instructions

1. Step one details.
2. Step two details.

## Non-Obvious Pitfalls

- Edge cases, common gotchas, or lessons learned.
`;

  writeFileSync(join(targetDir, "SKILL.md"), skillContent, "utf8");

  if (includeTemplates) {
    const templatesDir = join(targetDir, "templates");
    mkdirSync(templatesDir, { recursive: true });
    writeFileSync(
      join(templatesDir, ".gitkeep"),
      "# Place template files here with .template extension (e.g. config.json.template)\n",
      "utf8"
    );
  }

  const catalogUpdated = updateReadmeCatalog(category, name, description);
  return { targetDir, catalogUpdated };
}

// ---------------------------------------------------------------------------
// CLI Execution
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);

  // --- Non-interactive mode (CLI arguments passed) ---
  if (args.length > 0) {
    const rawPath = args[0];
    const rawDesc = args[1] || "TODO: describe what this skill does and when it should trigger";

    const parts = rawPath.split("/").filter(Boolean);
    if (parts.length < 2) {
      console.error(pc.red("Error: Expected path in format '<category>/<name>', e.g. 'npm/my-skill'"));
      process.exit(1);
    }

    const category = parts[0];
    const name = parts[1];

    if (!KEBAB_REGEX.test(category)) {
      console.error(pc.red(`Error: Category '${category}' must be kebab-case (lowercase, letters, numbers, hyphens).`));
      process.exit(1);
    }
    if (!KEBAB_REGEX.test(name)) {
      console.error(pc.red(`Error: Skill name '${name}' must be kebab-case (lowercase, letters, numbers, hyphens).`));
      process.exit(1);
    }

    const targetDir = join(SKILLS_DIR, category, name);
    if (existsSync(targetDir)) {
      console.error(pc.red(`Error: Skill already exists at ${targetDir}`));
      process.exit(1);
    }

    const { catalogUpdated } = createSkillFiles({
      category,
      name,
      description: rawDesc,
      includeTemplates: false
    });

    console.log(pc.green(`✔ Created skills/${category}/${name}/SKILL.md`));
    if (catalogUpdated) {
      console.log(pc.dim("✔ Updated Skills Catalog table in README.md"));
    }
    return;
  }

  // --- Interactive mode (@clack/prompts) ---
  intro(pc.bgCyan(pc.black(" scaffold-skill ")));

  const categories = getExistingCategories();
  let category = "";

  if (categories.length > 0) {
    const CREATE_NEW = "__new__";
    const selectedCategory = await select({
      message: "Select category:",
      options: [
        ...categories.map((cat) => ({ value: cat, label: cat })),
        { value: CREATE_NEW, label: pc.cyan("+ Create new category...") }
      ]
    });

    if (isCancel(selectedCategory)) {
      cancel("Scaffolding cancelled.");
      process.exit(0);
    }

    if (selectedCategory === CREATE_NEW) {
      const newCatInput = await text({
        message: "Enter new category name:",
        placeholder: "e.g. backend, docker, utils",
        validate(value) {
          if (!value || !value.trim()) return "Category name cannot be empty.";
          const clean = value.trim();
          if (!KEBAB_REGEX.test(clean)) {
            return "Category must be kebab-case (lowercase letters, numbers, hyphens).";
          }
        }
      });

      if (isCancel(newCatInput)) {
        cancel("Scaffolding cancelled.");
        process.exit(0);
      }
      category = newCatInput.trim();
    } else {
      category = selectedCategory;
    }
  } else {
    const catInput = await text({
      message: "Enter category name:",
      placeholder: "e.g. npm, macos, ios, meta",
      validate(value) {
        if (!value || !value.trim()) return "Category name cannot be empty.";
        const clean = value.trim();
        if (!KEBAB_REGEX.test(clean)) {
          return "Category must be kebab-case (lowercase letters, numbers, hyphens).";
        }
      }
    });

    if (isCancel(catInput)) {
      cancel("Scaffolding cancelled.");
      process.exit(0);
    }
    category = catInput.trim();
  }

  const skillName = await text({
    message: "Enter skill name (kebab-case):",
    placeholder: "e.g. deploy-preview, testflight-setup",
    validate(value) {
      if (!value || !value.trim()) return "Skill name cannot be empty.";
      const clean = value.trim();
      if (!KEBAB_REGEX.test(clean)) {
        return "Skill name must be kebab-case (lowercase letters, numbers, hyphens).";
      }
      const dest = join(SKILLS_DIR, category, clean);
      if (existsSync(dest)) {
        return `Skill already exists at skills/${category}/${clean}`;
      }
    }
  });

  if (isCancel(skillName)) {
    cancel("Scaffolding cancelled.");
    process.exit(0);
  }

  const description = await text({
    message: "Enter one-line description (what it does and when an agent triggers it):",
    placeholder: "e.g. Configure local and CI build scripts for automated preview deployments",
    validate(value) {
      if (!value || !value.trim()) return "Description cannot be empty.";
      if (value.trim().length < 10) return "Please provide a more descriptive summary (at least 10 chars).";
    }
  });

  if (isCancel(description)) {
    cancel("Scaffolding cancelled.");
    process.exit(0);
  }

  const includeTemplates = await confirm({
    message: "Include a templates/ directory for multi-file templates?",
    initialValue: false
  });

  if (isCancel(includeTemplates)) {
    cancel("Scaffolding cancelled.");
    process.exit(0);
  }

  const s = spinner();
  s.start("Generating skill structure...");

  const { catalogUpdated } = createSkillFiles({
    category,
    name: skillName.trim(),
    description: description.trim(),
    includeTemplates
  });

  s.stop(pc.green("Skill files generated."));

  note(
    [
      `File:        ${pc.cyan(`skills/${category}/${skillName.trim()}/SKILL.md`)}`,
      includeTemplates ? `Templates:   ${pc.cyan(`skills/${category}/${skillName.trim()}/templates/`)}` : null,
      catalogUpdated ? `Catalog:     ${pc.green("README.md table updated")}` : null,
      "",
      "Next steps:",
      `1. Edit ${pc.bold(`skills/${category}/${skillName.trim()}/SKILL.md`)} to write your instructions.`,
      `2. Run ${pc.bold("npm run validate")} to verify frontmatter.`,
      `3. Test discovery with ${pc.bold("npm run list")}.`
    ]
      .filter(Boolean)
      .join("\n"),
    "Skill Created"
  );

  outro(pc.green(`✔ Successfully scaffolded ${category}/${skillName.trim()}!`));
}

main().catch((err) => {
  console.error(pc.red(`\nUnexpected error: ${err.message}`));
  process.exit(1);
});
