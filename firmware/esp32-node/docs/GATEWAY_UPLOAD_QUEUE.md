# Gateway durable upload queue (store-and-forward)

Status: **implemented in source and host-tested; NOT running on any device.** The gateway at Cồn Hô
keeps the old behaviour until this firmware is built and flashed (separate approval).

## Problems this replaces (each confirmed in the previous `gateway.ino`)

| # | Old behaviour | Effect |
|---|---|---|
| 1 | `sendSimpleAck()` ran before any upload work | ACK meant "frame arrived", the station deleted it, the gateway could still lose it |
| 2 | `stagePairedUpload()` kept one slot per station and overwrote it | a newer frame replaced an older one that had not been uploaded; consistent with the observed sequence "+2" (cadence figures are inferred from production data, not measured on the device) |
| 3 | Frames received while a batch was triggered were ACKed but not staged | same loss, invisible |
| 4 | `batchStationNUploaded = outcome != HTTP_POST_RETRY` | a terminal rejection (including **401 wrong token**) counted as "uploaded" and the packet was discarded |
| 5 | RAM only, one pair | a reboot or a 4G outage lost everything not yet uploaded; the 26.5 h gap on 25–26/10 produced no backlog |
| 6 | Pairing gate: wait 90 s for the other station | a missing station delayed the present one; both shared one retry timer |
| 7 | `gatewayHeaderSerializationBlocked` latch | one contract-header error stopped uploads until reboot |

## ACK semantics (stations are unchanged)

`A1|seq` / `A2|seq` now mean **"the gateway holds this frame"**, never "the server has it".

* Custody = the frame is programmed into the flash ring **and read back with a valid CRC** (`DurableQueue::enqueue`).
* `NoCustody` (flash write/verify failed, frame too long) → **no ACK is sent**. The station keeps the packet and retries
  (its retry is infinite), so nothing is lost silently.
* A repeated frame (same station, seq and bytes) is ACKed again without a second record (`Duplicate`).
  A station reboot that reuses a sequence number with different data is **not** a duplicate.
* If no data partition exists (or it holds foreign data) the queue runs in RAM (50 frames per station) and the health line says
  `durable=no`: custody is then volatile and lost on reboot. The code never erases a partition it did not claim
  (marker `HQ01`, claimed only if all used sectors are blank).
* The station protocol, frame format, `message_id` derivation and sequence handling are untouched.
  `message_id` = `STATION_0X-<seq>-<FNV1a64 of the frame>`; it depends on nothing time-related, so every retry, including after a
  lost response or a reboot, carries the same id and the backend's idempotent insert makes it safe.

## Outcomes (`classifyHttpAttempt`, single place)

| Outcome | When | Queue action |
|---|---|---|
| `Delivered` | any 2xx (inserted or duplicate-ignored) | mark delivered (state byte cleared in place) |
| `RetryableFailure` | request never sent, 5xx, 408, 429, `retryable:true`, unclassified | keep; that station is skipped for the rest of the session; back-off |
| `UnknownDelivery` | request sent but no `+HTTPACTION` / modem 6xx | keep; retry with the **same** `message_id` |
| `TerminalRejection` | 4xx with `retryable:false` about the payload (`VALUE_OUT_OF_RANGE`, `MISSING_FIELD`, `SENSOR_FAULT`, `DEVICE_NOT_REGISTERED`) | **quarantine**: state `0xF8` + reason code stay in flash for forensics, record leaves the FIFO, no loop, counted in `rejected` |
| `HoldSystemic` | 401/403, `INVALID_SIGNATURE`, contract mismatch, `TIMESTAMP_OUT_OF_WINDOW` | keep **everything**, stop the session, wait `holdMs` (10 min), force a clock re-sync. A wrong token no longer destroys data |

Nothing is discarded on doubt: an unrecognised answer is retryable.

## Scheduling

* 4G is powered only to drain the queue. A session starts when both stations have frames, **or** the oldest frame is ≥ 90 s old,
  **or** ≥ 8 frames wait, **or** frames survive from a previous boot. A station is never held for the other.
