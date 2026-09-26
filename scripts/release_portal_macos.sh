#!/usr/bin/env bash
# Builds, signs, notarizes and (optionally) publishes a signed DMG of the
# macOS Developer Portal ("FeedbackKit Portal", DeveloperApp/ FeedbackPortalMac
# target) to a GitHub Release — then closes the dogfood loop: with
# FEEDBACKKIT_PROJECT_ID set, it runs `feedbackkit release` so everyone who
# reported a Portal bug that this build fixes gets asked "is it fixed?" the
# next time they open it. Mirrors release_macos_demo.sh (same credentials,
# same Developer ID + notarization steps); see that script for the why.
#
# Unlike release_testflight.sh's "Apple Development" identity + App Store
# export (Apple manages certs/profiles via the ASC API key), this is a
# direct Developer ID distribution: a real "Developer ID Application"
# certificate has to already be in the keychain (or importable — see
# .github/workflows/release-portal-macos.yml for how CI gets one from
# MACOS_CERTIFICATE/MACOS_CERTIFICATE_PASSWORD), and the result gets
# notarized before Gatekeeper will run it on anyone else's Mac.
#
# Usage:
#   ./scripts/release_portal_macos.sh --version 1.0.0                # attach to the unified release v1.0.0
#   ./scripts/release_portal_macos.sh --version 1.0.0 --no-upload    # build+sign+notarize only
#   ./scripts/release_portal_macos.sh --tag portal-mac-v1.0.0        # a Portal-only release
#   ./scripts/release_portal_macos.sh --beta                         # rolling beta prerelease (CI, every push to main)
#
# --beta replaces the `beta-portal-mac` GitHub prerelease with this build (one
# always-current beta download rather than a prerelease per push) and
# announces it on FeedbackKit's beta channel. A tagged release is the Mac's
# production channel — the owner cuts it with scripts/cut_release.sh.
#
# Tags follow the same scheme as every other release pipeline (see
# scripts/cut_release.sh): a unified vX.Y.Z release ships everything,
# including this DMG; a prefixed portal-mac-vX.Y.Z release ships only the
# macOS Portal.
#
# The build number (CFBundleVersion) is a UTC timestamp (yyyyMMddHHmm) — the
# same scheme as the TestFlight scripts — so betas and releases order
# correctly for FeedbackKit's fix verification (DESIGN.md §7). Override with
# --build N.
#
# Credentials (first match wins per line — the FA_* names are this machine's
# default App Store Connect API key, set in ~/.zshrc; same key
# release_testflight.sh uses, since notarization and TestFlight upload both
# just need *an* ASC API key with access to this Apple Developer team):
#   ASC_KEY_ID     / FA_ASC_KEY_ID      -- App Store Connect API Key ID
#   ASC_ISSUER_ID  / FA_ASC_ISSUER_ID   -- App Store Connect API Issuer ID
#   ASC_KEY_PATH   / FA_KEY_LOCATION    -- path to the AuthKey_<KEY_ID>.p8 file
#   APPLE_TEAM_ID                        -- Apple Developer Team ID
#
# The signing identity itself is looked up in the keychain (there must be
# exactly one "Developer ID Application" certificate available) rather than
# passed as a credential — see MAC_IDENTITY below to override.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GH_REPO="tianhaoz95/feedback-kit"
BUILD_DIR="$REPO_ROOT/build/release-portal-macos"
DERIVED_DATA="$BUILD_DIR/DerivedData"
APP_NAME="FeedbackKit Portal.app"

VERSION=""
TAG=""
BUILD_NUMBER=""
BETA=0
NO_UPLOAD=0
CHECK_ONLY=0
BETA_TAG="beta-portal-mac"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --version)   VERSION="${2:-}"; shift 2 ;;
    --tag)       TAG="${2:-}"; shift 2 ;;
    --build)     BUILD_NUMBER="${2:-}"; shift 2 ;;
    --beta)      BETA=1; shift ;;
    --no-upload) NO_UPLOAD=1; shift ;;
    --check)     CHECK_ONLY=1; shift ;;
    -h|--help)   sed -n '2,50p' "$0"; exit 0 ;;
    *) echo "error: unknown argument: $1" >&2; exit 2 ;;
  esac
