#pragma once
// HORIZON gateway store-and-forward queue, HTTP outcome classification and
// upload-session driver.
//
// Everything here is plain C++17 with no Arduino/ESP32 dependency so the exact
// logic that runs on the gateway is exercised by host tests
// (tests/upload_queue_host.cpp). Flash access, the modem and the clock are
// injected through small interfaces; gateway.ino supplies the ESP32 versions.
//
// ACK SEMANTICS (read before changing anything)
//   A station deletes its packet when it hears "A1|seq"/"A2|seq". The gateway
//   therefore sends that ACK only AFTER enqueue() returned Stored or
//   Duplicate, i.e. after the frame is in custody:
//     * durable custody  - record programmed into the flash ring and verified;
//                          survives reboot and power loss.
//     * volatile custody - only when no flash partition exists (RamFlash).
//                          Reported in health as durable=no; lost on reboot.
//   ACK does NOT mean the backend has the row. If enqueue() returns NoCustody
//   (flash write failed) the caller must NOT ACK; the station keeps the packet
//   and retries, so nothing is lost silently.
//
// FLASH LAYOUT
//   Two independent rings (STATION_01 / STATION_02), so one station can never
//   evict or block the other. Each ring is N 4 KiB sectors, 25 fixed 160-byte
//   slots per sector, append-only. A slot's state byte only ever has bits
//   cleared (0xFE pending -> 0xFC delivered / 0xF8 quarantined / 0xF0 dropped),
//   which NOR flash allows without an erase. A sector is erased once, when it
//   is recycled: ~1 erase per 25 packets, spread across the ring (see
//   docs/GATEWAY_UPLOAD_QUEUE.md for the wear estimate).
//   Record integrity = CRC-16 over every field except the two mutable bytes
//   (state, reason). A torn write fails the CRC and is skipped on boot.
#include <algorithm>
#include <cstdint>
#include <cstring>
#include <string>
#include <vector>

namespace horizon {

// ---------------------------------------------------------------- constants
constexpr uint32_t kUqSectorBytes = 4096;
constexpr uint32_t kUqRecordBytes = 160;
constexpr uint32_t kUqSlotsPerSector = kUqSectorBytes / kUqRecordBytes;  // 25
constexpr size_t kUqLineMax = 128;  // longest real S2 frame is ~105 chars
constexpr uint8_t kUqMagic = 0xA7;

constexpr uint8_t kStEmpty = 0xFF;
constexpr uint8_t kStPending = 0xFE;
constexpr uint8_t kStDelivered = 0xFC;
constexpr uint8_t kStQuarantined = 0xF8;
constexpr uint8_t kStDropped = 0xF0;

// Quarantine reasons (stored in the record, never used as a "success").
enum class RejectReason : uint8_t {
  None = 0xFF,
  MissingField = 1,
  ValueOutOfRange = 2,
  SensorFault = 3,
  DeviceNotRegistered = 4,
  OtherPayload = 5,
};

// ---------------------------------------------------------------- flash API
// Interface (documented, not virtual, to stay header-only and allocation-free):
//   uint32_t sectorCount() const;
//   bool read(uint32_t offset, void *dst, size_t len);
//   bool write(uint32_t offset, const void *src, size_t len);  // AND semantics
//   bool erase(uint32_t sector);

/// RAM stand-in used when no data partition exists (volatile custody) and by
/// the host tests. Models NOR flash: write() can only clear bits, erase()
/// restores 0xFF. `failWrites` / `tearNextWrite` inject faults.
class RamFlash {
 public:
  explicit RamFlash(uint32_t sectors) : data_(static_cast<size_t>(sectors) * kUqSectorBytes, 0xFF), sectors_(sectors) {}
  uint32_t sectorCount() const { return sectors_; }
  bool read(uint32_t offset, void *dst, size_t len) {
    if (static_cast<size_t>(offset) + len > data_.size()) return false;
    std::memcpy(dst, data_.data() + offset, len);
    return true;
  }
  bool write(uint32_t offset, const void *src, size_t len) {
    if (failWrites || static_cast<size_t>(offset) + len > data_.size()) return false;
    const auto *bytes = static_cast<const uint8_t *>(src);
    size_t n = len;
    if (tearNextWrite) { n = std::min<size_t>(len, tearBytes); tearNextWrite = false; torn = true; }
    for (size_t i = 0; i < n; ++i) data_[offset + i] &= bytes[i];
    writes += 1;
    return n == len;
  }
  bool erase(uint32_t sector) {
    if (failErase || sector >= sectors_) return false;
    std::memset(data_.data() + static_cast<size_t>(sector) * kUqSectorBytes, 0xFF, kUqSectorBytes);
    erases += 1;
    return true;
  }
  bool failWrites = false, failErase = false, tearNextWrite = false, torn = false;
  size_t tearBytes = 40;  // bytes actually programmed when a write is torn (power loss mid-program)
  uint32_t writes = 0, erases = 0;
  std::vector<uint8_t> &raw() { return data_; }

