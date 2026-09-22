#!/usr/bin/env bash
# One-time setup: installs the CLIs this project needs and gets both the iOS
# demo app project and the web dashboard's dependencies ready.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Checking prerequisites"

if ! command -v xcodegen >/dev/null; then
  echo "Installing xcodegen (generates the DemoApp Xcode project from DemoApp/project.yml)..."
  brew install xcodegen
fi

if ! command -v supabase >/dev/null; then
  echo "Installing the Supabase CLI..."
  brew tap supabase/tap
  brew install supabase
fi

if ! command -v docker >/dev/null; then
  cat >&2 <<'EOF'

Docker is not installed. The local Supabase stack (Postgres, Auth, Storage,
Edge Functions) that ./scripts/start-web.sh spins up needs it.

Install Docker Desktop: https://www.docker.com/products/docker-desktop/
Once it's installed and running, you're good to go — no need to re-run this
script just for that.

EOF
fi

echo "==> Generating the iOS demo app's Xcode project"
(cd DemoApp && xcodegen generate)

echo "==> Installing root and web dashboard dependencies"
npm install
(cd web && npm install)

cat <<'EOF'

Setup complete. Next:
  ./scripts/run-ios.sh          Build and launch the demo app (FeedbackKit in action) in Simulator
  ./scripts/start-web.sh        Start local Supabase + the developer dashboard
  ./scripts/deploy-functions.sh Deploy Edge Functions to the hosted project

EOF
