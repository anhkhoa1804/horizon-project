#pragma once

#include <cmath>
#include <cctype>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>
#include <vector>
#include <utility>

namespace horizon {

struct SimpleTelemetryFrame {
  bool station1 = false;
  uint32_t sequence = 0;
  std::vector<std::string> fields;
};

inline uint16_t simpleCrc16(const std::string &text) {
  uint16_t crc = 0xFFFF;
  for (const unsigned char c : text) {
    crc ^= static_cast<uint16_t>(c) << 8;
    for (uint8_t bit = 0; bit < 8; ++bit) {
      crc = (crc & 0x8000) ? static_cast<uint16_t>((crc << 1) ^ 0x1021) : static_cast<uint16_t>(crc << 1);
    }
  }
  return crc;
}

inline bool simpleMissing(const std::string &value) {
  return value.empty() || value == "x" || value == "X";
}

inline bool simpleNumericOrMissing(const std::string &value) {
  if (simpleMissing(value)) return true;
  char *end = nullptr;
  std::strtod(value.c_str(), &end);
  return end != value.c_str() && *end == '\0' && std::isfinite(std::strtod(value.c_str(), nullptr));
}

inline bool parseSimpleTelemetryFrame(const std::string &line, SimpleTelemetryFrame &out) {
  const size_t lastSep = line.rfind('|');
  if (lastSep == std::string::npos || lastSep == 0 || line.size() - lastSep - 1 != 4) return false;
  const std::string body = line.substr(0, lastSep);
  const std::string crcText = line.substr(lastSep + 1);
  for (const char c : crcText) if (!std::isxdigit(static_cast<unsigned char>(c))) return false;
  char *crcEnd = nullptr;
  const unsigned long expected = std::strtoul(crcText.c_str(), &crcEnd, 16);
  if (!crcEnd || *crcEnd != '\0' || expected > 0xFFFF || simpleCrc16(body) != expected) return false;

  std::vector<std::string> fields;
  size_t start = 0;
  while (true) {
    const size_t end = body.find('|', start);
    fields.push_back(body.substr(start, end == std::string::npos ? end : end - start));
    if (end == std::string::npos) break;
    start = end + 1;
  }
  const bool station1 = fields.size() == 11 && fields[0] == "S1";
  const bool station2 = fields.size() == 13 && fields[0] == "S2";
  if (!station1 && !station2) return false;
  if (fields[1].empty()) return false;
  char *sequenceEnd = nullptr;
  const unsigned long sequence = std::strtoul(fields[1].c_str(), &sequenceEnd, 10);
  if (!sequenceEnd || *sequenceEnd != '\0' || sequenceEnd == fields[1].c_str() || sequence > UINT32_MAX) return false;
  for (size_t index = 2; index < fields.size(); ++index) {
    if (!simpleNumericOrMissing(fields[index])) return false;
  }
  out.station1 = station1;
  out.sequence = static_cast<uint32_t>(sequence);
  out.fields = std::move(fields);
  return true;
}

inline uint64_t simpleFrameFingerprint(const std::string &line) {
  uint64_t hash = 1469598103934665603ULL;
  for (const unsigned char c : line) { hash ^= c; hash *= 1099511628211ULL; }
  return hash;
}

inline std::string stableStationMessageId(const SimpleTelemetryFrame &frame, const std::string &line) {
  char messageId[64];
  const uint64_t fingerprint = simpleFrameFingerprint(line);
  std::snprintf(messageId, sizeof(messageId), "%s-%lu-%08lX%08lX",
      frame.station1 ? "STATION_01" : "STATION_02",
      static_cast<unsigned long>(frame.sequence),
      static_cast<unsigned long>(fingerprint >> 32),
      static_cast<unsigned long>(fingerprint & 0xFFFFFFFFULL));
  return messageId;
}

inline std::string wireNumber(const std::string &value) { return simpleMissing(value) ? "null" : value; }
inline std::string scaledWireNumber(const std::string &value, double scale) {
  if (simpleMissing(value)) return "null";
  char buffer[48];
  std::snprintf(buffer, sizeof(buffer), "%.0f", std::strtod(value.c_str(), nullptr) * scale);
  return buffer;
}

// This is the production Gateway field-to-TelemetryPayloadV1 mapping. Keep
// wire parsing, station identity, message identity and null semantics together.
inline std::string simplePacketToTelemetryJson(const SimpleTelemetryFrame &frame, const std::string &line, const std::string &gatewayId) {
  const auto &f = frame.fields;
  const std::string id = stableStationMessageId(frame, line);
  char head[512];
  std::snprintf(head, sizeof(head), "{\"contract_version\":\"v1\",\"reading_kind\":\"%s\",\"device_id\":\"%s\",\"firmware_version\":\"simple-qos1-wire\",\"message_id\":\"%s\",\"timestamp\":0,\"sequence\":%lu,\"summary_minutes\":%s",
      frame.station1 ? "water" : "soil", frame.station1 ? "STATION_01" : "STATION_02", id.c_str(),
      static_cast<unsigned long>(frame.sequence), wireNumber(f[2]).c_str());
  std::string json(head);
  if (frame.station1) {
    const bool ecMissing = simpleMissing(f[5]);
    const bool levelMissing = simpleMissing(f[4]);
    const uint8_t faults = (ecMissing ? 1 : 0) | (levelMissing ? 2 : 0);
    char faultText[768]; std::snprintf(faultText, sizeof(faultText), ",\"fault_flags\":%u,\"sensor_height_cm\":350.0,\"distance_cm\":%s,\"water_level\":%s,\"ec_ms_cm\":%s,\"ec_us_cm\":%s,\"temperature_c\":%s,\"tds_ppm\":%s,\"salinity\":%s,\"salinity_ppm\":%s,\"battery_voltage\":%s,\"battery_percent\":%s,\"sensor_status\":{\"ec_probe\":\"%s\",\"ultrasonic\":\"%s\"}",
      faults, wireNumber(f[3]).c_str(), wireNumber(f[4]).c_str(), wireNumber(f[5]).c_str(), scaledWireNumber(f[5], 1000).c_str(), wireNumber(f[6]).c_str(), wireNumber(f[7]).c_str(), wireNumber(f[8]).c_str(), scaledWireNumber(f[8], 1000).c_str(), wireNumber(f[9]).c_str(), wireNumber(f[10]).c_str(), ecMissing ? "fault" : "ok", levelMissing ? "fault" : "ok");
    json += faultText;
  } else {
    uint8_t faults = 0;
    for (size_t i = 3; i <= 10; ++i) if (simpleMissing(f[i])) faults |= static_cast<uint8_t>(1u << (i - 3));
    char values[620]; std::snprintf(values, sizeof(values), ",\"fault_flags\":%u,\"crop\":\"grapefruit\",\"soil\":{\"air_temp_c\":%s,\"air_humidity_pct\":%s,\"soil_temp_c\":%s,\"soil_moisture_pct\":%s,\"soil_ec_ms_cm\":%s,\"soil_ec_us_cm\":%s,\"soil_salinity\":%s,\"soil_tds\":%s,\"soil_ph\":%s},\"battery_voltage\":%s,\"battery_percent\":%s",
      faults, wireNumber(f[3]).c_str(), wireNumber(f[4]).c_str(), wireNumber(f[5]).c_str(), wireNumber(f[6]).c_str(), wireNumber(f[7]).c_str(), scaledWireNumber(f[7], 1000).c_str(), wireNumber(f[8]).c_str(), wireNumber(f[9]).c_str(), wireNumber(f[10]).c_str(), wireNumber(f[11]).c_str(), wireNumber(f[12]).c_str());
    json += values;
  }
  json += ",\"raw_station_payload\":{\"wire_protocol\":\"S1/S2|...|CRC16\",\"gateway_id\":\"" + gatewayId + "\",\"timestamp_semantics\":\"gateway_network_receipt_time\"}}";
  return json;
}

}  // namespace horizon
