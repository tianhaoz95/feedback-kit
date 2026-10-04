#!/usr/bin/env bash
# Builds and launches the FeedbackKit Android demo app (android/demo) on a
# connected device or a running emulator — starting one if there's neither.
# Exercises the whole SDK: shake-to-report, the floating trigger button, and
# "Report a Problem" on a Jetpack Compose screen and a classic View screen.
#
#   AVD_NAME=Pixel_8 ./scripts/run-android.sh   # which emulator to boot (default: the first AVD)
set -euo pipefail
cd "$(dirname "$0")/.."

SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
ADB="$SDK/platform-tools/adb"
EMULATOR="$SDK/emulator/emulator"
APP_ID="com.feedbackkit.demo"

[ -x "$ADB" ] || { echo "adb not found under $SDK — install the Android SDK or set ANDROID_HOME." >&2; exit 1; }

# Gradle needs a JDK 17+; prefer one that's already set, else Android Studio's bundled one.
if [ -z "${JAVA_HOME:-}" ]; then
  for candidate in "/Applications/Android Studio.app/Contents/jbr/Contents/Home" /opt/homebrew/opt/openjdk@17; do
    [ -d "$candidate" ] && export JAVA_HOME="$candidate" && break
  done
fi

[ -f android/local.properties ] || echo "sdk.dir=$SDK" > android/local.properties

if ! "$ADB" devices | awk 'NR>1 && $2=="device"' | grep -q .; then
  AVD_NAME="${AVD_NAME:-$("$EMULATOR" -list-avds | head -n1)}"
  [ -n "$AVD_NAME" ] || { echo "No device connected and no emulator (AVD) to start — create one in Android Studio." >&2; exit 1; }
  echo "==> Starting emulator '$AVD_NAME'"
  nohup "$EMULATOR" -avd "$AVD_NAME" -no-snapshot-save >/dev/null 2>&1 &
  "$ADB" wait-for-device
  until [ "$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do sleep 2; done
fi

echo "==> Building and installing the demo app"
(cd android && ./gradlew :demo:installDebug -q)

echo "==> Launching $APP_ID"
"$ADB" shell am start -n "$APP_ID/.MainActivity" >/dev/null
echo "Done. Tap the floating button, shake the device, or use \"Report a Problem\"."
