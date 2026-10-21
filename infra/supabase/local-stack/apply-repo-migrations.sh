#!/usr/bin/env bash
# Applies repo migrations + pilot seed to the LOCAL stack only (127.0.0.1:54322).
set -uo pipefail
cd "$(dirname "$0")"; set -a; . ./.env.local-stack; set +a
export PGPASSWORD="$POSTGRES_PASSWORD"
Q="psql -h 127.0.0.1 -p 54322 -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q"
fail=0
for f in ../migrations/*.sql; do
  if ! $Q -1 -f "$f" >/tmp/mig.out 2>&1; then echo "FAIL $(basename $f): $(grep -m1 ERROR /tmp/mig.out)"; fail=1; else echo "ok   $(basename $f)"; fi
done
[ -f ../seed/pilot_seed.sql ] && { $Q -f ../seed/pilot_seed.sql >/tmp/mig.out 2>&1 && echo "ok   pilot_seed" || echo "FAIL pilot_seed: $(grep -m1 ERROR /tmp/mig.out)"; }
exit $fail
