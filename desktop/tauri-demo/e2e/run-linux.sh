#!/usr/bin/env bash
# Builds the Tauri demo on Linux in Docker and runs its end-to-end self-test
# under xvfb:
#   desktop/tauri-demo/e2e/run-linux.sh           # build (incrementally) + test
#   desktop/tauri-demo/e2e/run-linux.sh --clean   # remove the image and volumes
#
# The image is only the toolchain. Sources are copied (without this machine's
# node_modules/target, which are for its own OS) into a temp dir mounted
# read-only; cargo output, node_modules and the cargo registry live in named
# Docker volumes so reruns are incremental and nothing grows unbounded.
set -euo pipefail
cd "$(dirname "$0")/../../.."
IMAGE=feedbackkit-tauri-linux-e2e
VOLUMES=(feedbackkit-tauri-linux-target feedbackkit-tauri-linux-node-modules feedbackkit-tauri-linux-cargo)

if [ "${1:-}" = "--clean" ]; then
  docker image rm -f "$IMAGE" >/dev/null 2>&1 || true
  docker volume rm "${VOLUMES[@]}" >/dev/null 2>&1 || true
  echo "Removed $IMAGE and its volumes."
  exit 0
fi

SOURCES="$(mktemp -d)"
trap 'rm -rf "$SOURCES"' EXIT
rsync -a --exclude node_modules --exclude target --exclude dist --exclude 'e2e/output' --exclude '.vite' \
  web-sdk desktop "$SOURCES/"

docker build -q -f desktop/tauri-demo/e2e/linux.Dockerfile -t "$IMAGE" desktop/tauri-demo/e2e >/dev/null
docker run --rm \
  -v "$SOURCES:/src:ro" \
  -v feedbackkit-tauri-linux-target:/repo/desktop/tauri-demo/src-tauri/target \
  -v feedbackkit-tauri-linux-node-modules:/repo/desktop/tauri-demo/node_modules \
  -v feedbackkit-tauri-linux-cargo:/root/.cargo/registry \
  "$IMAGE" sh -c '
    set -e
    rsync -a --delete --exclude node_modules --exclude target /src/ /repo/
    cd desktop/tauri-demo
    npm install --no-audit --no-fund --loglevel=error
    npx tauri build --debug --no-bundle 2>&1 | grep -E "^(error|warning: unused)|Finished" || true
    xvfb-run -a dbus-run-session -- node e2e/selftest.mjs 2>&1 | grep -v -E "dbind-WARNING|AT-SPI"
  '