done

if [[ "$CHECK_ONLY" -eq 0 && "$BETA" -eq 1 ]]; then
  # Betas keep the project's marketing version; only the build number moves.
  VERSION="$(sed -n 's/^ *MARKETING_VERSION: *"\{0,1\}\([0-9.]*\)"\{0,1\}.*$/\1/p' "$REPO_ROOT/DeveloperApp/project.yml" | tail -1)"
  [[ -n "$VERSION" ]] || VERSION="1.0.0"
  TAG="$BETA_TAG"
elif [[ "$CHECK_ONLY" -eq 0 ]]; then
  if [[ -n "$TAG" ]]; then
    if [[ "$TAG" =~ ^portal-mac-v ]]; then
      VERSION="${TAG#portal-mac-v}"
    elif [[ "$TAG" =~ ^v ]]; then
      VERSION="${TAG#v}"
    else
      VERSION="$TAG"
      TAG="v${VERSION}"
    fi
  elif [[ -n "$VERSION" ]]; then
    VERSION="${VERSION#v}"
    TAG="v${VERSION}"
  fi
  [[ -n "$VERSION" ]] || { echo "error: --version X.Y.Z or --tag vX.Y.Z is required" >&2; exit 1; }
  echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$' || { echo "error: version must be X.Y.Z, got: $VERSION" >&2; exit 1; }
fi

BUILD_NUMBER="${BUILD_NUMBER:-$(date -u +%Y%m%d%H%M)}"
echo "$BUILD_NUMBER" | grep -qE '^[0-9]+(\.[0-9]+)*$' || { echo "error: --build must be numeric (e.g. 202609251830), got: $BUILD_NUMBER" >&2; exit 1; }

ASC_KEY_ID="${ASC_KEY_ID:-${FA_ASC_KEY_ID:-}}"
ASC_ISSUER_ID="${ASC_ISSUER_ID:-${FA_ASC_ISSUER_ID:-}}"
ASC_KEY_PATH="${ASC_KEY_PATH:-${FA_KEY_LOCATION:-}}"
ASC_KEY_PATH="${ASC_KEY_PATH/#\~/$HOME}"
APPLE_TEAM_ID="${APPLE_TEAM_ID:-}"
MAC_IDENTITY="${MAC_IDENTITY:-}"

if [[ -z "$MAC_IDENTITY" ]]; then
  MAC_IDENTITY="$(security find-identity -v -p codesigning 2>/dev/null \
    | grep "Developer ID Application" | head -1 | sed 's/.*"\(.*\)".*/\1/')"
fi
[[ -n "$MAC_IDENTITY" ]] || {
  echo "error: no \"Developer ID Application\" certificate in the keychain." >&2
  echo "  Import hejiteh-developer-id-application.p12, or set MAC_IDENTITY." >&2
  exit 1
}

if [[ -z "$APPLE_TEAM_ID" && -n "$MAC_IDENTITY" ]]; then
  APPLE_TEAM_ID="$(echo "$MAC_IDENTITY" | sed -E 's/.*\(([A-Z0-9]+)\).*/\1/')"
fi

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
[[ -f "$ASC_KEY_PATH" ]] || { echo "error: App Store Connect API key not found at: $ASC_KEY_PATH" >&2; exit 1; }

echo "-> identity: $MAC_IDENTITY"
echo "-> team ID:  $APPLE_TEAM_ID"
if [[ "$CHECK_ONLY" -eq 1 ]]; then
  echo "-> ASC key:  $ASC_KEY_ID (issuer: $ASC_ISSUER_ID)"
  echo "-> key path: $ASC_KEY_PATH"
  command -v xcodegen >/dev/null 2>&1 || { echo "error: xcodegen not found" >&2; exit 1; }
  command -v xcodebuild >/dev/null 2>&1 || { echo "error: xcodebuild not found" >&2; exit 1; }
  command -v codesign >/dev/null 2>&1 || { echo "error: codesign not found" >&2; exit 1; }
  command -v hdiutil >/dev/null 2>&1 || { echo "error: hdiutil not found" >&2; exit 1; }
  command -v xcrun >/dev/null 2>&1 || { echo "error: xcrun not found" >&2; exit 1; }
  command -v gh >/dev/null 2>&1 || { echo "error: gh CLI not found" >&2; exit 1; }
  gh auth status >/dev/null 2>&1 || { echo "error: not logged in to gh" >&2; exit 1; }
  echo
  echo "✅ Preflight check passed: all macOS release credentials and tools are configured and ready."
  exit 0
