#!/usr/bin/env bash
# Builds a Release archive of FeedbackPortal and uploads it to App Store Connect for TestFlight.
#
# Signing is fully automatic: xcodebuild manages certificates and provisioning profiles itself
# via an App Store Connect API key, so there is no manually exported .p12 distribution
# certificate or keychain wrangling to do here. You need:
#
#   1. An App Store Connect API key (App Manager role or higher) as three pieces of credential
#      -- its private key file (.p8), Key ID, and Issuer ID.
#   2. This app's Apple Developer Team ID (e.g. 68CTFST8W2 for HEJI TECHNOLOGY LLC).
#   3. An app record already created in App Store Connect with bundle ID com.feedbackkit.developer.
#
# Usage:
#   APPLE_TEAM_ID=68CTFST8W2 ./scripts/release_portal_testflight.sh
#
# Credentials are read from these env vars (first match wins per line):
#   ASC_KEY_ID     / FA_ASC_KEY_ID      -- App Store Connect API Key ID
#   ASC_ISSUER_ID  / FA_ASC_ISSUER_ID   -- App Store Connect API Issuer ID
#   ASC_KEY_PATH   / FA_KEY_LOCATION    -- path to the AuthKey_<KEY_ID>.p8 file
#   APPLE_TEAM_ID                       -- Apple Developer Team ID
#
# The build number (CFBundleVersion) is set to the current UTC timestamp so repeated uploads
# never collide with a previous build's number.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="$REPO_ROOT/build/release-portal"
ARCHIVE_PATH="$BUILD_DIR/FeedbackPortal.xcarchive"
EXPORT_PATH="$BUILD_DIR/export"
EXPORT_OPTIONS_PLIST="$BUILD_DIR/ExportOptions.plist"

ASC_KEY_ID="${ASC_KEY_ID:-${FA_ASC_KEY_ID:-}}"
ASC_ISSUER_ID="${ASC_ISSUER_ID:-${FA_ASC_ISSUER_ID:-}}"
ASC_KEY_PATH="${ASC_KEY_PATH:-${FA_KEY_LOCATION:-}}"
APPLE_TEAM_ID="${APPLE_TEAM_ID:-}"
VERSION="${VERSION:-${1:-}}"
if [[ "$VERSION" == "--version" ]]; then
  VERSION="${2:-}"
fi
VERSION="${VERSION#v}"

# --- Validate credentials ---------------------------------------------------

missing=()
[[ -z "$ASC_KEY_ID" ]] && missing+=("ASC_KEY_ID (or FA_ASC_KEY_ID)")
[[ -z "$ASC_ISSUER_ID" ]] && missing+=("ASC_ISSUER_ID (or FA_ASC_ISSUER_ID)")
[[ -z "$ASC_KEY_PATH" ]] && missing+=("ASC_KEY_PATH (or FA_KEY_LOCATION)")
[[ -z "$APPLE_TEAM_ID" ]] && missing+=("APPLE_TEAM_ID")

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "error: missing required credentials:" >&2
  for m in "${missing[@]}"; do echo "  - $m" >&2; done
  exit 1
fi

if [[ ! -f "$ASC_KEY_PATH" ]]; then
  echo "error: App Store Connect API key not found at: $ASC_KEY_PATH" >&2
  exit 1
fi

# --- Validate app icons exist ------------------------------------------------

check_app_icon() {
  local iconset="$1"
  local label="$2"
  if ! find "$iconset" -maxdepth 1 -iname "*.png" 2>/dev/null | grep -q .; then
    echo "error: $label has no app icon image yet (only Contents.json is present)." >&2
    echo "  Add a real 1024x1024 icon before releasing: $iconset" >&2
    return 1
  fi
}

icon_ok=true
check_app_icon "$REPO_ROOT/DeveloperApp/Assets.xcassets/AppIcon.appiconset" "FeedbackPortal" || icon_ok=false
if [[ "$icon_ok" != "true" ]]; then
  exit 1
