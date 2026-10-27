#pragma once
// ESP32 flash backend for the durable upload queue (see upload_queue.h).
//
// Uses an existing DATA partition (default label "spiffs", which this gateway
// does not otherwise use - setup() logs "Gateway khong dung SPIFFS/SD") through
// the raw esp_partition API. If the partition is missing, too small, or holds
// somebody else's data, the queue falls back to RAM (volatile custody) and says
// so in the health line. This code NEVER erases a partition it did not claim.
//
// Claim rule: sector 0 of the partition holds a marker "HQ01". An unmarked
// partition is only claimed when every sector we would use is fully blank
// (0xFF), so an unrelated filesystem is never overwritten.
#include <stdint.h>
#include <string.h>
#include "upload_queue.h"

#if defined(ARDUINO_ARCH_ESP32)
#include <esp_partition.h>

namespace horizon {

class EspPartitionFlash {
 public:
  /// Sector 0 is the marker; data sectors are 1..N.
  bool open(const char *label, uint32_t wantedDataSectors) {
    part_ = esp_partition_find_first(ESP_PARTITION_TYPE_DATA, ESP_PARTITION_SUBTYPE_ANY, label);
    if (part_ == nullptr) return false;
    const uint32_t total = part_->size / kUqSectorBytes;
    if (total < 3) return false;
    dataSectors_ = (total - 1 < wantedDataSectors) ? (total - 1) : wantedDataSectors;
    dataSectors_ &= ~1u;  // two equal rings
    if (dataSectors_ < 4) return false;
    uint8_t marker[8];
    if (esp_partition_read(part_, 0, marker, sizeof(marker)) != ESP_OK) return false;
    if (memcmp(marker, "HQ01", 4) == 0) return true;
    // Unmarked: claim only if the marker sector and all data sectors are blank.
    uint8_t buf[256];
    for (uint32_t s = 0; s <= dataSectors_; ++s) {
      for (uint32_t off = 0; off < kUqSectorBytes; off += sizeof(buf)) {
        if (esp_partition_read(part_, s * kUqSectorBytes + off, buf, sizeof(buf)) != ESP_OK) return false;
        for (size_t i = 0; i < sizeof(buf); ++i) if (buf[i] != 0xFF) { foreign_ = true; return false; }
      }
    }
    return esp_partition_write(part_, 0, "HQ01", 4) == ESP_OK;
  }
  bool foreign() const { return foreign_; }
  uint32_t sectorCount() const { return dataSectors_; }
  bool read(uint32_t offset, void *dst, size_t len) { return esp_partition_read(part_, offset + kUqSectorBytes, dst, len) == ESP_OK; }
  bool write(uint32_t offset, const void *src, size_t len) { return esp_partition_write(part_, offset + kUqSectorBytes, src, len) == ESP_OK; }
  bool erase(uint32_t sector) { return esp_partition_erase_range(part_, (sector + 1) * kUqSectorBytes, kUqSectorBytes) == ESP_OK; }

 private:
  const esp_partition_t *part_ = nullptr;
  uint32_t dataSectors_ = 0;
  bool foreign_ = false;
};

}  // namespace horizon
#endif

namespace horizon {

/// Runtime switch between the partition and RAM so the sketch has one queue type.
class GatewayFlash {
 public:
  GatewayFlash() = default;
  GatewayFlash(const GatewayFlash &) = delete;
  GatewayFlash &operator=(const GatewayFlash &) = delete;
  ~GatewayFlash() { delete ram_; }
  static constexpr uint32_t kRingSectors = 24;     // per station: 24 * 25 = 600 frames (~13 h at one frame / 79 s)
  static constexpr uint32_t kRamRingSectors = 2;   // volatile fallback: 50 frames per station, 16 KiB heap

  /// Returns true when durable (partition-backed).
  bool begin() {
#if defined(ARDUINO_ARCH_ESP32)
    if (esp_.open("spiffs", 2 * kRingSectors)) { useEsp_ = true; return true; }
    foreign_ = esp_.foreign();
#endif
    useEsp_ = false;
    if (ram_ == nullptr) ram_ = new RamFlash(2 * kRamRingSectors);
    return false;
  }
  bool durable() const { return useEsp_; }
  bool foreignPartition() const { return foreign_; }
  uint32_t ringSectors() const {
#if defined(ARDUINO_ARCH_ESP32)
    if (useEsp_) return esp_.sectorCount() / 2;
#endif
    return kRamRingSectors;
  }
  uint32_t sectorCount() const {
#if defined(ARDUINO_ARCH_ESP32)
    if (useEsp_) return esp_.sectorCount();
#endif
    return ram_ ? ram_->sectorCount() : 0;
  }
  bool read(uint32_t o, void *d, size_t n) {
#if defined(ARDUINO_ARCH_ESP32)
    if (useEsp_) return esp_.read(o, d, n);
#endif
    return ram_ && ram_->read(o, d, n);
  }
  bool write(uint32_t o, const void *s, size_t n) {
#if defined(ARDUINO_ARCH_ESP32)
    if (useEsp_) return esp_.write(o, s, n);
#endif
    return ram_ && ram_->write(o, s, n);
  }
  bool erase(uint32_t s) {
#if defined(ARDUINO_ARCH_ESP32)
    if (useEsp_) return esp_.erase(s);
#endif
    return ram_ && ram_->erase(s);
  }

 private:
  RamFlash *ram_ = nullptr;
#if defined(ARDUINO_ARCH_ESP32)
  EspPartitionFlash esp_;
#endif
  bool useEsp_ = false;
  bool foreign_ = false;
};

}  // namespace horizon
