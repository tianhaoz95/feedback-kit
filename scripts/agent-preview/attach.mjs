#!/usr/bin/env node
// Attaches a capture you already have (a PNG/JPEG/GIF/WebP screenshot or an
// MP4 of up to 30 s) to a FeedbackKit report as an after-fix preview, as the
// token in FEEDBACKKIT_TOKEN. The same as the MCP server's attach_preview, for
// runs without it.
//
//   node scripts/agent-preview/attach.mjs --feedback <id> --file /tmp/after.png [--caption "…"] [--since <iso>]
//
// --since skips (exit code 3) when the report already got a preview after that time.
import { readFileSync } from "node:fs";
import { attach, fetchReport, hasPreviewSince, log, SKIP } from "./feedbackkit.mjs";

const args = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const key = argv[i].replace(/^--/, "");
  if (!["feedback", "file", "caption", "since"].includes(key) || argv[i + 1] === undefined) {
    console.error(`attach: unknown or incomplete option ${argv[i]}`);
    process.exit(1);
  }
  args[key] = argv[++i];
}
if (!args.feedback || !args.file) {
  console.error("attach: pass --feedback <id> and --file <path>.");
  process.exit(1);
}

try {
  if (args.since && hasPreviewSince(await fetchReport(args.feedback), args.since)) {
    log("the report already has a preview from this run; nothing to do.");
    process.exit(SKIP);
  }
  const result = await attach(args.feedback, readFileSync(args.file), args.caption);
  log(`attached (${result.media_type ?? "file"}).`);
} catch (err) {
  console.error(`attach: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