fi
echo "-> version:  $VERSION (build $BUILD_NUMBER, tag $TAG$([[ "$BETA" -eq 1 ]] && echo ", beta"))"

if [[ "$NO_UPLOAD" -eq 0 ]]; then
  command -v gh >/dev/null 2>&1 || { echo "error: gh CLI not found (needed to upload; use --no-upload to skip)" >&2; exit 1; }
  gh auth status >/dev/null 2>&1 || { echo "error: not logged in to gh" >&2; exit 1; }
fi

# --- Build --------------------------------------------------------------

echo "-> Regenerating Xcode project via xcodegen..."
(cd "$REPO_ROOT/DeveloperApp" && xcodegen generate)

mkdir -p "$BUILD_DIR"
ARCHIVE_PATH="$BUILD_DIR/FeedbackPortalMac.xcarchive"
EXPORT_PATH="$BUILD_DIR/export"
EXPORT_OPTIONS_PLIST="$BUILD_DIR/ExportOptions.plist"
rm -rf "$DERIVED_DATA" "$ARCHIVE_PATH" "$EXPORT_PATH"

echo "-> Archiving FeedbackPortalMac (Release)..."
# `xcodebuild build` (as opposed to `archive`) always signs with
# com.apple.security.get-task-allow=true regardless of configuration — so
# that a debugger/Instruments can attach to a freshly-run build — and the
# notary service unconditionally rejects any binary carrying it (confirmed
# by a real submission: "The executable requests the
# com.apple.security.get-task-allow entitlement"). `archive` + `-exportArchive`
# is the only xcodebuild path that produces a get-task-allow-free binary,
# which is why this goes through both rather than a single `build` step.
xcodebuild archive \
  -project "$REPO_ROOT/DeveloperApp/FeedbackPortal.xcodeproj" \
  -scheme FeedbackPortalMac \
  -configuration Release \
  -archivePath "$ARCHIVE_PATH" \
  -derivedDataPath "$DERIVED_DATA" \
  -destination 'generic/platform=macOS' \
  CODE_SIGN_STYLE=Manual \
  CODE_SIGN_IDENTITY="$MAC_IDENTITY" \
  DEVELOPMENT_TEAM="$APPLE_TEAM_ID" \
  OTHER_CODE_SIGN_FLAGS="--timestamp" \
  ENABLE_HARDENED_RUNTIME=YES \
  MARKETING_VERSION="$VERSION" \
  CURRENT_PROJECT_VERSION="$BUILD_NUMBER"

cat > "$EXPORT_OPTIONS_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>method</key>
	<string>developer-id</string>
	<key>teamID</key>
	<string>$APPLE_TEAM_ID</string>
	<key>signingStyle</key>
	<string>manual</string>
	<key>signingCertificate</key>
	<string>Developer ID Application</string>
</dict>
</plist>
PLIST

echo "-> Exporting (Developer ID)..."
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_PATH" \
  -exportOptionsPlist "$EXPORT_OPTIONS_PLIST"

APP="$EXPORT_PATH/$APP_NAME"
[[ -d "$APP" ]] || { echo "error: no app bundle at: $APP" >&2; exit 1; }

# --- Verify ------------------------------------------------------------

echo "-> Verifying signature"
codesign --verify --deep --strict --verbose=2 "$APP" 2>&1 | sed 's/^/   /'

# --- DMG ------------------------------------------------------------------

