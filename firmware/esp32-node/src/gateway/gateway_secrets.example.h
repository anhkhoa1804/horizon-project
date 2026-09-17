#pragma once

/*
  HORIZON gateway - per-deployment secrets.

  HOW TO PROVISION A BOARD
    1. cp gateway_secrets.example.h gateway_secrets.h
    2. paste the ingest token issued for the target deployment
    3. flash

  `gateway_secrets.h` is gitignored and MUST stay that way. This example file
  is committed and must never contain a real value.

  The token must match the Supabase Edge Function secret named
  GATEWAY_INGEST_TOKEN for the same deployment. If the firmware token is wrong
  or the Supabase secret is missing, edge-ingest rejects the packet and stores
  nothing. That is deliberate: production ingest fails closed instead of
  accepting unauthenticated telemetry.
*/

#define GATEWAY_INGEST_TOKEN_VALUE ""
