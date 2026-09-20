#!/usr/bin/env bash
# Builds and launches the FeedbackKit macOS demo app natively (no simulator
# needed). Exercises the floating trigger button, the Help menu's "Report a
# Problem…" item (⌘⇧R), and manual "Report a Problem" buttons on Home/Cart.
set -euo pipefail
cd "$(dirname "$0")/.."

SCHEME="FeedbackKitDemoMac"
PROJECT="DemoApp/FeedbackKitDemo.xcodeproj"
BUILD_DIR="DemoApp/.build"
LOG_FILE="$(mktemp)"

command -v xcodegen >/dev/null || { echo "xcodegen not found — run ./scripts/setup.sh first." >&2; exit 1; }

echo "==> Regenerating Xcode project from DemoApp/project.yml"
(cd DemoApp && xcodegen generate >/dev/null)

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

Running. Try it out:
  - The floating button in the window
  - Help menu > "Report a Problem…" (⌘⇧R)
  - "Report a Problem" on the Home or Cart sidebar screen
Then draw on the screenshot, add a note, and submit — or flip the
"Screenshot" switch off first to submit a text-only report.
EOF
