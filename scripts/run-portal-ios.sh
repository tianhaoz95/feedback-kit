#!/usr/bin/env bash
# Builds and launches the FeedbackKit Developer Portal app in an iOS simulator.
set -euo pipefail
cd "$(dirname "$0")/.."

SCHEME="FeedbackPortal"
PROJECT="DeveloperApp/FeedbackPortal.xcodeproj"
BUNDLE_ID="com.feedbackkit.developer"
BUILD_DIR="DeveloperApp/.build"
LOG_FILE="$(mktemp)"

command -v xcodegen >/dev/null || { echo "xcodegen not found — run ./scripts/setup.sh first." >&2; exit 1; }

echo "==> Regenerating Xcode project from DeveloperApp/project.yml"
(cd DeveloperApp && xcodegen generate >/dev/null)

# Pick booted simulator if available, else search by SIMULATOR_NAME
BOOTED_ID=$(xcrun simctl list devices | grep "(Booted)" | head -1 | grep -o -E "[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}" || true)

if [ -n "$BOOTED_ID" ]; then
  DEVICE_ID="$BOOTED_ID"
  SIMULATOR_NAME=$(xcrun simctl list devices | grep "$BOOTED_ID" | head -1 | sed -E 's/^[[:space:]]*([^(]+)[[:space:]]*\(.*/\1/' | xargs)
  echo "==> Using currently booted simulator '$SIMULATOR_NAME' ($DEVICE_ID)"
else
  SIMULATOR_NAME="${SIMULATOR_NAME:-iPhone 17e}"
  echo "==> Finding simulator '$SIMULATOR_NAME'"
  DEVICE_ID=$(xcrun simctl list devices available -j | python3 -c "
import json, sys
data = json.load(sys.stdin)['devices']
target = '$SIMULATOR_NAME'
for devices in data.values():
    for d in devices:
        if d['name'] == target:
            print(d['udid'])
            sys.exit(0)
sys.exit(1)
") || {
    echo "No '$SIMULATOR_NAME' simulator found." >&2
    echo "Set SIMULATOR_NAME to one listed by: xcrun simctl list devices available" >&2
    exit 1
  }
  echo "==> Booting simulator '$SIMULATOR_NAME'"
  xcrun simctl bootstatus "$DEVICE_ID" -b >/dev/null 2>&1 || true
fi

open -a Simulator 2>/dev/null || true

echo "==> Building FeedbackPortal (log: $LOG_FILE)"
if ! xcodebuild build \
  -project "$PROJECT" \
  -scheme "$SCHEME" \
  -destination "id=$DEVICE_ID" \
  -derivedDataPath "$BUILD_DIR" > "$LOG_FILE" 2>&1; then
  echo "Build failed. Last 60 lines of the log:" >&2
  tail -60 "$LOG_FILE" >&2
  exit 1
fi

APP_PATH=$(find "$BUILD_DIR/Build/Products" -maxdepth 2 -name "FeedbackPortal.app" | head -1)

echo "==> Installing and launching FeedbackPortal ($BUNDLE_ID)"
xcrun simctl install "$DEVICE_ID" "$APP_PATH"
xcrun simctl launch "$DEVICE_ID" "$BUNDLE_ID"

cat <<EOF

FeedbackKit Developer Portal is now running on "$SIMULATOR_NAME"!
Try out:
  - Triage feedback items with status pills and swipe actions
  - Inspect screenshot annotations with zoom & vector markup overlay
  - Copy and share AI coding agent prompts (Cursor, Claude Code, Antigravity)
  - Generate merged multi-issue prompts
  - Manage projects, API keys, prompt templates, and CLI sessions
  - View SDK integration guide
EOF
