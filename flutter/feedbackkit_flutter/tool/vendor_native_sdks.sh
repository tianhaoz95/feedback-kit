#!/usr/bin/env bash
# Copies the native Android SDK into the plugin before `flutter pub publish`,
# since a published package can't reach ../../android. android/build.gradle.kts
# compiles android/feedbackkit from the repo when it exists, else this copy.
# (iOS needs no copy: Package.swift falls back to the GitHub release tag.)
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf android/src/vendor/feedbackkit
mkdir -p android/src/vendor
cp -R ../../android/feedbackkit/src/main android/src/vendor/feedbackkit
echo "Vendored android/feedbackkit into android/src/vendor/feedbackkit"