 private:
  std::vector<uint8_t> data_;
  uint32_t sectors_;
};

// ---------------------------------------------------------------- helpers
inline uint16_t uqCrc16(const uint8_t *p, size_t n, uint16_t crc = 0xFFFF) {
  for (size_t i = 0; i < n; ++i) {
    crc ^= static_cast<uint16_t>(p[i]) << 8;
    for (int b = 0; b < 8; ++b) crc = (crc & 0x8000) ? static_cast<uint16_t>((crc << 1) ^ 0x1021) : static_cast<uint16_t>(crc << 1);
  }
  return crc;
}
inline uint32_t uqFingerprint(const std::string &line) {
  uint32_t h = 2166136261u;
  for (const unsigned char c : line) { h ^= c; h *= 16777619u; }
  return h;
}

struct UqItem {            // RAM index entry for one pending record
  uint32_t order = 0;      // global monotonic arrival order
  uint32_t seq = 0;
  uint32_t fingerprint = 0;
  uint32_t recvEpoch = 0;  // 0 = receipt time unknown when stored
  uint32_t recvUptimeMs = 0;
  uint32_t bootId = 0;
  uint16_t slot = 0;       // slot index inside the ring
  uint8_t station = 0;     // 1 or 2
};

struct UqStats {
  uint32_t stored = 0, duplicates = 0, noCustody = 0;
  uint32_t delivered = 0, quarantined = 0, overflowDropped = 0, overflowEvents = 0;
  uint32_t corruptRecords = 0, recoveredPending = 0, flashErrors = 0, preErased = 0;
};

enum class EnqueueResult : uint8_t { Stored, Duplicate, NoCustody };

// ---------------------------------------------------------------- the queue
template <class Flash>
class DurableQueue {
 public:
  // ringSectors = sectors per station ring; flash must hold 2 * ringSectors.
  DurableQueue(Flash &flash, uint32_t ringSectors) : flash_(flash), ringSectors_(ringSectors) {
    for (int i = 0; i < 2; ++i) {
      rings_[i].first = static_cast<uint32_t>(i) * ringSectors_;
      rings_[i].used.assign(ringSectors_, 0);
      rings_[i].pending.assign(ringSectors_, 0);
    }
  }

