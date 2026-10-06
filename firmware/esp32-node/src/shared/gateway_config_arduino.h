#pragma once
#include "station_config_arduino.h"
#include <ArduinoJson.h>
#ifndef REMOTE_CONFIG_STATION_01_KEY_VALUE
#define REMOTE_CONFIG_STATION_01_KEY_VALUE ""
#endif
#ifndef REMOTE_CONFIG_STATION_02_KEY_VALUE
#define REMOTE_CONFIG_STATION_02_KEY_VALUE ""
#endif
namespace horizon {
struct PendingEvidence {
  char frame[CONFIG_FRAME_MAX];
  char state[16];
};
class GatewayRuntime {
public:
  Delivery stations[2];
  PendingEvidence events[16] = {};
  uint8_t eventCount = 0;
  String rx;
  uint32_t lastByte = 0;
  uint32_t lastDownlink = 0;
  const char *key(uint8_t id) {
    return id == 1   ? REMOTE_CONFIG_STATION_01_KEY_VALUE
           : id == 2 ? REMOTE_CONFIG_STATION_02_KEY_VALUE
                     : "";
  }
  struct QueueBlob {
    uint8_t count;
    PendingEvidence rows[16];
  };
  void begin() {
    Preferences nvs;
    if (!nvs.begin("horizon-relay", true))
      return;
    QueueBlob blob = {};
    if (nvs.getBytesLength("evidence") == sizeof(blob) &&
        nvs.getBytes("evidence", &blob, sizeof(blob)) == sizeof(blob) &&
        blob.count <= 16) {
      bool valid = true;
      for (uint8_t i = 0; i < blob.count; i++) {
        if (!memchr(blob.rows[i].frame, 0, CONFIG_FRAME_MAX) ||
            !memchr(blob.rows[i].state, 0, 16)) {
          valid = false;
          break;
        }
        Frame f;
        uint8_t id = strstr(blob.rows[i].frame, "|S1|")   ? 1
                     : strstr(blob.rows[i].frame, "|S2|") ? 2
                                                          : 0;
        const char *expected[] = {"SENT", "ACKNOWLEDGED", "REJECTED",
                                  "APPLIED"};
        if (!decode(blob.rows[i].frame, f, hmacSha256,
                    const_cast<char *>(key(id))) ||
            strcmp(blob.rows[i].state, expected[f.type])) {
          valid = false;
          break;
        }
      }
      if (valid) {
        eventCount = blob.count;
        memcpy(events, blob.rows, sizeof(events));
      } else
        Serial.println("[CONFIG] Persisted evidence invalid; refusing "
                       "unverified forwarding");
    }
    for (uint8_t id = 1; id <= 2; id++) {
      String saved = nvs.getString(id == 1 ? "applied1" : "applied2", "");
      Frame f;
      if (decode(saved.c_str(), f, hmacSha256, const_cast<char *>(key(id))) &&
          f.type == 3 && f.config.station == id) {
        stations[id - 1].desired = f.config;
        stations[id - 1].applied = f.config.revision;
      }
      String rejected = nvs.getString(id == 1 ? "rejected1" : "rejected2", "");
      if (decode(rejected.c_str(), f, hmacSha256,
                 const_cast<char *>(key(id))) &&
          f.type == 2 && f.config.station == id && f.reason != 3)
        stations[id - 1].rejected = f.config.revision;
    }
    nvs.end();
  }
  bool saveQueue() {
    Preferences nvs;
    if (!nvs.begin("horizon-relay", false))
      return false;
    QueueBlob blob = {};
    blob.count = eventCount;
    memcpy(blob.rows, events, sizeof(events));
    bool ok = nvs.putBytes("evidence", &blob, sizeof(blob)) == sizeof(blob);
    nvs.end();
    return ok;
  }
  bool queue(const char *frame, const char *state) {
    for (uint8_t i = 0; i < eventCount; i++)
      if (strcmp(events[i].frame, frame) == 0 &&
          strcmp(events[i].state, state) == 0)
        return true;
    if (eventCount >= 16 || strlen(frame) >= CONFIG_FRAME_MAX ||
        strlen(state) >= 16)
      return false;
    strncpy(events[eventCount].frame, frame, CONFIG_FRAME_MAX - 1);
    strncpy(events[eventCount].state, state, 15);
    eventCount++;
    if (!saveQueue()) {
      eventCount--;
      return false;
    }
    return true;
  }
  bool receipt(const String &line) {
    Frame f;
    uint8_t id = line.indexOf("|S1|") >= 0   ? 1
                 : line.indexOf("|S2|") >= 0 ? 2
                                             : 0;
    if (!decode(line.c_str(), f, hmacSha256, const_cast<char *>(key(id))) ||
        f.type == 0 || f.config.station != id)
      return false;
    const char *state = f.type == 1   ? "ACKNOWLEDGED"
                        : f.type == 2 ? "REJECTED"
                                      : "APPLIED";
    if (!queue(line.c_str(), state))
      return false;
    if (f.type == 2 && f.reason != 3 &&
        same(f.config, stations[id - 1].desired)) {
      Preferences nvs;
      if (nvs.begin("horizon-relay", false)) {
        if (nvs.putString(id == 1 ? "rejected1" : "rejected2", line) ==
            line.length())
          stations[id - 1].rejected = f.config.revision;
        nvs.end();
      }
    }
    if (f.type == 3 && same(f.config, stations[id - 1].desired)) {
      Preferences nvs;
      if (nvs.begin("horizon-relay", false)) {
        bool ok = nvs.putString(id == 1 ? "applied1" : "applied2", line) ==
                  line.length();
        nvs.end();
        if (ok)
          applyReceipt(stations[id - 1], f);
      }
    }
    return true;
  }
  // Return true only for bytes belonging to a configuration frame. Existing
  // S1/S2 CRC parser remains authoritative for telemetry.
  bool consume(char c) {
    if (millis() - lastByte > 1500)
      rx = "";
    lastByte = millis();
    if (rx.length() == 0) {
      if (c != 'H')
        return false;
      rx = "H";
      return true;
    }
    if (c == '\n') {
      receipt(rx);
      rx = "";
      return true;
    }
    if (c == '\r')
      return true;
    rx += c;
    if (rx.length() < 4 && !String("HC1|").startsWith(rx)) {
      rx = "";
      return false;
    }
    if (rx.length() >= CONFIG_FRAME_MAX)
      rx = "";
    return true;
  }
  bool ingest(const String &body) {
    if (body.length() > 2048)
      return false;
    JsonDocument doc;
    if (deserializeJson(doc, body.c_str()) || !doc["ok"].is<bool>() ||
        doc["ok"].as<bool>() != true ||
        !doc["contract_version"].is<uint32_t>() ||
        doc["contract_version"].as<uint32_t>() != 1 ||
        doc["gateway_id"] != "GATEWAY_01" || !doc["frames"].is<JsonArray>() ||
        !doc["configs"].is<JsonArray>())
      return false;
    JsonArray frames = doc["frames"];
    JsonArray configs = doc["configs"];
    if (frames.size() > 2 || frames.size() != configs.size())
      return false;
    Config candidates[2];
    bool seen[2] = {false, false};
    uint8_t count = 0;
    for (JsonVariant v : frames) {
      if (!v.is<const char *>())
        return false;
      const char *wire = v.as<const char *>();
      uint8_t id = strstr(wire, "|S1|") ? 1 : strstr(wire, "|S2|") ? 2 : 0;
      Frame f;
      if (!decode(wire, f, hmacSha256, const_cast<char *>(key(id))) ||
          f.type != 0 || f.config.station != id || seen[id - 1])
        return false;
      seen[id - 1] = true;
      JsonObject c = configs[count];
      if (c.size() != 6 || !c["contract_version"].is<uint32_t>() ||
          c["contract_version"].as<uint32_t>() != 1 ||
          c["station_id"] != (id == 1 ? "STATION_01" : "STATION_02") ||
          !c["config_revision"].is<uint32_t>() ||
          c["config_revision"].as<uint32_t>() != f.config.revision ||
          !c["sample_interval_seconds"].is<uint32_t>() ||
          c["sample_interval_seconds"].as<uint32_t>() != f.config.sample ||
          !c["sleep_interval_seconds"].is<uint32_t>() ||
          c["sleep_interval_seconds"].as<uint32_t>() != f.config.sleep ||
          c["mode"] != CONFIG_MODES[f.config.mode])
        return false;
      Delivery copy = stations[id - 1];
      if (!acceptDesired(copy, f.config))
        return false;
      candidates[count++] = f.config;
    }
    for (uint8_t i = 0; i < count; i++) {
      acceptDesired(stations[candidates[i].station - 1], candidates[i]);
    }
    return true;
  }
  void sendDue(HardwareSerial &serial, uint32_t now, uint8_t preferred = 0) {
    if (lastDownlink && uint32_t(now - lastDownlink) < 2000)
      return;
    for (uint8_t i = 0; i < 2; i++) {
      if (preferred && preferred != i + 1)
        continue;
      Delivery &d = stations[i];
      if (!due(d, now) || eventCount > 12)
        continue;
      Frame f;
      f.config = d.desired;
      char frame[CONFIG_FRAME_MAX];
      if (!encode(f, frame, hmacSha256, const_cast<char *>(key(i + 1))))
        continue;
      serial.println(frame);
      serial.flush();
      d.lastSend = now;
      lastDownlink = now; // SENT evidence follows actual UART transmission, not
                          // merely queueing.
      if (!queue(frame, "SENT")) {
        Serial.println(
            "[CONFIG] SENT evidence persistence failed; retry retained");
      }
      return;
    }
  }
  String eventJson() {
    JsonDocument doc;
    doc["contract_version"] = 1;
    doc["gateway_id"] = "GATEWAY_01";
    doc["state"] = events[0].state;
    doc["frame"] = events[0].frame;
    String out;
    serializeJson(doc, out);
    return out;
  }
  bool forwarded() {
    if (!eventCount)
      return true;
    PendingEvidence old[16];
    memcpy(old, events, sizeof(events));
    uint8_t count = eventCount;
    for (uint8_t i = 1; i < eventCount; i++)
      events[i - 1] = events[i];
    eventCount--;
    if (!saveQueue()) {
      memcpy(events, old, sizeof(events));
      eventCount = count;
      return false;
    }
    return true;
  }
};
} // namespace horizon