* Up to 12 POSTs / 150 s per session, FIFO by arrival order across both stations; a failing station head does not block the other.
* Failed sessions back off 60 s → 120 s → … → 15 min (was a fixed 60 s power-cycle of the modem).
* LoRa keeps being drained while the modem blocks (`serviceWatchdog()` hook), so stations are still ACKed after custody
  instead of retrying for minutes. Frames arriving during a POST are enqueued, never dropped.
* The clock must validate before any POST (unchanged). `timestamp` stays inside the edge 300 s drift window:
  * received ≤ 240 s ago → `timestamp` = true receipt time, `timestamp_semantics` unchanged;
  * older, or receipt time unknown after a reboot → `timestamp` = forward time and `raw_station_payload` carries
    `"timestamp_semantics":"gateway_forward_time"`, `received_at_epoch` (or `null`) and `queued_seconds`.

  **Consequence:** backlog readings appear in the database stamped with the forward time. Until the backend/UI reads
  `received_at_epoch` (see approvals in the QA report), a delayed reading is visibly *labelled* in raw data but looks fresh on screen.

## Flash layout and wear

* Partition `spiffs` (unused by this firmware; default `esp32dev` table = 1.4 MB). Sector 0 = claim marker, then two equal
  rings of 24 × 4 KiB (192 KiB) → 600 frames per station ≈ 13 h at one frame / 79 s. Overflow evicts the **oldest sector of that
  station's ring only**, counted in `overflow`; the other station is never touched.
* Slot = 160 B, 25 per sector, append-only. State byte only clears bits (0xFE → 0xFC delivered / 0xF8 quarantined / 0xF0 dropped),
  so marking a record costs one byte program, no erase. CRC-16 over every other field; a torn write fails the CRC and is skipped.
* Erase happens once per 25 frames per station: ~44 erases/day/station spread over 24 sectors ≈ 1.8 erases/sector/day.
  At 100 000 cycles that is ≈ 150 years. Writes per frame: 1 program + 1 state-byte program on delivery.
* The next sector is erased ahead of time while LoRa is idle (`prepareNext()`), because a sector erase can block the CPU for
  tens of ms and the LoRa UART FIFO holds only 128 B (~130 ms at 9600 baud).

## Diagnostics (`[HEALTH]`, once a minute, serial only)

`up`, `reset` reason, `boot`, `durable`, queue depth per station, `oldest_age_s` (−2 = from a previous boot), last LoRa receive
and last successful upload **per station**, `delivered`, `rejected`, `retries`, `unknown`, `holds`, `dup`, `overflow`, `nocustody`,
session counts, clock state, last error label, consecutive failed sessions. No token, APN, SIM identifier or payload is printed, and
no endpoint was added. Exposing these remotely needs a backend table/endpoint (approval item).

## What is verified and what is not

Verified here (host, `tests/upload_queue.test.mjs` → `tests/upload_queue_host.cpp`, built with `-Wall -Wextra -Werror`):
custody and recovery after reboot, torn write and bit-rot, flash write failure ⇒ no custody, duplicates, per-station overflow with
accounting, every outcome class, per-station independence, 30-minute 4G outage then drain in arrival order, reboot with pending data,
lost response retried with the same id, 4xx quarantine, 401 hold without loss, clock failure then recovery, frames arriving during
a session, eviction during an in-flight POST, timestamp semantics, pre-erase.
`gateway.ino` was syntax/type-checked against host stubs (the PlatformIO toolchain is not installable in this environment) and
source-guarded for ordering (custody → ACK).

**Not verified (needs the real board / staging):** a full `pio run -e gateway`; that the `spiffs` partition exists in the field
board's table and is blank; esp_partition write/erase timing with the LoRa UART running; heap use of the index (~28 B × 600 × 2);
the watchdog hook with a real modem; behaviour with a real SIM and Supabase staging; power draw. Run `FIELD_RELEASE_CHECKLIST.md`
plus: pull 4G for 30 min, reboot mid-queue, and compare `delivered` against server rows.

Stations do not need re-flashing. A gateway re-flash is required for any of this to take effect.
