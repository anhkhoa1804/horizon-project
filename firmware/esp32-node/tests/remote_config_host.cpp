#include "../src/shared/remote_config.h"
#include <iostream>
#include <openssl/hmac.h>
#include <string>
#include <vector>
bool mac(const char *text, size_t size, char digest[65], void *ctx) {
  std::string &key = *static_cast<std::string *>(ctx);
  if (key.size() < 32)
    return false;
  unsigned char result[32];
  unsigned int length = 0;
  HMAC(EVP_sha256(), key.data(), int(key.size()),
       reinterpret_cast<const unsigned char *>(text), size, result, &length);
  for (int i = 0; i < 32; i++)
    snprintf(digest + i * 2, 3, "%02X", result[i]);
  return length == 32;
}
struct Storage {
  std::string value;
  bool fail = false;
};
bool save(const char *text, void *ctx) {
  auto &s = *static_cast<Storage *>(ctx);
  if (s.fail)
    return false;
  s.value = text;
  return true;
}
void reply(const char *text, void *ctx) {
  static_cast<std::vector<std::string> *>(ctx)->push_back(text);
}
std::string quote(const std::string &s) {
  std::string out = "\"";
  for (char c : s) {
    if (c == '"' || c == '\\')
      out += '\\';
    out += c;
  }
  return out + '"';
}
int main(int argc, char **argv) {
  if (argc < 4)
    return 2;
  std::string action = argv[1], key = argv[2];
  if (action == "decode") {
    horizon::Frame f;
    if (!horizon::decode(argv[3], f, mac, &key))
      return 1;
    std::cout << "{\"revision\":" << f.config.revision
              << ",\"sample\":" << f.config.sample
              << ",\"sleep\":" << f.config.sleep
              << ",\"station\":" << int(f.config.station)
              << ",\"mode\":" << int(f.config.mode)
              << ",\"type\":" << int(f.type) << ",\"reason\":" << int(f.reason)
              << "}";
    return 0;
  }
  if (action == "station" && argc == 7) {
    horizon::StationConfig station;
    uint8_t id = uint8_t(atoi(argv[3]));
    Storage storage{argv[4], std::string(argv[6]) == "fail"};
    if (!storage.value.empty())
      station.load(storage.value.c_str(), id, mac, &key);
    std::vector<std::string> replies;
    bool ok = station.receive(argv[5], id, mac, &key, save, &storage, reply,
                              &replies);
    std::cout << "{\"ok\":" << (ok ? "true" : "false")
              << ",\"revision\":" << station.effective.revision
              << ",\"sample_ms\":" << station.sampleMs(60000)
              << ",\"sleep_ms\":" << station.sleepMs(60000)
              << ",\"raw_samples\":" << int(station.rawSamples(8, 3))
              << ",\"stored\":" << quote(storage.value) << ",\"responses\":[";
    for (size_t i = 0; i < replies.size(); i++) {
      if (i)
        std::cout << ',';
      std::cout << quote(replies[i]);
    }
    std::cout << "]}";
    return 0;
  }
  if (action == "gateway" && argc == 7) {
    horizon::Delivery d;
    horizon::Frame f;
    if (!horizon::decode(argv[3], f, mac, &key))
      return 1;
    horizon::acceptDesired(d, f.config);
    d.lastSend = uint32_t(strtoul(argv[5], nullptr, 10));
    if (strlen(argv[4])) {
      horizon::Frame receipt;
      if (horizon::decode(argv[4], receipt, mac, &key))
        horizon::applyReceipt(d, receipt);
    }
    std::cout << "{\"due\":"
              << (horizon::due(d, uint32_t(strtoul(argv[6], nullptr, 10)))
                      ? "true"
                      : "false")
              << ",\"applied\":" << d.applied << "}";
    return 0;
  }
  return 2;
}
