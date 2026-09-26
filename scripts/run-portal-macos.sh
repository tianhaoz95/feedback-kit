#!/usr/bin/env bash
# Builds and launches the macOS Developer Portal ("FeedbackKit Portal") natively.
# The Portal dogfoods FeedbackKit's macOS SDK: Help › Report a Problem… (⇧⌘R)
# files a report about the Portal itself into the FeedbackKit team's project.
set -euo pipefail
cd "$(dirname "$0")/.."

SCHEME="FeedbackPortalMac"
PROJECT="DeveloperApp/FeedbackPortal.xcodeproj"
BUILD_DIR="DeveloperApp/.build"
LOG_FILE="$(mktemp)"

command -v xcodegen >/dev/null || { echo "xcodegen not found — run ./scripts/setup.sh first." >&2; exit 1; }

echo "==> Regenerating Xcode project from DeveloperApp/project.yml"
(cd DeveloperApp && xcodegen generate >/dev/null)

echo "==> Building $SCHEME (log: $LOG_FILE)"
if ! xcodebuild build \
  -project "$PROJECT" \
  -scheme "$SCHEME" \
  -destination 'platform=macOS' \
  -derivedDataPath "$BUILD_DIR" > "$LOG_FILE" 2>&1; then
  echo "Build failed. Last 60 lines of the log:" >&2
  tail -60 "$LOG_FILE" >&2
  exit 1
fi

APP_PATH=$(find "$BUILD_DIR/Build/Products/Debug" -maxdepth 1 -name "*.app" | head -1)

echo "==> Launching"
open "$APP_PATH"

cat <<EOF

Running. Sign in with GitHub (or explore the demo data from the sign-in screen),
then try Help › Report a Problem… (⇧⌘R) to report an issue with the Portal itself.
EOF
