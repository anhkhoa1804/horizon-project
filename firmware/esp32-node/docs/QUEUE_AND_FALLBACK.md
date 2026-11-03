# Queue and Fallback Design (Phase 1 Draft)

## Local queue (store-and-forward)
- Persist telemetry samples locally before first send attempt.
- FIFO queue with bounded size (for example 96 samples ~= 2 days at 30 min cycle).
- Each sample tracks retry_count and last_attempt_at.

## Queue send policy
- On each wake cycle, drain up to N oldest pending samples first.
- If upload succeeds with inserted or duplicate_ignored, remove item from queue.
- On send failure, increment retry_count and keep sample.

## Queue overflow policy
- If queue full, drop oldest sample and increment queue_overflow_count.
- Emit queue_overflow_count in health telemetry for diagnostics.

## LTE outage fallback concept
- If LTE attach fails continuously for more than 24h:
  - trigger optional SMS summary fallback (future phase)
  - payload example:
    STATION_01 BAT=3.8V SAL=1.5 WL=52
- This is optional for MVP but reserved in architecture.
