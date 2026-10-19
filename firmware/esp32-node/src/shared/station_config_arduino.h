#pragma once
#include "remote_config.h"
#include <Arduino.h>
#include <Preferences.h>
#include <mbedtls/md.h>
#if !defined(HORIZON_HOST_TEST)
#if defined(HORIZON_STATION_BUILD_01) &&                                       \
    __has_include("../station_01_config_secrets.h")
#include "../station_01_config_secrets.h"
#elif defined(HORIZON_STATION_BUILD_02) &&                                     \
    __has_include("../station_02_config_secrets.h")
#include "../station_02_config_secrets.h"
#endif
#endif
#ifndef REMOTE_CONFIG_KEY_VALUE
#define REMOTE_CONFIG_KEY_VALUE ""
#endif
namespace horizon {
inline bool hmacSha256(const char *text, size_t size, char digest[65],
                       void *keyPtr) {
  const char *key = static_cast<const char *>(keyPtr);
  if (!key || strlen(key) < 32)
    return false;
  unsigned char result[32];
  if (mbedtls_md_hmac(mbedtls_md_info_from_type(MBEDTLS_MD_SHA256),
                      reinterpret_cast<const unsigned char *>(key), strlen(key),
                      reinterpret_cast<const unsigned char *>(text), size,
                      result) != 0)
    return false;
  for (int i = 0; i < 32; i++)
    snprintf(digest + i * 2, 3, "%02X", result[i]);
  return true;
}
inline bool persistStation(const char *frame, void *) {
  Preferences nvs;
  if (!nvs.begin("horizon-config", false))
    return false;
  const size_t count = nvs.putString("effective", frame);
  const bool ok =
      count == strlen(frame) && nvs.getString("effective", "") == frame;
  nvs.end();
  return ok;
}
inline void replyStation(const char *frame, void *serial) {
  static_cast<HardwareSerial *>(serial)->println(frame);
  static_cast<HardwareSerial *>(serial)->flush();
}
class StationRuntime {
public:
  StationConfig state;
  String rx;
  String telemetryAck;
  bool takeTelemetryAck(const String &expected) {
    bool matches = telemetryAck == expected;
    telemetryAck = "";
    return matches;
  }
  uint32_t lastByte = 0;
  void begin(uint8_t station) {
    state.effective.station = station;
    Preferences nvs;
    if (!nvs.begin("horizon-config", true))
      return;
    const String stored = nvs.getString("effective", "");
    nvs.end();
    if (stored.length() &&
        !state.load(stored.c_str(), station, hmacSha256,
                    const_cast<char *>(REMOTE_CONFIG_KEY_VALUE)))
      Serial.println(
          "[CONFIG] Persisted configuration invalid; bootstrap only");
  }
  void line(const String &text, uint8_t station, HardwareSerial &serial) {
    if (text.startsWith(station == 1 ? "A1|" : "A2|")) {
      telemetryAck = text;
      return;
    }
    if (text.startsWith("HC1|"))
      state.receive(text.c_str(), station, hmacSha256,
                    const_cast<char *>(REMOTE_CONFIG_KEY_VALUE), persistStation,
                    nullptr, replyStation, &serial);
  }
  void consume(char c, uint8_t station, HardwareSerial &serial) {
    if (millis() - lastByte > 1500)
      rx = "";
    lastByte = millis();
    if (c == '\n') {
      line(rx, station, serial);
      rx = "";
    } else if (c != '\r') {
      rx += c;
      if (rx.length() >= CONFIG_FRAME_MAX)
        rx = "";
    }
  }
};
} // namespace horizon
