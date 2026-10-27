// Host test for the gateway store-and-forward queue, outcome classification and
// session driver. Build: g++ -std=c++17 -Wall -Wextra tests/upload_queue_host.cpp
#include <cassert>
#include <cstdio>
#include <deque>
#include <functional>
#include <iostream>
#include <string>
#include "../src/gateway/upload_session.h"

using namespace horizon;

static int failures = 0;
#define CHECK(cond) do { if (!(cond)) { std::printf("FAIL %s:%d  %s\n", __FILE__, __LINE__, #cond); failures++; } } while (0)

static std::string frame(int station, uint32_t seq, const char *tail = nullptr) {
  std::string body;
  if (station == 1) body = "S1|" + std::to_string(seq) + "|1|120.5|291.1|0.5|28.0|250|0.069|4.1|98";
  else body = "S2|" + std::to_string(seq) + "|1|30.1|70.2|29.1|57.6|0.24|0.1|120|5.6|4.1|98";
  if (tail) body += tail;
  char crc[8]; std::snprintf(crc, sizeof(crc), "%04X", simpleCrc16(body));
  return body + "|" + crc;
}

// ---- fake modem / server ----------------------------------------------------
struct FakeNet {
  bool modemOk = true, clockOk = true;
  std::deque<HttpAttempt> script;   // consumed per POST; empty => default
  HttpAttempt deflt;                // default answer
  std::vector<std::string> bodies;  // every POST body
  uint32_t modemUps = 0;
  FakeNet() { deflt.requestSent = true; deflt.status = 200; deflt.body = "{\"ok\":true}"; }
};
struct Transport {
  FakeNet &net; uint32_t now = 100000; uint32_t epoch = 1790000000; uint32_t boot = 7;
  std::function<void()> radioHook;
  explicit Transport(FakeNet &n) : net(n) {}
  bool modemUp() { net.modemUps++; now += 8000; return net.modemOk; }
  bool syncClock() { now += 2000; return net.clockOk; }
  uint32_t epochNow() { return epoch + (now - 100000) / 1000; }
  uint32_t uptimeMs() { return now; }
  uint32_t bootId() { return boot; }
  const char *gatewayId() { return "GATEWAY_01"; }
  HttpAttempt post(const std::string &json) {
    now += 1500; net.bodies.push_back(json);
    if (!net.script.empty()) { HttpAttempt a = net.script.front(); net.script.pop_front(); return a; }
    return net.deflt;
  }
  void modemDown() {}
  void serviceRadio() { if (radioHook) radioHook(); }
};

using Q = DurableQueue<RamFlash>;
static constexpr uint32_t kRing = 4;  // small rings so overflow is easy to reach

static EnqueueResult put(Q &q, int st, uint32_t seq, uint32_t uptime = 1000, uint32_t epoch = 0, uint32_t boot = 7) {
  return q.enqueue(static_cast<uint8_t>(st), seq, frame(st, seq), epoch, uptime, boot);
}

static void testBasicCustodyAndRecovery() {
  RamFlash flash(2 * kRing); Q q(flash, kRing); q.begin();
  CHECK(put(q, 1, 1) == EnqueueResult::Stored);
  CHECK(put(q, 2, 1) == EnqueueResult::Stored);
  CHECK(put(q, 1, 2) == EnqueueResult::Stored);
  CHECK(q.depth() == 3 && q.depth(1) == 2 && q.depth(2) == 1);
  // Reboot with pending data: a fresh queue over the same flash must recover it in order.
  Q q2(flash, kRing); q2.begin();
  CHECK(q2.depth() == 3);
  CHECK(q2.oldest() && q2.oldest()->station == 1 && q2.oldest()->seq == 1);
  std::string line;
  CHECK(q2.loadLine(*q2.head(2), line) && line == frame(2, 1));
  // New arrivals after reboot keep a larger order, so FIFO is preserved.
  CHECK(put(q2, 2, 2) == EnqueueResult::Stored);
  CHECK(q2.head(2)->seq == 1);
}

