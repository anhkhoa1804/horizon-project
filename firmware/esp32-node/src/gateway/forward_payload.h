#pragma once
// Builds the TelemetryPayloadV1 JSON for one queued frame, with honest
// timestamp semantics. Host-testable; shares the field mapping with
// simple_telemetry.h so backend contract tests cover both.
#include <string>
#include "simple_telemetry.h"

namespace horizon {

struct ForwardTiming {
  uint32_t receiptEpoch = 0;   // 0 = unknown
  uint32_t forwardEpoch = 0;   // gateway clock "now"; must be valid (non-zero)
  uint32_t maxFreshAgeS = 240; // stay inside edge-ingest's 300 s drift window
};

inline void replaceFirst(std::string &s, const std::string &from, const std::string &to) {
  const size_t at = s.find(from);
  if (at != std::string::npos) s.replace(at, from.size(), to);
}

/// Fresh frame (received <= maxFreshAgeS ago): `timestamp` = true receipt time,
/// semantics unchanged. Backlog frame (older, or receipt time unknown after a
/// reboot): `timestamp` = forward time so the server's drift check passes, and
/// raw_station_payload says so explicitly - received_at_epoch / queued_seconds -
/// so nobody reads a queued reading as a live one.
inline std::string makeForwardJson(const SimpleTelemetryFrame &frame, const std::string &line,
                                   const std::string &gatewayId, const ForwardTiming &t) {
  std::string json = simplePacketToTelemetryJson(frame, line, gatewayId);
  const bool known = t.receiptEpoch != 0 && t.forwardEpoch >= t.receiptEpoch;
  const uint32_t age = known ? t.forwardEpoch - t.receiptEpoch : 0;
  if (known && age <= t.maxFreshAgeS) {
    replaceFirst(json, "\"timestamp\":0", "\"timestamp\":" + std::to_string(t.receiptEpoch));
    return json;
  }
  replaceFirst(json, "\"timestamp\":0", "\"timestamp\":" + std::to_string(t.forwardEpoch));
  replaceFirst(json, "\"timestamp_semantics\":\"gateway_network_receipt_time\"",
               std::string("\"timestamp_semantics\":\"gateway_forward_time\",\"received_at_epoch\":") +
               (known ? std::to_string(t.receiptEpoch) : std::string("null")) + ",\"queued_seconds\":" +
               (known ? std::to_string(age) : std::string("null")));
  return json;
}

}  // namespace horizon
