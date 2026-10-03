#!/usr/bin/env bash
# Copies the native Android SDK into the plugin before `flutter pub publish`,
# since a published package can't reach ../../android. android/build.gradle.kts
# compiles android/feedbackkit from the repo when it exists, else this copy.
# iOS needs no copy: Package.swift falls back to the GitHub release tag, which
# this pins to the pubspec version (as does the podspec).
set -euo pipefail
cd "$(dirname "$0")/.."
VERSION="$(sed -n 's/^version: *//p' pubspec.yaml)"
sed -i.bak -E "s/exact: \"[0-9.]+\"/exact: \"$VERSION\"/" ios/feedbackkit_flutter/Package.swift
sed -i.bak -E "s/(s.version += ')[0-9.]+'/\1$VERSION'/" ios/feedbackkit_flutter.podspec
rm -f ios/feedbackkit_flutter/Package.swift.bak ios/feedbackkit_flutter.podspec.bak
rm -rf android/src/vendor/feedbackkit
mkdir -p android/src/vendor
cp -R ../../android/feedbackkit/src/main android/src/vendor/feedbackkit
echo "Vendored android/feedbackkit into android/src/vendor/feedbackkit"
