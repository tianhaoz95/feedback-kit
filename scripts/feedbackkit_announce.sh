#!/usr/bin/env bash
# Tells FeedbackKit that a build shipped, so everyone who reported a bug it
# fixes gets asked "is it fixed?" when they open it (DESIGN.md §7-8). Called
# at the end of every release script, locally and in CI:
#
#   ./scripts/feedbackkit_announce.sh <build> [--product <key>] [--channel beta|production] [--app-version <v>]
#
# Auth, first match wins:
#   FEEDBACKKIT_RELEASE_TOKEN  project release token (CI; no login needed)
#   FEEDBACKKIT_PROJECT_ID     a `feedbackkit login` session on this machine
# Neither set → does nothing. Never fails: the build it announces has
# already shipped, and a missed announcement can be redone by hand.
#
# FEEDBACKKIT_CLI overrides the CLI command (CI sets it to this repo's own
# build, `node cli/dist/index.js`, so pipelines use the CLI they ship with).
set -uo pipefail

BUILD="${1:-}"
shift || true
[[ -n "$BUILD" ]] || { echo "usage: feedbackkit_announce.sh <build> [release options]" >&2; exit 0; }

if [[ -z "${FEEDBACKKIT_RELEASE_TOKEN:-}" && -z "${FEEDBACKKIT_PROJECT_ID:-}" ]]; then
  echo "-> Skipping FeedbackKit announcement (set FEEDBACKKIT_RELEASE_TOKEN or FEEDBACKKIT_PROJECT_ID to enable)"
  exit 0
fi

read -r -a CLI <<< "${FEEDBACKKIT_CLI:-npx --yes feedbackkit-cli}"
ARGS=(release --build "$BUILD" --commit HEAD "$@")
if [[ -z "${FEEDBACKKIT_RELEASE_TOKEN:-}" ]]; then
  ARGS+=(--project "$FEEDBACKKIT_PROJECT_ID")
fi

echo "-> Announcing build $BUILD to FeedbackKit reporters..."
if ! "${CLI[@]}" "${ARGS[@]}"; then
  echo "   ⚠️  feedbackkit release failed — rerun by hand: ${CLI[*]} ${ARGS[*]}"
fi
exit 0
