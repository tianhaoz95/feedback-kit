#!/usr/bin/env bash
# Deploys Supabase Edge Functions to the hosted project.
# Also automated in CI via .github/workflows/deploy-functions.yml on push to main.
#
# Usage:
#   ./scripts/deploy-functions.sh              # deploy every function
#   ./scripts/deploy-functions.sh ingest-feedback   # deploy just one

set -euo pipefail
cd "$(dirname "$0")/.."

SUPABASE_PROJECT_REF="${SUPABASE_PROJECT_REF:-gpucoladcyvijefdjudf}"

command -v supabase >/dev/null || { echo "Supabase CLI not found — run ./scripts/setup.sh first." >&2; exit 1; }

if ! supabase projects list >/dev/null 2>&1; then
  cat >&2 <<'EOF'
Not logged in to the Supabase CLI (or the login has expired).

Run this once per machine, then re-run this script:
  supabase login
EOF
  exit 1
fi

echo "==> Deploying ${1:-all functions} to project $SUPABASE_PROJECT_REF"
# --use-api bundles server-side instead of via a local Docker container, so
# this doesn't depend on Docker being available (or working) on this machine.
supabase functions deploy "$@" --project-ref "$SUPABASE_PROJECT_REF" --use-api

echo "==> Done"