  /// Scan flash and rebuild the RAM index. Safe to call after every boot.
  void begin() {
    pend_[0].clear(); pend_[1].clear();
    nextOrder_ = 1;
    for (int r = 0; r < 2; ++r) {
      Ring &ring = rings_[r];
      std::fill(ring.used.begin(), ring.used.end(), 0);
      std::fill(ring.pending.begin(), ring.pending.end(), 0);
      uint32_t newestOrder = 0; ring.cur = 0; ring.curSlot = 0; bool any = false;
      for (uint32_t s = 0; s < ringSectors_; ++s) {
        for (uint32_t k = 0; k < kUqSlotsPerSector; ++k) {
          uint8_t rec[kUqRecordBytes];
          if (!readSlot(r, s, k, rec)) { stats_.flashErrors++; ring.used[s]++; continue; }
          if (isBlank(rec)) continue;
          ring.used[s]++;
          Decoded d;
          if (!decode(rec, d)) { stats_.corruptRecords++; continue; }
          if (d.state == kStPending) {
            UqItem it; it.order = d.order; it.seq = d.seq; it.fingerprint = uqFingerprint(d.line);
            it.recvEpoch = d.recvEpoch; it.recvUptimeMs = d.recvUptimeMs; it.bootId = d.bootId;
            it.slot = static_cast<uint16_t>(s * kUqSlotsPerSector + k); it.station = d.station;
            pend_[r].push_back(it);
            ring.pending[s]++;
            stats_.recoveredPending++;
          }
          if (d.order >= newestOrder) { newestOrder = d.order; ring.cur = s; ring.curSlot = k + 1; any = true; }
          if (d.order >= nextOrder_) nextOrder_ = d.order + 1;
        }
      }
      std::sort(pend_[r].begin(), pend_[r].end(), [](const UqItem &a, const UqItem &b) { return a.order < b.order; });
      if (!any) { ring.cur = 0; ring.curSlot = 0; }
      // A torn write can leave a dirty (non-blank, undecodable) slot after the
      // newest valid record. Never program over it: resume after the last
      // non-blank slot of the current sector.
      for (uint32_t k = kUqSlotsPerSector; k > 0; --k) {
        uint8_t rec[kUqRecordBytes];
        if (readSlot(r, ring.cur, k - 1, rec) && !isBlank(rec)) { ring.curSlot = std::max(ring.curSlot, k); break; }
      }
    }
  }

  /// Take custody of a CRC-valid station frame. See ACK SEMANTICS above.
  EnqueueResult enqueue(uint8_t station, uint32_t seq, const std::string &line, uint32_t recvEpoch,
                        uint32_t recvUptimeMs, uint32_t bootId) {
    const int r = station == 1 ? 0 : 1;
    if ((station != 1 && station != 2) || line.size() > kUqLineMax || line.empty()) { stats_.noCustody++; return EnqueueResult::NoCustody; }
    const uint32_t fp = uqFingerprint(line);
    for (const UqItem &it : pend_[r]) {
      if (it.seq == seq && it.fingerprint == fp) { stats_.duplicates++; return EnqueueResult::Duplicate; }
    }
    if (lastDelivered_[r].valid && lastDelivered_[r].seq == seq && lastDelivered_[r].fp == fp) { stats_.duplicates++; return EnqueueResult::Duplicate; }

    uint32_t sector = 0, slot = 0;
    if (!allocateSlot(r, sector, slot)) { stats_.noCustody++; return EnqueueResult::NoCustody; }

    uint8_t rec[kUqRecordBytes];
    encode(rec, station, seq, nextOrder_, line, recvEpoch, recvUptimeMs, bootId);
    const uint32_t off = slotOffset(r, sector, slot);
    // The slot is counted used even if the program fails: it may be half-written.
    rings_[r].used[sector]++;
    rings_[r].curSlot = slot + 1;
    if (!flash_.write(off, rec, kUqRecordBytes)) { stats_.flashErrors++; stats_.noCustody++; return EnqueueResult::NoCustody; }
    uint8_t verify[kUqRecordBytes];
    Decoded d;
    if (!flash_.read(off, verify, kUqRecordBytes) || !decode(verify, d) || d.state != kStPending || d.order != nextOrder_) {
      stats_.flashErrors++; stats_.noCustody++; return EnqueueResult::NoCustody;
    }
    UqItem it; it.order = nextOrder_++; it.seq = seq; it.fingerprint = fp; it.recvEpoch = recvEpoch;
    it.recvUptimeMs = recvUptimeMs; it.bootId = bootId;
    it.slot = static_cast<uint16_t>(sector * kUqSlotsPerSector + slot); it.station = station;
    pend_[r].push_back(it);
    rings_[r].pending[sector]++;
    stats_.stored++;
    return EnqueueResult::Stored;
  }

  size_t depth(uint8_t station) const { return pend_[station == 1 ? 0 : 1].size(); }
  size_t depth() const { return pend_[0].size() + pend_[1].size(); }
  const UqStats &stats() const { return stats_; }

