#pragma once
// One modem session: power up, validate the clock, then drain the durable
// queue FIFO. Host-testable: the modem, clock and radio are injected.
#include <string>
#include "forward_payload.h"
#include "upload_queue.h"

namespace horizon {

struct SessionResult {
  uint32_t attempted = 0, delivered = 0, quarantined = 0, retryable = 0, unknown = 0, held = 0;
  bool modemFailed = false, clockFailed = false;
};

// Transport interface (see tests/upload_queue_host.cpp for a model):
//   bool modemUp();                       // power + init + registration + PDP
//   bool syncClock();                     // validated UTC from the network
//   uint32_t epochNow();                  // valid after syncClock()
//   uint32_t uptimeMs();
//   uint32_t bootId();
//   const char *gatewayId();
//   HttpAttempt post(const std::string &json);
//   void modemDown();
//   void serviceRadio();                  // drain LoRa RX; may call enqueue()+ACK
template <class Q, class T>
SessionResult runUploadSession(Q &q, T &t, const UploadPolicy &p, SchedulerState &s) {
  SessionResult r;
  s.sessions++;
  if (!t.modemUp()) {
    r.modemFailed = true; s.lastError = "modem_init";
    t.modemDown();
    s.sessionsFailed++; s.consecutiveFailedSessions++;
    s.nextSessionAtMs = t.uptimeMs() + uploadBackoffMs(p, s.consecutiveFailedSessions);
    return r;
  }
  if (!t.syncClock()) {
    r.clockFailed = true; s.clockValid = false; s.lastError = "clock_sync";
    t.modemDown();
    s.sessionsFailed++; s.consecutiveFailedSessions++;
    s.nextSessionAtMs = t.uptimeMs() + uploadBackoffMs(p, s.consecutiveFailedSessions);
    return r;
  }
  s.clockValid = true;

  const uint32_t started = t.uptimeMs();
  uint8_t blocked = 0;  // stations whose head failed this session (bit0=S1, bit1=S2)
  bool hold = false;
  while (r.attempted < p.maxPerSession && t.uptimeMs() - started < p.sessionBudgetMs && !hold) {
    t.serviceRadio();
    const UqItem *head = q.oldest(blocked);
    if (head == nullptr) break;
    const UqItem item = *head;  // copy: serviceRadio()/overflow may change the index
    const uint8_t bit = item.station == 1 ? 1 : 2;
    const int si = item.station == 1 ? 0 : 1;

    std::string line;
    SimpleTelemetryFrame frame;
    if (!q.loadLine(item, line) || !parseSimpleTelemetryFrame(line, frame)) {
      q.markQuarantined(item.order, RejectReason::OtherPayload);  // unreadable record: isolate, count, move on
      r.quarantined++; s.lastReject = RejectReason::OtherPayload;
      continue;
    }

    ForwardTiming timing;
    timing.forwardEpoch = t.epochNow();
    timing.maxFreshAgeS = p.maxForwardEpochAgeS;
    if (item.recvEpoch != 0) timing.receiptEpoch = item.recvEpoch;
    else if (item.bootId == t.bootId()) {
      const uint32_t elapsedS = (t.uptimeMs() - item.recvUptimeMs) / 1000u;
      if (timing.forwardEpoch >= elapsedS) timing.receiptEpoch = timing.forwardEpoch - elapsedS;
    }
    r.attempted++;
    const HttpAttempt attempt = t.post(makeForwardJson(frame, line, t.gatewayId(), timing));
    const Classification c = classifyHttpAttempt(attempt);
    s.lastError = c.label;
    switch (c.outcome) {
      case UploadOutcome::Delivered:
        q.markDelivered(item.order); r.delivered++; s.lastSuccessMs[si] = t.uptimeMs(); break;
      case UploadOutcome::TerminalRejection:
        q.markQuarantined(item.order, c.reason); r.quarantined++; s.lastReject = c.reason; break;
      case UploadOutcome::RetryableFailure:
        r.retryable++; s.retries++; blocked |= bit; break;
      case UploadOutcome::UnknownDelivery:
        r.unknown++; s.unknownDeliveries++; s.retries++; blocked |= bit; break;
      case UploadOutcome::HoldSystemic:
        r.held++; s.holds++; hold = true; break;
    }
    if (blocked == 3) break;  // both stations' heads failing: the network is the problem
  }
  t.modemDown();

  const bool progress = r.delivered > 0 || r.quarantined > 0;
  if (hold) {
    s.sessionsFailed++; s.consecutiveFailedSessions++;
    s.nextSessionAtMs = t.uptimeMs() + p.holdMs;
    s.clockValid = false;  // timestamp rejections may mean a bad clock: force a fresh sync next time
  } else if (progress && blocked == 0) {
    s.sessionsOk++; s.consecutiveFailedSessions = 0;
    s.nextSessionAtMs = t.uptimeMs();  // more may be waiting; the settle rule still applies
  } else if (progress) {
    s.sessionsOk++; s.consecutiveFailedSessions = 1;
    s.nextSessionAtMs = t.uptimeMs() + uploadBackoffMs(p, 1);
  } else {
    s.sessionsFailed++; s.consecutiveFailedSessions++;
    s.nextSessionAtMs = t.uptimeMs() + uploadBackoffMs(p, s.consecutiveFailedSessions);
  }
  return r;
}

}  // namespace horizon
