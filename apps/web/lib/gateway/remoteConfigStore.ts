import "server-only";
import type { AppSupabase } from "@/lib/repositories/base";
import { RemoteDbError, type RemoteStore } from "./remoteConfigService";
import { isRemoteConfig, type RemoteConfig } from "./remoteProtocol";
export function remoteConfigStore(
  client: AppSupabase | null,
): RemoteStore | null {
  if (!client) return null;
  return {
    async desired() {
      const { data, error } = await client
        .from("device_runtime_configs")
        .select(
          "contract_version,config_revision,station_id,sample_interval_seconds,sleep_interval_seconds,mode",
        )
        .eq("contract_version", 1)
        .in("station_id", ["STATION_01", "STATION_02"])
        .order("station_id");
      if (error) throw new RemoteDbError(error.code);
      if (!data?.every(isRemoteConfig))
        throw new RemoteDbError("invalid_database_contract");
      return data as RemoteConfig[];
    },
    async put(config, expected, actor) {
      const { data, error } = await client.rpc("store_remote_config", {
        p_config: config,
        p_expected_revision: expected,
        p_actor: actor,
      });
      if (error) throw new RemoteDbError(error.code);
      return data;
    },
    async record(config, state, evidence, reason) {
      const { data, error } = await client.rpc("record_remote_config_event", {
        p_config: config,
        p_state: state,
        p_evidence: evidence,
        p_actor: "GATEWAY_01",
        p_reason: reason ?? null,
      });
      if (error) throw new RemoteDbError(error.code);
      return data;
    },
  };
}
