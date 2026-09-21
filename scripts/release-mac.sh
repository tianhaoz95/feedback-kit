#!/usr/bin/env bash
# Release orchestrator for FeedbackKit macOS demo app.
# Wraps scripts/release_macos_demo.sh to conform to the standard
# github-actions-macos-release script interface.
#
# Usage:
#   ./scripts/release-mac.sh --check
#   ./scripts/release-mac.sh --version 1.0.0
#   ./scripts/release-mac.sh --tag mac-demo-v1.0.0
#   ./scripts/release-mac.sh --version 1.0.0 --no-upload

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$SCRIPT_DIR/release_macos_demo.sh" "$@"