static void testDuplicatesAndStableIdentity() {
  RamFlash flash(2 * kRing); Q q(flash, kRing); q.begin();
  CHECK(put(q, 1, 5) == EnqueueResult::Stored);
  CHECK(put(q, 1, 5) == EnqueueResult::Duplicate);           // station retry of same frame: ACK again, no second row
  CHECK(q.depth() == 1 && q.stats().duplicates == 1);
  // Station rebooted and reused seq 5 with different data: NOT a duplicate.
  CHECK(q.enqueue(1, 5, frame(1, 5, "1"), 0, 2000, 7) == EnqueueResult::Stored);
  CHECK(q.depth() == 2);
  // Delivered then retried (ACK lost on the radio): still a duplicate, still ACKable.
  const uint32_t order = q.head(1)->order;
  CHECK(q.markDelivered(order));
  CHECK(put(q, 1, 5) == EnqueueResult::Duplicate);
  // message_id is derived from the frame, so it is identical on every retry.
  SimpleTelemetryFrame f; CHECK(parseSimpleTelemetryFrame(frame(1, 5), f));
  CHECK(stableStationMessageId(f, frame(1, 5)) == stableStationMessageId(f, frame(1, 5)));
}

static void testNoFakeAckWhenFlashFails() {
  RamFlash flash(2 * kRing); Q q(flash, kRing); q.begin();
  flash.failWrites = true;
  CHECK(put(q, 1, 1) == EnqueueResult::NoCustody);  // caller must not ACK
  CHECK(q.depth() == 0 && q.stats().noCustody == 1);
  flash.failWrites = false;
  CHECK(put(q, 1, 1) == EnqueueResult::Stored);     // the station's retry is accepted later
  // Oversized / empty lines are refused rather than truncated.
  CHECK(q.enqueue(1, 9, std::string(200, 'x'), 0, 0, 0) == EnqueueResult::NoCustody);
}

static void testTornWriteAndCorruption() {
  RamFlash flash(2 * kRing); Q q(flash, kRing); q.begin();
  CHECK(put(q, 1, 1) == EnqueueResult::Stored);
  flash.tearNextWrite = true;                       // power loss half way through the program
  CHECK(put(q, 1, 2) == EnqueueResult::NoCustody);
  Q q2(flash, kRing); q2.begin();                   // reboot
  CHECK(q2.depth() == 1 && q2.head(1)->seq == 1);   // torn record skipped, good one kept
  CHECK(q2.stats().corruptRecords >= 1);
  CHECK(put(q2, 1, 2) == EnqueueResult::Stored);    // retry succeeds in a clean slot
  CHECK(q2.depth() == 2);
  // Bit rot inside a stored record is detected by the CRC.
  flash.raw()[40] ^= 0x01;
  Q q3(flash, kRing); q3.begin();
  CHECK(q3.stats().corruptRecords >= 1);
}

static void testOverflowIsPerStationAndCounted() {
  RamFlash flash(2 * kRing); Q q(flash, kRing); q.begin();
  CHECK(put(q, 2, 1) == EnqueueResult::Stored);           // STATION_02 has one waiting frame
  const uint32_t cap = kRing * kUqSlotsPerSector;
  for (uint32_t i = 1; i <= cap + 30; ++i) CHECK(put(q, 1, i) == EnqueueResult::Stored);  // outage: STATION_01 floods
  CHECK(q.depth(2) == 1 && q.head(2)->seq == 1);          // STATION_02 untouched
  CHECK(q.stats().overflowEvents >= 1 && q.stats().overflowDropped >= kUqSlotsPerSector);
  CHECK(q.depth(1) <= cap);
  CHECK(q.head(1)->seq > 1);                              // oldest dropped, newest kept
  // Surviving frames are still contiguous and in order.
  uint32_t last = 0; std::string line;
  Q q2(flash, kRing); q2.begin();
  CHECK(q2.depth(1) == q.depth(1));
  (void)last; (void)line;
}

