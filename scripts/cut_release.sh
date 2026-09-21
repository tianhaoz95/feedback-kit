#!/usr/bin/env bash
# Cuts a GitHub Release, triggering the appropriate CI release workflow:
#   - mac-demo-vX.Y.Z  -> .github/workflows/release-macos-demo.yml (builds, signs, notarizes DMG)
#   - vX.Y.Z           -> .github/workflows/testflight.yml (builds and uploads iOS to TestFlight)
#   - cli-vX.Y.Z       -> .github/workflows/publish-cli.yml (publishes CLI to npm)
#
# Usage:
#   ./scripts/cut_release.sh mac-demo-v1.0.0
#   ./scripts/cut_release.sh v1.0.0
#   ./scripts/cut_release.sh cli-v0.1.0
#   ./scripts/cut_release.sh 1.0.0 --mac-demo
#   ./scripts/cut_release.sh 1.0.0 --notes "Initial release"
#   ./scripts/cut_release.sh 1.0.0 --draft       # create but don't publish
#   ./scripts/cut_release.sh 1.0.0 --allow-dirty  # skip clean working tree check
#
# Requires: gh (authenticated, `gh auth status`), and an `origin` remote pointing
# at the GitHub repository.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

usage() {
  local exit_code="${1:-1}"
  cat <<'EOF' >&2
Usage:
  cut_release.sh <tag-or-version> [options]

Tag examples:
  mac-demo-v1.0.0      macOS Demo App (notarized DMG attached to GitHub Release)
  v1.0.0               iOS/watchOS Demo App (uploaded to TestFlight)
  cli-v0.1.0           FeedbackKit CLI (published to npm)

Options:
  --mac-demo           Prefix numeric version with 'mac-demo-v'
  --cli                Prefix numeric version with 'cli-v'
  --notes "..."        Custom release notes (defaults to GitHub auto-generated notes)
  --draft              Create draft release (won't trigger CI until published)
  --allow-dirty        Skip clean git working tree check
  -h, --help           Show this help
EOF
  exit "$exit_code"
}

VERSION=""
NOTES=""
DRAFT=false
ALLOW_DIRTY=false
PREFIX_TYPE="default"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mac-demo)
      PREFIX_TYPE="mac-demo"
      shift
      ;;
    --cli)
      PREFIX_TYPE="cli"
      shift
      ;;
    --notes)
      NOTES="${2:-}"
      [[ -z "$NOTES" ]] && usage 1
      shift 2
      ;;
    --draft)
      DRAFT=true
      shift
      ;;
    --allow-dirty)
      ALLOW_DIRTY=true
      shift
      ;;
    -h|--help)
      usage 0
      ;;
    mac-demo-v*|cli-v*|v*)
      [[ -n "$VERSION" ]] && usage
      VERSION="$1"
      shift
      ;;
    [0-9]*.[0-9]*.[0-9]*)
      [[ -n "$VERSION" ]] && usage
      VERSION="$1"
      shift
      ;;
    *)
      usage
      ;;
  esac
done

[[ -z "$VERSION" ]] && usage

# Normalize version according to prefix type if not already prefixed
if [[ "$VERSION" =~ ^(mac-demo-v|cli-v|v)[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  TAG="$VERSION"
elif [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  case "$PREFIX_TYPE" in
    mac-demo) TAG="mac-demo-v$VERSION" ;;
    cli)      TAG="cli-v$VERSION" ;;
    *)        TAG="v$VERSION" ;;
  esac
else
  echo "error: invalid version format: $VERSION" >&2
  echo "expected X.Y.Z, vX.Y.Z, mac-demo-vX.Y.Z, or cli-vX.Y.Z" >&2
  exit 1
fi

cd "$REPO_ROOT"

# --- Preflight checks -------------------------------------------------------

if ! command -v gh >/dev/null 2>&1; then
  echo "error: gh (GitHub CLI) is not installed. https://cli.github.com" >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "error: gh is not authenticated. Run: gh auth login" >&2
  exit 1
fi

REPO_SLUG="$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || true)"
if [[ -z "$REPO_SLUG" ]]; then
  echo "error: couldn't resolve the GitHub repo from the 'origin' remote. Is one configured?" >&2
  exit 1
fi

if [[ "$ALLOW_DIRTY" != "true" ]] && [[ -n "$(git status --porcelain)" ]]; then
  echo "error: working tree has uncommitted changes -- commit or stash first (or pass --allow-dirty)." >&2
  git status --short >&2
  exit 1
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo "warning: releasing from branch '$CURRENT_BRANCH', not 'main'." >&2
fi

if git rev-parse "$TAG" >/dev/null 2>&1 || gh release view "$TAG" --repo "$REPO_SLUG" >/dev/null 2>&1; then
  echo "error: tag/release $TAG already exists." >&2
  exit 1
fi

# Determine title and target workflow
if [[ "$TAG" =~ ^mac-demo-v(.*)$ ]]; then
  TITLE="macOS Demo ${BASH_REMATCH[1]}"
  WORKFLOW="release-macos-demo.yml"
elif [[ "$TAG" =~ ^cli-v(.*)$ ]]; then
  TITLE="CLI v${BASH_REMATCH[1]}"
  WORKFLOW="publish-cli.yml"
else
  TITLE="$TAG"
  WORKFLOW="testflight.yml"
fi

# --- Create the release ------------------------------------------------------

RELEASE_ARGS=(release create "$TAG" --repo "$REPO_SLUG" --title "$TITLE")

if [[ -n "$NOTES" ]]; then
  RELEASE_ARGS+=(--notes "$NOTES")
else
  RELEASE_ARGS+=(--generate-notes)
fi

if [[ "$DRAFT" == "true" ]]; then
  RELEASE_ARGS+=(--draft)
  echo "-> Creating DRAFT release $TAG on $REPO_SLUG (won't trigger CI until published)..."
else
  echo "-> Creating and publishing release $TAG on $REPO_SLUG..."
fi

gh "${RELEASE_ARGS[@]}"

git fetch --tags origin >/dev/null 2>&1 || true

if [[ "$DRAFT" == "true" ]]; then
  echo "✅ Draft release $TAG created. Publish it from GitHub Releases to trigger $WORKFLOW."
else
  echo "✅ Release $TAG published -- this triggers $WORKFLOW."
  RUN_ID="$(gh run list --repo "$REPO_SLUG" --workflow="$WORKFLOW" --limit 1 --json databaseId -q '.[0].databaseId' 2>/dev/null || true)"
  if [[ -n "$RUN_ID" ]]; then
    echo "   Watch it with: gh run watch --repo $REPO_SLUG $RUN_ID"
  fi
fi
