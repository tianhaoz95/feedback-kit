#!/usr/bin/env bash
# Runs on `npm pack`/`npm publish` (prepack): copies the native Android SDK
# into the package, since a published package can't reach ../android.
# android/build.gradle compiles android/feedbackkit from the repo when it
# exists, else this copy. iOS needs no copy: the app's Podfile adds the
# FeedbackKit pod (see FeedbackKitReactNative.podspec).
set -euo pipefail
cd "$(dirname "$0")/.."
if [ ! -d ../android/feedbackkit/src/main ]; then
  echo "Not inside the feedback-kit repo; keeping the existing vendored copy." >&2
  exit 0
fi
rm -rf android/src/vendor/feedbackkit
mkdir -p android/src/vendor
cp -R ../android/feedbackkit/src/main android/src/vendor/feedbackkit
