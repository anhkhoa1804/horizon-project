#pragma once
#include "Arduino.h"
#include <map>
inline std::map<std::string, std::string> hostStorage;
inline bool hostPersistenceFailure = false;
class Preferences {
  std::string name;

public:
  bool begin(const char *n, bool) {
    name = n;
    return true;
  }
  void end() {}
  String getString(const char *k, const char *fallback) {
    auto i = hostStorage.find(name + "/" + k);
    return i == hostStorage.end() ? String(fallback) : String(i->second);
  }
  size_t putString(const char *k, const String &v) {
    if (hostPersistenceFailure)
      return 0;
    hostStorage[name + "/" + k] = v;
    return v.size();
  }
  size_t getBytesLength(const char *k) {
    return hostStorage[name + "/" + k].size();
  }
  size_t getBytes(const char *k, void *out, size_t n) {
    auto &v = hostStorage[name + "/" + k];
    if (v.size() != n)
      return 0;
    memcpy(out, v.data(), n);
    return n;
  }
  size_t putBytes(const char *k, const void *p, size_t n) {
    if (hostPersistenceFailure)
      return 0;
    hostStorage[name + "/" + k] = std::string(static_cast<const char *>(p), n);
    return n;
  }
};
