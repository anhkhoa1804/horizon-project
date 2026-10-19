#define HORIZON_HOST_TEST 1
#define ARDUINOJSON_ENABLE_ARDUINO_STRING 1
#define REMOTE_CONFIG_KEY_VALUE "test-only-config-key-01234567890123456789"
#define REMOTE_CONFIG_STATION_01_KEY_VALUE REMOTE_CONFIG_KEY_VALUE
#define REMOTE_CONFIG_STATION_02_KEY_VALUE REMOTE_CONFIG_KEY_VALUE
#include "../src/shared/gateway_config_arduino.h"
#include <cassert>
#include <iostream>
void selfTest() {
  using namespace horizon;
  const char *key = REMOTE_CONFIG_KEY_VALUE;
  Frame set;
  set.config.station = 2;
  set.config.revision = 1;
  set.config.sample = 5;
  set.config.sleep = 0;
  char wire[CONFIG_FRAME_MAX];
  assert(encode(set, wire, hmacSha256, const_cast<char *>(key)));
  StationRuntime station;
  HardwareSerial serial;
  station.begin(2);
  station.line(String(wire), 2, serial);
  assert(station.state.effective.revision == 1 && serial.lines.size() == 2);
  StationRuntime reboot;
  reboot.begin(2);
  assert(reboot.state.sampleMs(60000) == 5000 &&
         reboot.state.sleepMs(60000) == 0);
  hostPersistenceFailure = true;
  set.config.revision = 2;
  assert(encode(set, wire, hmacSha256, const_cast<char *>(key)));
  reboot.line(String(wire), 2, serial);
  assert(reboot.state.effective.revision == 1);
  Frame rejected;
  assert(decode(serial.lines.back().c_str(), rejected, hmacSha256,
                const_cast<char *>(key)) &&
         rejected.reason == 3);
  // Configuration receipts must never satisfy packet-sequence acknowledgements.
  assert(!reboot.takeTelemetryAck("A2|1"));
  for (char c : std::string("A2|7\n"))
    reboot.consume(c, 2, serial);
  assert(reboot.takeTelemetryAck("A2|7"));
  assert(!reboot.takeTelemetryAck("A1|7"));
  hostPersistenceFailure = false;
  hostStorage.clear();
  GatewayRuntime gateway;
  for (uint32_t revision = 1; revision <= 16; revision++) {
    set.config.revision = revision;
    assert(encode(set, wire, hmacSha256, const_cast<char *>(key)));
    assert(gateway.queue(wire, "SENT"));
  }
  assert(gateway.queue(wire, "SENT") && gateway.eventCount == 16);
  set.config.revision = 17;
  assert(encode(set, wire, hmacSha256, const_cast<char *>(key)));
  assert(!gateway.queue(wire, "SENT"));
  GatewayRuntime restored;
  restored.begin();
  assert(restored.eventCount == 16);
  hostPersistenceFailure = true;
  assert(!restored.forwarded() && restored.eventCount == 16);
  hostPersistenceFailure = false;
  while (restored.eventCount)
    assert(restored.forwarded());
  GatewayRuntime::QueueBlob corrupt = {};
  corrupt.count = 1;
  memset(corrupt.rows[0].frame, 'X', CONFIG_FRAME_MAX);
  hostStorage["horizon-relay/evidence"] =
      std::string(reinterpret_cast<char *>(&corrupt), sizeof(corrupt));
  GatewayRuntime invalid;
  invalid.begin();
  assert(invalid.eventCount == 0);
  Delivery delivery;
  set.config.revision = 1;
  assert(acceptDesired(delivery, set.config));
  delivery.lastSend = 0xfffffff0UL;
  assert(!due(delivery, 16));
  assert(due(delivery, 30016));
  delivery.rejected = 1;
  assert(!due(delivery, 30016));
  set.config.revision = 2;
  assert(acceptDesired(delivery, set.config));
  assert(due(delivery, 30016));
  set.type = 3;
  assert(encode(set, wire, hmacSha256, const_cast<char *>(key)));
  assert(!invalid.receipt(String(wire) + "bad"));
}
int main(int argc, char **argv) {
  if (argc < 2)
    return 2;
  if (std::string(argv[1]) == "--self-test") {
    selfTest();
    std::cout << "{}";
    return 0;
  }
  horizon::GatewayRuntime gateway;
  gateway.begin();
  const bool valid = gateway.ingest(String(argv[1]));
  HardwareSerial uart;
  if (valid)
    gateway.sendDue(uart, hostClock);
  if (argc > 2 && valid) {
    String receipt(argv[2]);
    for (char c : receipt)
      gateway.consume(c);
    gateway.consume('\n');
    horizon::GatewayRuntime reboot;
    reboot.begin();
    assert(reboot.eventCount == gateway.eventCount);
    assert(reboot.stations[1].applied == gateway.stations[1].applied);
    hostPersistenceFailure = true;
    const auto count = gateway.eventCount;
    assert(!gateway.forwarded());
    assert(gateway.eventCount == count);
    hostPersistenceFailure = false;
    while (gateway.eventCount)
      assert(gateway.forwarded());
  }
  JsonDocument out;
  out["valid"] = valid;
  out["pending"] = gateway.eventCount;
  JsonArray frames = out["sent"].to<JsonArray>();
  for (const auto &s : uart.lines)
    frames.add(s);
  out["applied1"] = gateway.stations[0].applied;
  out["applied2"] = gateway.stations[1].applied;
  std::string result;
  serializeJson(out, result);
  std::cout << result;
  return 0;
}
