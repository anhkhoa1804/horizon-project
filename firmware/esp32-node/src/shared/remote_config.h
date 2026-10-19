#pragma once
#include "config_contract.generated.h"
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
namespace horizon {
struct Config {
  uint32_t revision = 0, sample = 60, sleep = 60;
  uint8_t station = 0, mode = 0;
};
struct Frame {
  Config config;
  uint8_t type = 0, reason = 0;
};
using Mac = bool (*)(const char *, size_t, char[65], void *);
using Persist = bool (*)(const char *, void *);
using Reply = void (*)(const char *, void *);
inline bool same(const Config &a, const Config &b) {
  return a.revision == b.revision && a.sample == b.sample &&
         a.sleep == b.sleep && a.station == b.station && a.mode == b.mode;
}
inline bool valid(const Config &c) {
  return c.revision > 0 && c.station >= 1 && c.station <= 2 &&
         c.sample >= SAMPLE_MIN && c.sample <= INTERVAL_MAX &&
         c.sleep <= INTERVAL_MAX && c.mode < 3;
}
inline uint16_t crc16(const char *s) {
  uint16_t c = 0xffff;
  for (; *s; s++) {
    c ^= uint16_t(uint8_t(*s)) << 8;
    for (int b = 0; b < 8; b++)
      c = (c & 0x8000) ? uint16_t((c << 1) ^ 0x1021) : uint16_t(c << 1);
  }
  return c;
}
inline bool encode(const Frame &f, char *out, Mac mac, void *ctx) {
  if (!valid(f.config) || f.type > 3 || f.reason > 5 ||
      ((f.type == 2) == (f.reason == 0)))
    return false;
  char body[128], signedBody[136], digest[65];
  snprintf(body, sizeof(body), "HC1|1|%s|S%u|%lu|%lu|%lu|%s|%s",
           CONFIG_TYPES[f.type], f.config.station,
           (unsigned long)f.config.revision, (unsigned long)f.config.sample,
           (unsigned long)f.config.sleep, CONFIG_MODES[f.config.mode],
           CONFIG_REASONS[f.reason]);
  snprintf(signedBody, sizeof(signedBody), "%s|%04X", body, crc16(body));
  if (!mac(signedBody, strlen(signedBody), digest, ctx))
    return false;
  return snprintf(out, CONFIG_FRAME_MAX, "%s|%s", signedBody, digest) <
         int(CONFIG_FRAME_MAX);
}
inline int lookup(const char *s, const char *const *values, int count) {
  for (int i = 0; i < count; i++)
    if (strcmp(s, values[i]) == 0)
      return i;
  return -1;
}
inline bool number(const char *s, uint32_t &out) {
  if (!*s || (s[0] == '0' && s[1]))
    return false;
  uint64_t n = 0;
  for (; *s; s++) {
    if (*s < '0' || *s > '9')
      return false;
    n = n * 10 + (*s - '0');
    if (n > MAX_REVISION)
      return false;
  }
  out = uint32_t(n);
  return true;
}
inline bool decode(const char *text, Frame &f, Mac mac, void *ctx) {
  if (!text || strlen(text) >= CONFIG_FRAME_MAX)
    return false;
  char copy[CONFIG_FRAME_MAX];
  strcpy(copy, text);
  char *parts[11];
  int count = 1;
  parts[0] = copy;
  for (char *p = copy; *p; p++) {
    if (uint8_t(*p) < 32 || uint8_t(*p) > 126)
      return false;
    if (*p == '|') {
      *p = 0;
      if (count >= 11)
        return false;
      parts[count++] = p + 1;
    }
  }
  if (count != 11 || strcmp(parts[0], "HC1") || strcmp(parts[1], "1"))
    return false;
  f.config.station = strcmp(parts[3], "S1") == 0   ? 1
                     : strcmp(parts[3], "S2") == 0 ? 2
                                                   : 0;
  if (!number(parts[4], f.config.revision) ||
      !number(parts[5], f.config.sample) || !number(parts[6], f.config.sleep))
    return false;
  int mode = lookup(parts[7], CONFIG_MODES, 3),
      type = lookup(parts[2], CONFIG_TYPES, 4),
      reason = lookup(parts[8], CONFIG_REASONS, 6);
  if (mode < 0 || type < 0 || reason < 0)
    return false;
  f.config.mode = mode;
  f.type = type;
  f.reason = reason;
  char expected[CONFIG_FRAME_MAX];
  if (!encode(f, expected, mac, ctx) || strlen(expected) != strlen(text))
    return false;
  unsigned char difference = 0;
  for (size_t i = 0; i < strlen(text); i++)
    difference |= expected[i] ^ text[i];
  return difference == 0;
}
class StationConfig {
public:
  Config effective; // revision zero is explicit compile-time bootstrap, never
                    // APPLIED.
  bool load(const char *stored, uint8_t station, Mac mac, void *ctx) {
    Frame f;
    if (!decode(stored, f, mac, ctx) || f.type != 0 ||
        f.config.station != station)
      return false;
    effective = f.config;
    return true;
  }
  bool receive(const char *text, uint8_t station, Mac mac, void *crypto,
               Persist save, void *storage, Reply reply, void *transport) {
    Frame incoming;
    if (!decode(text, incoming, mac, crypto) || incoming.type != 0 ||
        incoming.config.station != station)
      return false;
    Frame response = incoming;
    char wire[CONFIG_FRAME_MAX];
    auto emit = [&](uint8_t type, uint8_t reason) {
      response.type = type;
      response.reason = reason;
      if (encode(response, wire, mac, crypto))
        reply(wire, transport);
    };
    if (incoming.config.revision < effective.revision) {
      emit(2, 1);
      return false;
    }
    if (incoming.config.revision == effective.revision &&
        !same(incoming.config, effective)) {
      emit(2, 2);
      return false;
    }
    emit(1, 0); // Accepted for processing, not persisted/applied yet.
    if (incoming.config.revision > effective.revision) {
      if (!save(text, storage)) {
        emit(2, 3);
        return false;
      }
      effective = incoming.config;
    }
    emit(3, 0); // Persistence + effective variables now agree. Duplicate
                // re-emits both results.
    return true;
  }
  uint32_t sampleMs(uint32_t fallback) const {
    return effective.revision ? effective.sample * 1000UL : fallback;
  }
  uint32_t sleepMs(uint32_t fallback) const {
    return effective.revision
               ? (effective.mode == 2 ? 0 : effective.sleep * 1000UL)
               : fallback;
  }
  uint8_t rawSamples(uint8_t normal, uint8_t minimum) const {
    return effective.revision && effective.mode == 1 ? minimum : normal;
  }
};
struct Delivery {
  Config desired;
  uint32_t applied = 0;
  uint32_t lastSend = 0;
  uint32_t rejected = 0;
};
inline bool acceptDesired(Delivery &d, const Config &c) {
  if (!valid(c) || c.revision < d.desired.revision)
    return false;
  if (c.revision == d.desired.revision)
    return same(c, d.desired);
  d.desired = c;
  d.lastSend = 0;
  return true;
}
inline bool due(const Delivery &d, uint32_t now, uint32_t retryMs = 30000) {
  return valid(d.desired) && d.applied < d.desired.revision &&
         d.rejected < d.desired.revision &&
         (d.lastSend == 0 || uint32_t(now - d.lastSend) >= retryMs);
}
inline bool applyReceipt(Delivery &d, const Frame &f) {
  if (f.type != 3 || !same(f.config, d.desired))
    return false;
  d.applied = f.config.revision;
  return true;
}
} // namespace horizon
