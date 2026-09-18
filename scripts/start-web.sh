#!/usr/bin/env bash
# Starts the local Supabase stack (Postgres, Auth, Storage, Edge Functions,
# Studio) with this project's schema applied, points the dashboard at
# it, and starts the dashboard's dev server.
set -euo pipefail
cd "$(dirname "$0")/.."

command -v supabase >/dev/null || { echo "Supabase CLI not found — run ./scripts/setup.sh first." >&2; exit 1; }

if ! docker info >/dev/null 2>&1; then
  cat >&2 <<'EOF'
Docker isn't installed or isn't running. The local Supabase stack needs it.

Install Docker Desktop: https://www.docker.com/products/docker-desktop/
Then start it and re-run this script.
EOF
  exit 1
fi

echo "==> Starting local Supabase (this also applies supabase/migrations and supabase/functions)"
supabase start

ENV_FILE="web/.env.local"

echo "==> Writing $ENV_FILE from local Supabase credentials"
if supabase status -o env \
  --override-name api.url=VITE_SUPABASE_URL \
  --override-name auth.anon_key=VITE_SUPABASE_ANON_KEY \
  > "$ENV_FILE" 2>/dev/null \
  && grep -q "VITE_SUPABASE_ANON_KEY=" "$ENV_FILE"; then
  echo "    wrote $ENV_FILE"
else
  # Field names for --override-name can shift between CLI versions; fall back
  # to parsing the classic flat env output so this still works either way.
  echo "    --override-name path didn't match this CLI version, falling back"
  RAW_STATUS=$(supabase status -o env)
  API_URL=$(echo "$RAW_STATUS" | grep -im1 '^API_URL=' | cut -d= -f2-)
  ANON_KEY=$(echo "$RAW_STATUS" | grep -im1 '^ANON_KEY=' | cut -d= -f2-)

  if [ -z "$API_URL" ] || [ -z "$ANON_KEY" ]; then
    echo "    couldn't auto-detect the URL/anon key. Full 'supabase status' output:" >&2
    echo "$RAW_STATUS" >&2
    echo "    Fill in $ENV_FILE manually using web/.env.local.example as a guide." >&2
  else
    {
      echo "VITE_SUPABASE_URL=${API_URL}"
      echo "VITE_SUPABASE_ANON_KEY=${ANON_KEY}"
    } > "$ENV_FILE"
    echo "    wrote $ENV_FILE"
  fi
fi

echo "==> Supabase Studio (inspect tables/storage/auth): http://127.0.0.1:54323"
echo "==> Starting the dashboard at http://localhost:3000"
(cd web && npm run dev)
