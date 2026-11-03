#!/usr/bin/env bash
# The sandbox container cannot reach deno.land; swap the std `serve` import for Deno.serve in a COPY.
# Repo source is untouched.
set -euo pipefail; cd "$(dirname "$0")"
rm -rf .functions-local && mkdir -p .functions-local/edge-ingest
cp ../functions/edge-ingest/bundle.mjs .functions-local/edge-ingest/
{
  echo 'const serve = (h: (r: Request) => Response | Promise<Response>) => Deno.serve(h);'
  tail -n +2 ../functions/edge-ingest/index.ts
} > .functions-local/edge-ingest/index.ts
