#!/usr/bin/env bash
# Sets passwords on the image's built-in service roles (local stack only).
set -euo pipefail
cd "$(dirname "$0")"; set -a; . ./.env.local-stack; set +a
for r in authenticator supabase_auth_admin supabase_storage_admin postgres; do
  docker compose --env-file .env.local-stack exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" db psql -U supabase_admin -h localhost -d postgres -v ON_ERROR_STOP=1 </dev/null -c "alter role $r with password '$POSTGRES_PASSWORD'"
done