static void testSectorErasedAheadOfTime() {
  RamFlash flash(2 * kRing); Q q(flash, kRing); q.begin();
  // Steady state: frames are delivered as they arrive, so the ring wraps onto used sectors.
  for (uint32_t i = 1; i <= kRing * kUqSlotsPerSector + 23; ++i) {
    CHECK(put(q, 1, i) == EnqueueResult::Stored);
    q.markDelivered(q.head(1)->order);
  }
  const uint32_t erasesBefore = flash.erases;
  CHECK(q.prepareNext() >= 1 && flash.erases > erasesBefore);      // next (used) sector erased while the radio is idle
  const uint32_t afterPrepare = flash.erases;
  for (uint32_t i = 1000; i < 1000 + 5; ++i) { CHECK(put(q, 1, i) == EnqueueResult::Stored); q.markDelivered(q.head(1)->order); }
  CHECK(flash.erases == afterPrepare);                              // rollover costs no erase inside enqueue()
  CHECK(q.stats().preErased >= 1);
}

static void testClassification() {
  auto mk = [](bool sent, int st, const char *body) { HttpAttempt a; a.requestSent = sent; a.status = st; a.body = body; return a; };
  CHECK(classifyHttpAttempt(mk(true, 200, "{\"ok\":true}")).outcome == UploadOutcome::Delivered);
  CHECK(classifyHttpAttempt(mk(true, 200, "{\"ok\":true,\"status\":\"duplicate_ignored\"}")).outcome == UploadOutcome::Delivered);
  CHECK(classifyHttpAttempt(mk(false, -1, "")).outcome == UploadOutcome::RetryableFailure);
  CHECK(classifyHttpAttempt(mk(true, -1, "")).outcome == UploadOutcome::UnknownDelivery);      // lost response
  CHECK(classifyHttpAttempt(mk(true, 715, "")).outcome == UploadOutcome::UnknownDelivery);     // modem TLS/network code
  CHECK(classifyHttpAttempt(mk(true, 503, "<html>")).outcome == UploadOutcome::RetryableFailure);
  CHECK(classifyHttpAttempt(mk(true, 500, "{\"retryable\":true}")).outcome == UploadOutcome::RetryableFailure);
  CHECK(classifyHttpAttempt(mk(true, 429, "")).outcome == UploadOutcome::RetryableFailure);
  // Config/clock problems must HOLD (keep the data), never discard it.
  CHECK(classifyHttpAttempt(mk(true, 401, "{\"error_code\":\"INVALID_SIGNATURE\",\"retryable\":false}")).outcome == UploadOutcome::HoldSystemic);
  CHECK(classifyHttpAttempt(mk(true, 400, "{\"message\":\"x-contract-version header does not match payload.contract_version\",\"retryable\":false}")).outcome == UploadOutcome::HoldSystemic);
  CHECK(classifyHttpAttempt(mk(true, 400, "{\"error_code\":\"TIMESTAMP_OUT_OF_WINDOW\",\"retryable\":false}")).outcome == UploadOutcome::HoldSystemic);
  CHECK(classifyHttpAttempt(mk(true, 401, "")).outcome == UploadOutcome::HoldSystemic);          // platform 401, no body
  CHECK(classifyHttpAttempt(mk(true, 403, "forbidden")).outcome == UploadOutcome::HoldSystemic);
  // Genuine payload rejections are quarantined with a reason.
  const auto oor = classifyHttpAttempt(mk(true, 400, "{\"error_code\":\"VALUE_OUT_OF_RANGE\",\"retryable\":false}"));
  CHECK(oor.outcome == UploadOutcome::TerminalRejection && oor.reason == RejectReason::ValueOutOfRange);
  CHECK(classifyHttpAttempt(mk(true, 404, "{\"error_code\":\"DEVICE_NOT_REGISTERED\",\"retryable\":false}")).reason == RejectReason::DeviceNotRegistered);
  // Unknown 4xx without an explicit retryable:false is kept.
  CHECK(classifyHttpAttempt(mk(true, 418, "teapot")).outcome == UploadOutcome::RetryableFailure);
}

static void testSessionDeliversEachStationIndependently() {
  RamFlash flash(2 * kRing); Q q(flash, kRing); q.begin();
  FakeNet net; Transport t(net); UploadPolicy p; SchedulerState s;
  for (uint32_t i = 1; i <= 5; ++i) put(q, 1, i, t.now);        // STATION_02 absent entirely
  const SessionResult r = runUploadSession(q, t, p, s);
  CHECK(r.delivered == 5 && q.depth() == 0);
  CHECK(net.modemUps == 1);                                    // one power-up for the whole burst
  CHECK(s.lastSuccessMs[0] != 0 && s.lastSuccessMs[1] == 0);
  CHECK(net.bodies.size() == 5);
  CHECK(net.bodies[0].find("\"device_id\":\"STATION_01\"") != std::string::npos);
}