  /// Oldest pending item of a station (FIFO head), or nullptr.
  const UqItem *head(uint8_t station) const {
    const auto &v = pend_[station == 1 ? 0 : 1];
    return v.empty() ? nullptr : &v.front();
  }
  /// Oldest pending item across the stations NOT in `excludeMask`
  /// (bit0 = STATION_01, bit1 = STATION_02), or nullptr. `order` is the global
  /// arrival order, so service is FIFO and neither station can starve.
  const UqItem *oldest(uint8_t excludeMask = 0) const {
    const UqItem *a = (excludeMask & 1) ? nullptr : head(1);
    const UqItem *b = (excludeMask & 2) ? nullptr : head(2);
    if (!a) return b;
    if (!b) return a;
    return a->order <= b->order ? a : b;
  }

  bool loadLine(const UqItem &item, std::string &line) {
    const int r = item.station == 1 ? 0 : 1;
    uint8_t rec[kUqRecordBytes];
    const uint32_t sector = item.slot / kUqSlotsPerSector, k = item.slot % kUqSlotsPerSector;
    if (!readSlot(r, sector, k, rec)) { stats_.flashErrors++; return false; }
    Decoded d;
    if (!decode(rec, d) || d.state != kStPending || d.order != item.order) return false;
    line = d.line;
    return true;
  }

  /// Call while the radio is idle. A sector erase can block the CPU for tens of
  /// milliseconds (the LoRa UART FIFO is only 128 bytes at 9600 baud), so erase
  /// the NEXT sector ahead of time, when the current one is nearly full, instead
  /// of in the middle of receiving a frame. Returns the number of sectors erased.
  uint32_t prepareNext() {
    uint32_t erased = 0;
    for (int r = 0; r < 2; ++r) {
      Ring &ring = rings_[r];
      if (ring.curSlot + 3 < kUqSlotsPerSector) continue;
      for (uint32_t step = 1; step <= ringSectors_; ++step) {
        const uint32_t s = (ring.cur + step) % ringSectors_;
        if (s == ring.cur || ring.pending[s] != 0) continue;
        if (ring.used[s] != 0) {
          if (!flash_.erase(ring.first + s)) { stats_.flashErrors++; break; }
          ring.used[s] = 0; erased++; stats_.preErased++;
        }
        break;
      }
    }
    return erased;
  }

  bool markDelivered(uint32_t order) { return finish(order, kStDelivered, RejectReason::None); }
  bool markQuarantined(uint32_t order, RejectReason reason) { return finish(order, kStQuarantined, reason); }

  /// Test/diagnostic: reason stored for the record at (station, slot).
  bool readState(uint8_t station, uint16_t slot, uint8_t &state, uint8_t &reason) {
    uint8_t rec[kUqRecordBytes];
    if (!readSlot(station == 1 ? 0 : 1, slot / kUqSlotsPerSector, slot % kUqSlotsPerSector, rec)) return false;
    state = rec[0]; reason = rec[1];
    return true;
  }

 private:
  struct Ring {
    uint32_t first = 0, cur = 0, curSlot = 0;
    std::vector<uint16_t> used, pending;
  };
  struct Decoded {
    uint8_t state = 0, station = 0, flags = 0;
    uint32_t seq = 0, order = 0, recvEpoch = 0, recvUptimeMs = 0, bootId = 0;
    std::string line;
  };
  struct LastDelivered { bool valid = false; uint32_t seq = 0, fp = 0; };

  uint32_t slotOffset(int r, uint32_t sector, uint32_t slot) const {
    return (rings_[r].first + sector) * kUqSectorBytes + slot * kUqRecordBytes;
  }
  bool readSlot(int r, uint32_t sector, uint32_t slot, uint8_t *rec) { return flash_.read(slotOffset(r, sector, slot), rec, kUqRecordBytes); }
  static bool isBlank(const uint8_t *rec) {
    for (uint32_t i = 0; i < kUqRecordBytes; ++i) if (rec[i] != 0xFF) return false;
    return true;
  }
  static uint16_t recordCrc(const uint8_t *rec, uint8_t len) {
    uint16_t crc = uqCrc16(rec + 2, 4);          // magic, station, flags, lineLen
    return uqCrc16(rec + 8, 20 + len, crc);      // seq..bootId + line
  }
  static void put32(uint8_t *p, uint32_t v) { for (int i = 0; i < 4; ++i) p[i] = static_cast<uint8_t>(v >> (8 * i)); }
  static uint32_t get32(const uint8_t *p) { uint32_t v = 0; for (int i = 0; i < 4; ++i) v |= static_cast<uint32_t>(p[i]) << (8 * i); return v; }

