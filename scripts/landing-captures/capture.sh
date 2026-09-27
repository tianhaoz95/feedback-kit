#!/usr/bin/env bash
# Re-captures the landing page's two device images from the real SDKs:
#   web/src/assets/demo-feedback-screen.webp  — iOS annotate screen (demo app, iPhone 17 Pro Max)
#   web/src/assets/demo-web-feedback.webp     — web SDK dialog over store.html
# Needs Xcode + XcodeGen, Node with web-sdk's dev dependencies (Playwright), and cwebp (brew install webp).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
HERE="$ROOT/scripts/landing-captures"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP" "$ROOT/DemoApp/project-capture.yml" "$ROOT/DemoApp/FeedbackKitDemoCapture.xcodeproj"' EXIT

# --- web
(cd "$ROOT/web-sdk" && npm run build >/dev/null)
(cd "$ROOT/web-sdk" && node "$HERE/capture-web.mjs" "$TMP/web.png")
sips --resampleWidth 1400 "$TMP/web.png" --out "$TMP/web-1400.png" >/dev/null
cwebp -quiet -q 88 "$TMP/web-1400.png" -o "$ROOT/web/src/assets/demo-web-feedback.webp"

# --- iOS: a UI test in a throwaway project that includes the demo app's own.
cat > "$ROOT/DemoApp/project-capture.yml" <<YML
include:
  - project.yml
name: FeedbackKitDemoCapture
targets:
  CaptureUITests:
    type: bundle.ui-testing
    platform: iOS
    sources:
      - path: $HERE/CaptureUITests
    dependencies:
      - target: FeedbackKitDemo
    settings:
      GENERATE_INFOPLIST_FILE: YES
schemes:
  CaptureUITests:
    build:
      targets:
        FeedbackKitDemo: all
        CaptureUITests: [test]
    test:
      targets: [CaptureUITests]
YML
(cd "$ROOT/DemoApp" && xcodegen generate --spec project-capture.yml >/dev/null)
NAME="iPhone 17 Pro Max (capture)"
UDID="$(xcrun simctl list devices available | grep "$NAME" | head -1 | grep -oE '[0-9A-F-]{36}' || true)"
if [ -z "$UDID" ]; then
  RUNTIME="$(xcrun simctl list runtimes | grep -oE 'com.apple.CoreSimulator.SimRuntime.iOS-[0-9-]+' | tail -1)"
  UDID="$(xcrun simctl create "$NAME" com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro-Max "$RUNTIME")"
fi
xcrun simctl boot "$UDID" 2>/dev/null || true
xcrun simctl bootstatus "$UDID" -b >/dev/null
xcrun simctl status_bar "$UDID" override --time "9:41" --dataNetwork wifi --wifiMode active --wifiBars 3 \
  --cellularMode active --cellularBars 4 --batteryState discharging --batteryLevel 100
(cd "$ROOT/DemoApp" && TEST_RUNNER_CAPTURE_PATH="$TMP/ios.png" xcodebuild test -project FeedbackKitDemoCapture.xcodeproj \
  -scheme CaptureUITests -destination "id=$UDID" CODE_SIGNING_ALLOWED=NO -quiet)
sips --resampleWidth 750 "$TMP/ios.png" --out "$TMP/ios-750.png" >/dev/null
cwebp -quiet -q 90 "$TMP/ios-750.png" -o "$ROOT/web/src/assets/demo-feedback-screen.webp"
echo "Updated web/src/assets/demo-feedback-screen.webp and demo-web-feedback.webp"
