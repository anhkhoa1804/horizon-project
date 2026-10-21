#!/usr/bin/env bash
# Runs the web app against the LOCAL stack only. Usage: run-web.sh [dev|start] (port 3100)
set -euo pipefail; cd "$(dirname "$0")"; set -a; . ./.env.local-stack; set +a
export NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
export ADMIN_ALLOWED_EMAILS=admin@horizon.test NEXT_TELEMETRY_DISABLED=1
cd ../../../apps/web; exec npx next "${1:-dev}" --port 3100