  static void encode(uint8_t *rec, uint8_t station, uint32_t seq, uint32_t order, const std::string &line,
                     uint32_t recvEpoch, uint32_t recvUptimeMs, uint32_t bootId) {
    std::memset(rec, 0xFF, kUqRecordBytes);
    rec[0] = kStPending;
    rec[1] = static_cast<uint8_t>(RejectReason::None);
    rec[2] = kUqMagic; rec[3] = station; rec[4] = recvEpoch != 0 ? 1 : 0; rec[5] = static_cast<uint8_t>(line.size());
    put32(rec + 8, seq); put32(rec + 12, order); put32(rec + 16, recvEpoch); put32(rec + 20, recvUptimeMs); put32(rec + 24, bootId);
    std::memcpy(rec + 28, line.data(), line.size());
    const uint16_t crc = recordCrc(rec, rec[5]);
    rec[6] = static_cast<uint8_t>(crc & 0xFF); rec[7] = static_cast<uint8_t>(crc >> 8);
  }
  static bool decode(const uint8_t *rec, Decoded &d) {
    if (rec[2] != kUqMagic || (rec[3] != 1 && rec[3] != 2) || rec[5] == 0 || rec[5] > kUqLineMax) return false;
    const uint16_t stored = static_cast<uint16_t>(rec[6] | (rec[7] << 8));
    if (stored != recordCrc(rec, rec[5])) return false;
    d.state = rec[0]; d.station = rec[3]; d.flags = rec[4];
    d.seq = get32(rec + 8); d.order = get32(rec + 12); d.recvEpoch = get32(rec + 16);
    d.recvUptimeMs = get32(rec + 20); d.bootId = get32(rec + 24);
    d.line.assign(reinterpret_cast<const char *>(rec + 28), rec[5]);
    return true;
  }

  // Find the next writable slot in ring r. Recycles a fully-consumed sector;
  // when every sector still holds pending data, evicts the OLDEST sector of
  // THIS ring only (counted as overflow) - never the other station's data.
  bool allocateSlot(int r, uint32_t &sector, uint32_t &slot) {
    Ring &ring = rings_[r];
    if (ring.cur < ringSectors_ && ring.curSlot < kUqSlotsPerSector && ring.used[ring.cur] <= ring.curSlot) {
      sector = ring.cur; slot = ring.curSlot; return true;
    }
    // Look for a sector with no pending records, scanning forward from cur.
    for (uint32_t step = 1; step <= ringSectors_; ++step) {
      const uint32_t s = (ring.cur + step) % ringSectors_;
      if (ring.pending[s] == 0 && s != ring.cur) return recycle(r, s, sector, slot);
    }
    // Ring full of pending data. Evict the sector containing the oldest item.
    if (pend_[r].empty()) {
      // Nothing pending but also nothing reusable can only mean cur is the sole usable sector.
      return recycle(r, ring.cur, sector, slot);
    }
    const uint32_t victim = pend_[r].front().slot / kUqSlotsPerSector;
    stats_.overflowEvents++;
    std::vector<UqItem> keep;
    for (const UqItem &it : pend_[r]) {
      if (it.slot / kUqSlotsPerSector == victim) {
        uint8_t st = kStDropped;
        flash_.write(slotOffset(r, victim, it.slot % kUqSlotsPerSector), &st, 1);
        stats_.overflowDropped++;
      } else {
        keep.push_back(it);
      }
    }
    pend_[r].swap(keep);
    ring.pending[victim] = 0;
    return recycle(r, victim, sector, slot);
  }
  bool recycle(int r, uint32_t s, uint32_t &sector, uint32_t &slot) {
    Ring &ring = rings_[r];
    // A sector pre-erased by prepareNext() has used == 0 and needs no erase now.
    if (ring.used[s] != 0 && !flash_.erase(rings_[r].first + s)) { stats_.flashErrors++; return false; }
    ring.used[s] = 0; ring.pending[s] = 0; ring.cur = s; ring.curSlot = 0;
    sector = s; slot = 0;
    return true;
  }
  bool finish(uint32_t order, uint8_t state, RejectReason reason) {
    for (int r = 0; r < 2; ++r) {
      auto &v = pend_[r];
      for (size_t i = 0; i < v.size(); ++i) {
        if (v[i].order != order) continue;
        const UqItem it = v[i];
        const uint32_t sector = it.slot / kUqSlotsPerSector, k = it.slot % kUqSlotsPerSector;
        const uint32_t off = slotOffset(r, sector, k);
        // Program reason first (0xFF -> value is a legal bit-clear), then state.
        if (reason != RejectReason::None) { const uint8_t rb = static_cast<uint8_t>(reason); flash_.write(off + 1, &rb, 1); }
        if (!flash_.write(off, &state, 1)) { stats_.flashErrors++; return false; }
        if (state == kStDelivered) { lastDelivered_[r].valid = true; lastDelivered_[r].seq = it.seq; lastDelivered_[r].fp = it.fingerprint; stats_.delivered++; }
        if (state == kStQuarantined) stats_.quarantined++;
        if (rings_[r].pending[sector] > 0) rings_[r].pending[sector]--;
        v.erase(v.begin() + static_cast<long>(i));
        return true;
      }
    }
    return false;  // already gone (e.g. evicted by overflow while the POST was in flight)
  }

