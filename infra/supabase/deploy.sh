#!/usr/bin/env bash
# Cross-platform deploy: migrations, edge secrets, bundle, edge function.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env.supabase"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}. Copy .env.supabase.example and fill values." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source <(grep -v '^\s*#' "${ENV_FILE}" | grep -v '^\s*$' | sed 's/\r$//')
set +a

if [[ -z "${DATABASE_URL:-}" && -z "${DATABASE_POOLER_URL:-}" ]]; then
  echo "DATABASE_URL or DATABASE_POOLER_URL must be set in .env.supabase." >&2
  exit 1
fi

if [[ -z "${SUPABASE_PROJECT_REF:-}" && "${SUPABASE_URL:-}" =~ https://([^.]+)\.supabase\.co ]]; then
  export SUPABASE_PROJECT_REF="${BASH_REMATCH[1]}"
fi

echo "Applying SQL migrations and pilot seed..."
node "${SCRIPT_DIR}/apply-migrations.mjs"

echo "Pushing edge function secrets..."
node "${SCRIPT_DIR}/push-edge-secrets.mjs"

echo "Building shared edge-ingest bundle..."
npm run build:edge --prefix "${SCRIPT_DIR}/../../services/edge-ingestion"

if [[ -z "${SUPABASE_PROJECT_REF:-}" ]]; then
  echo "SUPABASE_PROJECT_REF is required for function deploy." >&2
  exit 1
fi

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "Warning: SUPABASE_ACCESS_TOKEN not set. Ensure 'npx supabase login' has been run." >&2
fi

echo "Deploying edge-ingest function..."
cd "${SCRIPT_DIR}"
npx supabase functions deploy edge-ingest \
  --project-ref "${SUPABASE_PROJECT_REF}" \
  --no-verify-jwt

echo "Deploy finished."