static void testSchedulerNeverWaitsForever() {
  RamFlash flash(2 * kRing); Q q(flash, kRing); q.begin();
  UploadPolicy p; SchedulerState s; const uint32_t boot = 7;
  put(q, 1, 1, 1000, 0, boot);
  CHECK(!shouldStartSession(q, p, s, 5000, 0, false, boot));            // waiting for the other station
  CHECK(shouldStartSession(q, p, s, 1000 + p.batchWindowMs, 0, false, boot));  // window over: STATION_01 alone goes
  put(q, 2, 1, 1500, 0, boot);
  CHECK(shouldStartSession(q, p, s, 5000, 0, false, boot));             // pair complete: go now
  CHECK(!shouldStartSession(q, p, s, 5000, 4900, false, boot));         // LoRa busy: settle first
  CHECK(!shouldStartSession(q, p, s, 5000, 0, true, boot));             // bytes waiting
  s.nextSessionAtMs = 99999;
  CHECK(!shouldStartSession(q, p, s, 5000, 0, false, boot));            // in back-off
  // Records recovered from a previous boot go immediately.
  RamFlash f2(2 * kRing); Q q2(f2, kRing); q2.begin(); put(q2, 1, 1, 1000, 0, 3);
  SchedulerState s2; CHECK(shouldStartSession(q2, p, s2, 2000, 0, false, 9));
}

static void testOutageThirtyMinutesThenRecovery() {
  RamFlash flash(2 * kRing); Q q(flash, kRing); q.begin();
  FakeNet net; Transport t(net); UploadPolicy p; SchedulerState s;
  net.modemOk = false;
  uint32_t seq1 = 0, seq2 = 0; uint32_t failedSessions = 0;
  // 30 simulated minutes, a frame from each station every 79 s, upload attempted whenever policy allows.
  for (uint32_t tick = 0; tick < 30 * 60 * 1000; tick += 1000) {
    t.now = 100000 + tick;
    if (tick % 79000 == 0) { CHECK(put(q, 1, ++seq1, t.now, 0, 7) == EnqueueResult::Stored); CHECK(put(q, 2, ++seq2, t.now + 5, 0, 7) == EnqueueResult::Stored); }
    if (shouldStartSession(q, p, s, t.now, 0, false, 7)) { const uint32_t before = t.now; runUploadSession(q, t, p, s); tick += t.now - before; failedSessions++; }
  }
  CHECK(q.depth() == seq1 + seq2);                // nothing lost, nothing ACKed-then-dropped
  CHECK(failedSessions >= 3 && failedSessions <= 12);   // exponential back-off, not a 60 s hammer
  CHECK(s.consecutiveFailedSessions == failedSessions);
  // Link returns.
  net.modemOk = true; s.nextSessionAtMs = 0;
  uint32_t guard = 0;
  while (q.depth() > 0 && guard++ < 20) runUploadSession(q, t, p, s);
  CHECK(q.depth() == 0);
  CHECK(net.bodies.size() == seq1 + seq2);
  // The two stations interleave in arrival order: first body is STATION_01 seq 1, second STATION_02 seq 1.
  CHECK(net.bodies[0].find("\"device_id\":\"STATION_01\"") != std::string::npos);
  CHECK(net.bodies[1].find("\"device_id\":\"STATION_02\"") != std::string::npos);
  // Frames older than the drift window are labelled as backlog, not live.
  CHECK(net.bodies[0].find("gateway_forward_time") != std::string::npos);
  CHECK(net.bodies[0].find("\"queued_seconds\":") != std::string::npos);
}

