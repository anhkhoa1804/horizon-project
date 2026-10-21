#!/usr/bin/env bash
# Usage: run_migrations.sh <dbname> [last_migration_number]   (isolated cluster only: -h /tmp/pgiso -p 54329)
set -euo pipefail
DB=$1; LAST=${2:-999}
P="psql -h /tmp/pgiso -p 54329 -U postgres -v ON_ERROR_STOP=1 -q"
dropdb -h /tmp/pgiso -p 54329 -U postgres --if-exists "$DB"; createdb -h /tmp/pgiso -p 54329 -U postgres "$DB"
$P -d "$DB" -f "$(dirname "$0")/00_supabase_shim.sql"
for f in "$(dirname "$0")"/../migrations/*.sql; do
  n=$(basename "$f" | cut -c1-3); [ $((10#$n)) -le $((10#$LAST)) ] || continue
  echo "applying $(basename "$f")"; $P -d "$DB" -f "$f"
done
