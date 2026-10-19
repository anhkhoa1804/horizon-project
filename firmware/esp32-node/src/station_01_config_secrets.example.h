#pragma once
// Copy to station_01_config_secrets.h (gitignored).
// Loaded only by the station1 build. Match REMOTE_CONFIG_STATION_01_KEY
// on the backend and REMOTE_CONFIG_STATION_01_KEY_VALUE on the gateway.
// Use a unique random ASCII key >=32 characters; empty fails closed.
#define REMOTE_CONFIG_KEY_VALUE ""