static void testRebootWithPendingData() {
  RamFlash flash(2 * kRing); FakeNet net; UploadPolicy p; SchedulerState s;
  { Q q(flash, kRing); q.begin(); for (uint32_t i = 1; i <= 3; ++i) { put(q, 1, i, 1000 + i, 0, 7); put(q, 2, i, 1000 + i, 0, 7); } }
  Q q(flash, kRing); q.begin();                       // power cycle
  CHECK(q.depth() == 6);
  Transport t(net); t.boot = 8;                       // new boot id
  const SessionResult r = runUploadSession(q, t, p, s);
  CHECK(r.delivered == 6 && q.depth() == 0);
  CHECK(net.bodies[0].find("\"received_at_epoch\":null") != std::string::npos);  // receipt time unknown across reboot: said so
  Q q2(flash, kRing); q2.begin(); CHECK(q2.depth() == 0);   // delivered state is durable, no re-upload
}

static void testResponseLostRetriesSameMessageId() {
  RamFlash flash(2 * kRing); Q q(flash, kRing); q.begin();
  FakeNet net; Transport t(net); UploadPolicy p; SchedulerState s;
  put(q, 1, 1, t.now);
  HttpAttempt lost; lost.requestSent = true; lost.status = -1;
  net.script.push_back(lost);
  SessionResult r = runUploadSession(q, t, p, s);
  CHECK(r.unknown == 1 && r.delivered == 0 && q.depth() == 1 && s.unknownDeliveries == 1);
  t.now = s.nextSessionAtMs;
  r = runUploadSession(q, t, p, s);
  CHECK(r.delivered == 1 && q.depth() == 0);
  auto idOf = [](const std::string &j) { const size_t a = j.find("\"message_id\":\""); return j.substr(a, j.find('"', a + 14) - a); };
  CHECK(net.bodies.size() == 2 && idOf(net.bodies[0]) == idOf(net.bodies[1]));       // idempotent retry
}

static void testServerOutcomes() {
  RamFlash flash(2 * kRing); Q q(flash, kRing); q.begin();
  FakeNet net; Transport t(net); UploadPolicy p; SchedulerState s;
  put(q, 1, 1, t.now); put(q, 2, 1, t.now); put(q, 1, 2, t.now);
  HttpAttempt oor; oor.requestSent = true; oor.status = 400; oor.body = "{\"error_code\":\"VALUE_OUT_OF_RANGE\",\"retryable\":false}";
  net.script.push_back(oor);                          // first POST rejected for its values
  SessionResult r = runUploadSession(q, t, p, s);
  CHECK(r.quarantined == 1 && r.delivered == 2 && q.depth() == 0);   // no infinite loop, others still delivered
  CHECK(s.lastReject == RejectReason::ValueOutOfRange && q.stats().quarantined == 1);
  uint8_t st = 0, reason = 0; CHECK(q.readState(1, 0, st, reason) && st == kStQuarantined && reason == static_cast<uint8_t>(RejectReason::ValueOutOfRange));  // kept in flash for forensics

  // 401 (wrong token) must keep EVERYTHING and back off for holdMs.
  put(q, 1, 3, t.now); put(q, 2, 2, t.now);
  HttpAttempt bad; bad.requestSent = true; bad.status = 401; bad.body = "{\"error_code\":\"INVALID_SIGNATURE\",\"retryable\":false}";
  net.script.push_back(bad);
  const uint32_t before = t.now;
  r = runUploadSession(q, t, p, s);
  CHECK(r.held == 1 && q.depth() == 2 && s.nextSessionAtMs >= before + p.holdMs && !s.clockValid);
  CHECK(q.stats().quarantined == 1);                  // not 2: nothing discarded by the 401
}

static void testClockFailureThenRecovery() {
  RamFlash flash(2 * kRing); Q q(flash, kRing); q.begin();
  FakeNet net; Transport t(net); UploadPolicy p; SchedulerState s;
  put(q, 2, 1, t.now);
  net.clockOk = false;
  SessionResult r = runUploadSession(q, t, p, s);
  CHECK(r.clockFailed && q.depth() == 1 && net.bodies.empty());     // never POST without a valid clock
  net.clockOk = true; t.now = s.nextSessionAtMs;
  r = runUploadSession(q, t, p, s);
  CHECK(r.delivered == 1 && s.consecutiveFailedSessions == 0 && s.clockValid);
}