echo "-> Building a DMG"
if [[ "$BETA" -eq 1 ]]; then
  DMG_NAME="FeedbackKit-Portal-beta-$BUILD_NUMBER.dmg"
else
  DMG_NAME="FeedbackKit-Portal-$VERSION.dmg"
fi
OUT_DMG="$BUILD_DIR/$DMG_NAME"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
cp -R "$APP" "$STAGE/"
ln -s /Applications "$STAGE/Applications"
rm -f "$OUT_DMG"
hdiutil create -volname "FeedbackKit Portal" -srcfolder "$STAGE" -ov -format UDZO "$OUT_DMG" >/dev/null
codesign --force --sign "$MAC_IDENTITY" --timestamp "$OUT_DMG"
echo "   $OUT_DMG"

# --- Notarize ------------------------------------------------------------

echo "-> Submitting to the notary service (this takes a few minutes)"
xcrun notarytool submit "$OUT_DMG" \
  --key "$ASC_KEY_PATH" --key-id "$ASC_KEY_ID" --issuer "$ASC_ISSUER_ID" \
  --wait

echo "-> Stapling"
xcrun stapler staple "$OUT_DMG"

echo "-> Final Gatekeeper assessment"
spctl -a -vvv -t open --context context:primary-signature "$OUT_DMG" 2>&1 | sed 's/^/   /' || true

if [[ "$NO_UPLOAD" -eq 1 ]]; then
  echo
  echo "Done (not uploaded): $OUT_DMG"
  exit 0
fi

# --- Publish ------------------------------------------------------------

echo "-> Publishing $TAG"
if [[ "$BETA" -eq 1 ]]; then
  COMMIT_SHA="$(git -C "$REPO_ROOT" rev-parse HEAD)"
  NOTES="Beta build $BUILD_NUMBER of FeedbackKit Portal for macOS, from $COMMIT_SHA.

Built automatically from every push to main. Fixes to reported problems land
here first — if you reported one, the Portal asks you to confirm it once
you're on this build. Stable releases are the non-prerelease ones."
  # One rolling prerelease: replace the previous beta (and its tag) with this
  # build so the download link always points at the newest one.
  gh release delete "$TAG" --repo "$GH_REPO" --yes --cleanup-tag >/dev/null 2>&1 || true
  gh release create "$TAG" --repo "$GH_REPO" --prerelease --target "$COMMIT_SHA" \
    --title "macOS Portal beta ($BUILD_NUMBER)" --notes "$NOTES"
else
  NOTES="FeedbackKit Portal for macOS $VERSION — triage feedback, hand it to your
coding agent, and verify fixes, from your Mac.

Signed with a Developer ID Application certificate and notarized by Apple —
download the DMG, drag FeedbackKit Portal.app to Applications, and it will
open without a Gatekeeper warning. Found a problem? Help › Report a Problem…
(⇧⌘R) sends it straight to the FeedbackKit team."

  if gh release view "$TAG" --repo "$GH_REPO" >/dev/null 2>&1; then
    echo "   release $TAG already exists — attaching to it"
  else
    TITLE="FeedbackKit $VERSION"
    [[ "$TAG" =~ ^portal-mac-v ]] && TITLE="macOS Portal $VERSION"
    gh release create "$TAG" --repo "$GH_REPO" --title "$TITLE" --notes "$NOTES"
  fi
fi
gh release upload "$TAG" --repo "$GH_REPO" --clobber "$OUT_DMG#$DMG_NAME"

cat <<EOF

Published.
  https://github.com/$GH_REPO/releases/tag/$TAG
EOF

# --- Close the loop -------------------------------------------------------
#
# Mark every merged Portal fix contained in this commit as shipped in this
# build, so their reporters are asked to confirm it in the Portal. A beta is
# FeedbackKit's beta channel; a tagged release is production.
CHANNEL="production"
[[ "$BETA" -eq 1 ]] && CHANNEL="beta"
"$REPO_ROOT/scripts/feedbackkit_announce.sh" "$BUILD_NUMBER" \
  --channel "$CHANNEL" --app-version "$VERSION" --product developer-portal-macos