fi

# --- Build ------------------------------------------------------------------

echo "-> Regenerating Xcode project via xcodegen..."
(cd "$REPO_ROOT/DeveloperApp" && xcodegen generate)

BUILD_NUMBER="$(date -u +%Y%m%d%H%M)"
echo "-> Using build number $BUILD_NUMBER (CFBundleVersion)"

mkdir -p "$BUILD_DIR"
rm -rf "$ARCHIVE_PATH" "$EXPORT_PATH"

echo "-> Archiving FeedbackPortal (Release)..."
# CODE_SIGN_IDENTITY: pinned to "Apple Development" because this project links the FeedbackKit
# Swift package (see project.yml's `packages:` section) -- Xcode auto-categorizes SPM package
# targets as development signing, so forcing Distribution project-wide conflicts with them.
# The -exportArchive step below still re-signs the final app with a proper Distribution identity
# for the App Store -- a distinct signing pass driven by ExportOptions.plist's `method: app-store`.
ARCHIVE_ARGS=(
  -project "$REPO_ROOT/DeveloperApp/FeedbackPortal.xcodeproj"
  -scheme FeedbackPortal
  -configuration Release
  -archivePath "$ARCHIVE_PATH"
  -destination "generic/platform=iOS"
  -allowProvisioningUpdates
  -authenticationKeyPath "$ASC_KEY_PATH"
  -authenticationKeyID "$ASC_KEY_ID"
  -authenticationKeyIssuerID "$ASC_ISSUER_ID"
  CODE_SIGNING_ALLOWED=YES
  CODE_SIGNING_REQUIRED=YES
  CODE_SIGN_STYLE=Automatic
  CODE_SIGN_IDENTITY="Apple Development"
  DEVELOPMENT_TEAM="$APPLE_TEAM_ID"
  CURRENT_PROJECT_VERSION="$BUILD_NUMBER"
)
if [[ -n "$VERSION" ]]; then
  echo "-> Setting MARKETING_VERSION to $VERSION"
  ARCHIVE_ARGS+=(MARKETING_VERSION="$VERSION")
fi

xcodebuild archive "${ARCHIVE_ARGS[@]}"

cat > "$EXPORT_OPTIONS_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>method</key>
	<string>app-store</string>
	<key>teamID</key>
	<string>$APPLE_TEAM_ID</string>
	<key>signingStyle</key>
	<string>automatic</string>
	<key>destination</key>
	<string>upload</string>
</dict>
</plist>
PLIST

echo "-> Exporting and uploading to App Store Connect (TestFlight)..."
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_PATH" \
  -exportOptionsPlist "$EXPORT_OPTIONS_PLIST" \
  -allowProvisioningUpdates \
  -authenticationKeyPath "$ASC_KEY_PATH" \
  -authenticationKeyID "$ASC_KEY_ID" \
  -authenticationKeyIssuerID "$ASC_ISSUER_ID"

echo "✅ Build $BUILD_NUMBER uploaded to App Store Connect."
echo "   It will appear in TestFlight once Apple finishes processing (usually a few minutes)."

# Close the loop: mark every merged fix contained in this commit as shipped
# in $BUILD_NUMBER, so the people who reported those bugs get asked "is it
# fixed?" when they open this build. Opt-in (set FEEDBACKKIT_PROJECT_ID) and
# best-effort — it needs a `feedbackkit login` session on this machine, and
# a failure here must never fail a release that already uploaded.
if [[ -n "${FEEDBACKKIT_PROJECT_ID:-}" ]]; then
  echo "-> Announcing build $BUILD_NUMBER to FeedbackKit reporters..."
  npx --yes feedbackkit-cli release --project "$FEEDBACKKIT_PROJECT_ID" --build "$BUILD_NUMBER" --commit HEAD \
    || echo "   ⚠️  feedbackkit release failed (not logged in?) — run it by hand: npx feedbackkit-cli release --build $BUILD_NUMBER"
fi
