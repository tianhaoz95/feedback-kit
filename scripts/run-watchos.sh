#!/usr/bin/env bash
# Builds and launches the FeedbackKit watchOS demo app in a watch simulator.
# It's a standalone watch app (no iOS companion, no paired phone simulator
# needed) — just FeedbackQuickNoteView's stripped-down text-only flow.
set -euo pipefail
cd "$(dirname "$0")/.."

SIMULATOR_NAME="${SIMULATOR_NAME:-Apple Watch Series 11 (46mm)}"
SCHEME="FeedbackKitDemoWatch"
PROJECT="DemoApp/FeedbackKitDemo.xcodeproj"
BUNDLE_ID="com.feedbackkit.demo.watch"
BUILD_DIR="DemoApp/.build"
LOG_FILE="$(mktemp)"

command -v xcodegen >/dev/null || { echo "xcodegen not found — run ./scripts/setup.sh first." >&2; exit 1; }

echo "==> Regenerating Xcode project from DemoApp/project.yml"
(cd DemoApp && xcodegen generate >/dev/null)

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

echo "==> Booting simulator"
xcrun simctl bootstatus "$DEVICE_ID" -b >/dev/null 2>&1 || true
open -a Simulator 2>/dev/null || true

echo "==> Building $SCHEME (log: $LOG_FILE)"
if ! xcodebuild build \
  -project "$PROJECT" \
  -scheme "$SCHEME" \
  -destination "id=$DEVICE_ID" \
  -derivedDataPath "$BUILD_DIR" > "$LOG_FILE" 2>&1; then
  echo "Build failed. Last 60 lines of the log:" >&2
  tail -60 "$LOG_FILE" >&2
  exit 1
fi

APP_PATH=$(find "$BUILD_DIR/Build/Products" -maxdepth 2 -name "*.app" | head -1)

echo "==> Installing and launching on simulator"
xcrun simctl install "$DEVICE_ID" "$APP_PATH"
xcrun simctl launch "$DEVICE_ID" "$BUNDLE_ID"

cat <<EOF

Running on "$SIMULATOR_NAME". Tap "Report a Problem" to try the
stripped-down text-only flow — no screenshot or annotation tools on
this platform, see DESIGN.md for why.
EOF
