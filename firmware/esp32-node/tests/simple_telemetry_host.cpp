#include <iostream>
#include "../../src/gateway/simple_telemetry.h"

int main(int argc, char **argv) {
  if (argc >= 4 && std::string(argv[1]) == "make") {
    std::string body;
    for (int i = 2; i < argc; ++i) { if (!body.empty()) body += '|'; body += argv[i]; }
    char crc[5]; std::snprintf(crc, sizeof(crc), "%04X", horizon::simpleCrc16(body));
    std::cout << body << '|' << crc;
    return 0;
  }
  if (argc != 4 || std::string(argv[1]) != "map") return 64;
  horizon::SimpleTelemetryFrame frame;
  const std::string line(argv[2]);
  if (!horizon::parseSimpleTelemetryFrame(line, frame)) return 2;
  std::cout << horizon::simplePacketToTelemetryJson(frame, line, argv[3]);
  return 0;
}