  Flash &flash_;
  uint32_t ringSectors_;
  Ring rings_[2];
  std::vector<UqItem> pend_[2];
  LastDelivered lastDelivered_[2];
  uint32_t nextOrder_ = 1;
  UqStats stats_;
};

// ------------------------------------------------- HTTP outcome classification
enum class UploadOutcome : uint8_t {
  Delivered,          // server inserted it or reported a valid duplicate
  RetryableFailure,   // request never reached the server (or 5xx / 408 / 429): keep
  UnknownDelivery,    // request sent, no usable answer: keep, retry SAME message_id
  TerminalRejection,  // payload itself rejected: quarantine, never loop
  HoldSystemic,       // rejection says our config is wrong (token, contract, clock): keep, back off
};

struct HttpAttempt {
  bool requestSent = false;   // body fully handed to the modem
  int status = -1;            // HTTP status; -1 none; >= 600 modem error
  std::string body;           // response body (may be empty / truncated)
};

struct Classification {
  UploadOutcome outcome = UploadOutcome::RetryableFailure;
  RejectReason reason = RejectReason::None;
  const char *label = "";
};

inline bool bodyHas(const std::string &body, const char *needle) { return body.find(needle) != std::string::npos; }

/// Single place that decides what an HTTP result means for the queued record.
/// Rules, in order:
///  * 2xx                                   -> Delivered (inserted or duplicate)
///  * request not sent                      -> RetryableFailure
///  * request sent, no HTTP status / 6xx    -> UnknownDelivery (retry same id)
///  * 401/403, INVALID_SIGNATURE,
///    contract mismatch, TIMESTAMP_OUT_OF_WINDOW -> HoldSystemic (our side is
///    misconfigured; discarding every packet would destroy good data)
///  * 408/429/5xx or "retryable":true       -> RetryableFailure
///  * other 4xx with "retryable":false      -> TerminalRejection (+ reason)
///  * anything else                         -> RetryableFailure (never discard on doubt)
inline Classification classifyHttpAttempt(const HttpAttempt &a) {
  Classification c;
  if (a.status >= 200 && a.status < 300) { c.outcome = UploadOutcome::Delivered; c.label = "delivered"; return c; }
  if (!a.requestSent) { c.outcome = UploadOutcome::RetryableFailure; c.label = "not_sent"; return c; }
  if (a.status < 0 || a.status >= 600) { c.outcome = UploadOutcome::UnknownDelivery; c.label = "no_response"; return c; }
  if (a.status == 401 || a.status == 403 || bodyHas(a.body, "INVALID_SIGNATURE") ||
      bodyHas(a.body, "x-contract-version header does not match") || bodyHas(a.body, "unsupported contract version") ||
      bodyHas(a.body, "TIMESTAMP_OUT_OF_WINDOW")) {
    c.outcome = UploadOutcome::HoldSystemic; c.label = "hold_config_or_clock"; return c;
  }
  if (a.status == 408 || a.status == 429 || a.status >= 500 || bodyHas(a.body, "\"retryable\":true")) {
    c.outcome = UploadOutcome::RetryableFailure; c.label = "retryable_http"; return c;
  }
  if (a.status >= 400 && bodyHas(a.body, "\"retryable\":false")) {
    c.outcome = UploadOutcome::TerminalRejection; c.label = "terminal_payload";
    if (bodyHas(a.body, "VALUE_OUT_OF_RANGE")) c.reason = RejectReason::ValueOutOfRange;
    else if (bodyHas(a.body, "SENSOR_FAULT")) c.reason = RejectReason::SensorFault;
    else if (bodyHas(a.body, "DEVICE_NOT_REGISTERED")) c.reason = RejectReason::DeviceNotRegistered;
    else if (bodyHas(a.body, "MISSING_FIELD")) c.reason = RejectReason::MissingField;
    else c.reason = RejectReason::OtherPayload;
    return c;
  }
  c.outcome = UploadOutcome::RetryableFailure; c.label = "unclassified_keep";
  return c;
}

// ------------------------------------------------------------ scheduling
struct UploadPolicy {
  uint32_t batchWindowMs = 90000;      // wait this long for the other station before powering 4G
  uint32_t backlogTrigger = 8;         // ...or start as soon as this many frames wait
  uint32_t loraSettleMs = 700;
  uint32_t backoffBaseMs = 60000;
  uint32_t backoffMaxMs = 900000;
  uint32_t holdMs = 600000;            // systemic rejection (token/contract/clock)
  uint32_t maxPerSession = 12;
  uint32_t sessionBudgetMs = 150000;
  uint32_t maxForwardEpochAgeS = 240;  // stay inside the edge drift window (300 s)
};

inline uint32_t uploadBackoffMs(const UploadPolicy &p, uint32_t consecutiveFailures) {
  uint64_t ms = p.backoffBaseMs;
  for (uint32_t i = 1; i < consecutiveFailures && ms < p.backoffMaxMs; ++i) ms *= 2;
  return static_cast<uint32_t>(std::min<uint64_t>(ms, p.backoffMaxMs));
}

struct SchedulerState {
  uint32_t nextSessionAtMs = 0;
  uint32_t consecutiveFailedSessions = 0;
  uint32_t sessions = 0, sessionsOk = 0, sessionsFailed = 0;
  uint32_t lastSuccessMs[2] = {0, 0};   // per station
  uint32_t lastRxMs[2] = {0, 0};
  RejectReason lastReject = RejectReason::None;
  const char *lastError = "";
  bool clockValid = false;
  uint32_t retries = 0, unknownDeliveries = 0, holds = 0;
};

/// When should we power the modem? Never gated on the OTHER station: a single
/// station's frames are uploaded after batchWindowMs at the latest.
template <class Q>
bool shouldStartSession(const Q &q, const UploadPolicy &p, const SchedulerState &s, uint32_t nowMs,
                        uint32_t lastLoraActivityMs, bool loraBytesWaiting, uint32_t currentBootId) {
  if (q.depth() == 0) return false;
  if (static_cast<int32_t>(nowMs - s.nextSessionAtMs) < 0) return false;
  if (loraBytesWaiting) return false;
  if (lastLoraActivityMs != 0 && nowMs - lastLoraActivityMs < p.loraSettleMs) return false;
  const bool both = q.head(1) && q.head(2);
  if (both || q.depth() >= p.backlogTrigger) return true;
  const auto *o = q.oldest();
  // recvUptimeMs is only meaningful for items stored during this boot; an item
  // recovered from a previous boot is already old, so start immediately.
  return o != nullptr && (o->bootId != currentBootId || nowMs - o->recvUptimeMs >= p.batchWindowMs);
}

}  // namespace horizon