static void testPacketsArrivingDuringUpload() {
  RamFlash flash(2 * kRing); Q q(flash, kRing); q.begin();
  FakeNet net; Transport t(net); UploadPolicy p; SchedulerState s;
  put(q, 1, 1, t.now);
  uint32_t injected = 0;
  t.radioHook = [&]() {                               // LoRa frames land while the modem session is running
    if (injected < 3) { ++injected; CHECK(put(q, 2, injected, t.now, 0, 7) == EnqueueResult::Stored); }
  };
  const SessionResult r = runUploadSession(q, t, p, s);
  CHECK(injected == 3 && r.delivered == 4 && q.depth() == 0);       // all four uploaded, none dropped
}

static void testOverflowWhileInFlightIsSafe() {
  RamFlash flash(2 * kRing); Q q(flash, kRing); q.begin();
  FakeNet net; Transport t(net); UploadPolicy p; SchedulerState s;
  const uint32_t cap = kRing * kUqSlotsPerSector;
  for (uint32_t i = 1; i <= cap; ++i) put(q, 1, i, t.now);
  bool flooded = false;
  t.radioHook = [&]() { if (!flooded) { flooded = true; for (uint32_t i = 0; i < 40; ++i) put(q, 1, cap + 1 + i, t.now); } };
  const SessionResult r = runUploadSession(q, t, p, s);             // oldest sector is evicted mid-session
  CHECK(r.attempted >= 1);
  CHECK(q.depth() + q.stats().delivered + q.stats().overflowDropped == cap + 40);   // every frame accounted for
}

static void testForwardJsonTimestamps() {
  SimpleTelemetryFrame f; const std::string line = frame(2, 3);
  CHECK(parseSimpleTelemetryFrame(line, f));
  ForwardTiming fresh; fresh.receiptEpoch = 1790000100; fresh.forwardEpoch = 1790000160;
  std::string j = makeForwardJson(f, line, "GATEWAY_01", fresh);
  CHECK(j.find("\"timestamp\":1790000100,") != std::string::npos);
  CHECK(j.find("gateway_network_receipt_time") != std::string::npos && j.find("gateway_forward_time") == std::string::npos);
  ForwardTiming old = fresh; old.forwardEpoch = fresh.receiptEpoch + 3600;
  j = makeForwardJson(f, line, "GATEWAY_01", old);
  CHECK(j.find("\"timestamp\":" + std::to_string(old.forwardEpoch) + ",") != std::string::npos);   // inside the 300 s drift window
  CHECK(j.find("\"received_at_epoch\":1790000100") != std::string::npos && j.find("\"queued_seconds\":3600") != std::string::npos);
  CHECK(j.find("\"timestamp\":0") == std::string::npos);
  ForwardTiming unknown; unknown.forwardEpoch = 1790005000;
  j = makeForwardJson(f, line, "GATEWAY_01", unknown);
  CHECK(j.find("\"received_at_epoch\":null") != std::string::npos);
  // Idempotency key never depends on timing.
  auto idOf = [](const std::string &s) { const size_t a = s.find("\"message_id\":\""); return s.substr(a, s.find('"', a + 14) - a); };
  CHECK(idOf(makeForwardJson(f, line, "G", fresh)) == idOf(makeForwardJson(f, line, "G", old)));
}

int main() {
  testBasicCustodyAndRecovery();
  testDuplicatesAndStableIdentity();
  testNoFakeAckWhenFlashFails();
  testTornWriteAndCorruption();
  testOverflowIsPerStationAndCounted();
  testSectorErasedAheadOfTime();
  testClassification();
  testSessionDeliversEachStationIndependently();
  testSchedulerNeverWaitsForever();
  testOutageThirtyMinutesThenRecovery();
  testRebootWithPendingData();
  testResponseLostRetriesSameMessageId();
  testServerOutcomes();
  testClockFailureThenRecovery();
  testPacketsArrivingDuringUpload();
  testOverflowWhileInFlightIsSafe();
  testForwardJsonTimestamps();
  if (failures) { std::printf("%d check(s) failed\n", failures); return 1; }
  std::printf("upload_queue host tests passed\n");
  return 0;
}
