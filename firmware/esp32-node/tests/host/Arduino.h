#pragma once
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <string>
#include <vector>
class String : public std::string {
public:
  using std::string::string;
  using std::string::operator=;
  String(const std::string &s) : std::string(s) {}
  bool startsWith(const String &s) const { return rfind(s, 0) == 0; }
  int indexOf(const char *s) const {
    auto p = find(s);
    return p == npos ? -1 : int(p);
  }
  bool concat(const char *s) {
    append(s);
    return true;
  }
  bool concat(char c) {
    push_back(c);
    return true;
  }
};
inline uint32_t hostClock = 10000;
inline uint32_t millis() { return hostClock; }
class HardwareSerial {
public:
  std::vector<std::string> lines;
  void println(const char *s) { lines.emplace_back(s); }
  void flush() {}
};
inline HardwareSerial Serial;
