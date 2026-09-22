#include <Arduino.h>
#include <driver/gpio.h>
#include <esp_sleep.h>
#include <esp_task_wdt.h>
#include <WiFi.h>
#include <WebServer.h>
#include "gateway_secrets.h"
/*
  HORIZON - Gateway node

  Role:
  - Receive raw JSON readings from Station 1 and Station 2 through SX1278 LoRa UART.
  - Add gateway metadata.
  - Send packets to Supabase ingest through a 4G SIM module using AT commands.
  - Drive 3 status lamps and 1 buzzer through MOSFET outputs.

  Important:
  - The gateway should not calculate agricultural/environment thresholds.
  - Supabase stores the raw observation. The frontend reads from Supabase to
    calculate dashboard values, daily comparison tables, warnings, and
    recommendations.

  Expected station payload examples:
  - Station 1: water_level_cm, salinity_ppt, ec_us_cm, ultrasonic_status, ec_status
  - Station 2: air_temp_c, air_humidity_pct, soil_temp_c, soil_moisture_pct,
               soil_ec_ms_cm, soil_ph, advice

  TODO:
  - Keep WEB_SERVER_URL pointed at the Supabase Edge Function used by this deployment.
  - Set SIM_APN for the SIM provider.
  - Confirm SIM module model and HTTP AT command support.
  - Confirm LoRa UART baud rate / transparent mode.
*/

static const char *GATEWAY_ID = "GATEWAY_01";
static const char *FIRMWARE_VERSION = "gateway-lora-qos1-canonical-v1";

// Local Wi-Fi dashboard.
static const char *WIFI_AP_SSID = "HORIZON";
static const char *WIFI_AP_PASSWORD = "12345678";
static const IPAddress WIFI_AP_IP(192, 168, 4, 1);
static const IPAddress WIFI_AP_GATEWAY(192, 168, 4, 1);
static const IPAddress WIFI_AP_SUBNET(255, 255, 255, 0);
static const uint32_t DASHBOARD_ONLINE_WINDOW_MS = 60000;

// Production ingest endpoint.
//
// The gateway posts JSON to Supabase Edge Function `edge-ingest` with the
// `x-gateway-token` header from gateway_secrets.h. The JSON body itself is a
// top-level TelemetryPayloadV1 attributed to STATION_01 or STATION_02; the
// gateway identity is retained only as private relay provenance.
//
// Do not point this back to Pipedream except for temporary packet debugging.
static const char *WEB_SERVER_URL = "https://edhcnccvbwuffiwzywfm.supabase.co/functions/v1/edge-ingest";
static const char *WEB_SERVER_HOST = "edhcnccvbwuffiwzywfm.supabase.co";
static const char *CONFIG_URL = "https://horizon.frogsleap.com.vn/api/public/gateway/configs";
#ifndef GATEWAY_INGEST_TOKEN_VALUE
#define GATEWAY_INGEST_TOKEN_VALUE ""
#endif
static const char *GATEWAY_INGEST_TOKEN = GATEWAY_INGEST_TOKEN_VALUE;
// CONFIG endpoint is currently returning HTTP 403. Keep runtime config polling disabled
// so the modem cannot steal receive time from LoRa. Re-enable after server auth is ready.
static const bool CONFIG_POLL_ENABLED = false;
// Keep normal AT chatter quiet. Errors and high-level HTTP status are still printed.
static const bool MODEM_VERBOSE_AT = false;
static const char *SIM_APN = "internet";
static const char *SIM_USER = "";
static const char *SIM_PASS = "";
static const bool MODEM_ENABLED = true;

static const uint32_t DEBUG_BAUD = 115200;
static const uint32_t LORA_UART_BAUD = 9600;
// RX hardening: larger UART buffer + pull-up + fast frame completion.
static const size_t LORA_RX_BUFFER_BYTES = 8192;
static const uint32_t SIMPLE_FRAME_IDLE_TIMEOUT_MS = 600;
static const uint8_t SIMPLE_ACK_REPEAT_COUNT = 1;
static const uint32_t SIMPLE_ACK_START_DELAY_MS = 50;
static const uint32_t SIMPLE_ACK_REPEAT_GAP_MS = 150;
static const uint32_t MODEM_BAUD_CANDIDATES[] = {115200, 9600, 57600, 38400, 19200, 230400};
static const size_t MODEM_BAUD_CANDIDATE_COUNT = sizeof(MODEM_BAUD_CANDIDATES) / sizeof(MODEM_BAUD_CANDIDATES[0]);
static const uint32_t MODEM_BAUD_PROBE_MS = 900;
static const uint32_t MODEM_RETRY_INTERVAL_MS = 60000;

// Optional but strongly recommended: E32 AUX -> IO10.
// If AUX is not connected, INPUT_PULLUP keeps this HIGH and the gateway still works.
static const int LORA_AUX_PIN = 10;

// Garbage-storm watchdog. A normal HORIZON packet stream is only a few dozen bytes/s.
// The observed failure was ~1000 bytes/s, almost saturating UART 9600.
static const uint32_t LORA_RX_HEALTH_WINDOW_MS = 3000;
static const uint32_t LORA_GARBAGE_STORM_BYTES_PER_WINDOW = 2500;
static const uint8_t LORA_GARBAGE_BAD_WINDOWS_BEFORE_RESTART = 3;
static const uint32_t LORA_UART_RESTART_COOLDOWN_MS = 10000;
static const uint32_t LORA_NO_GOOD_FRAME_BEFORE_RESTART_MS = 8000;

static const int LORA_UART_RX_PIN = 15;
static const int LORA_UART_TX_PIN = 16;

static const int MODEM_TX_PIN = 17;   // ESP32 TX -> SIM RX.
static const int MODEM_RX_PIN = 18;   // ESP32 RX <- SIM TX.
static const int MODEM_PEN_PIN = 39;  // SIM 4G PEN / enable pin. Set to -1 if not used.

// 4-channel relay module for the gateway warning lamps.
// IN1 -> IO45: GREEN (normal)
// IN2 -> IO48: YELLOW (soil pH high)
// IN3 -> IO47: RED (water surface <= 50 cm from ultrasonic sensor)
// IN4 -> IO21: BUZZER relay (continuous alarm when water surface <= 5 cm).
// Push button -> IO14 to GND: mute buzzer for the CURRENT critical-water event.
static const int RELAY_GREEN_PIN = 45;
static const int RELAY_YELLOW_PIN = 48;
static const int RELAY_RED_PIN = 47;
static const int BUZZER_RELAY_PIN = 21;
static const int BUZZER_MUTE_BUTTON_PIN = 14;

// This gateway board is wired as HIGH-triggered: INx HIGH energizes the relay.
// With LOW-trigger boards, set this to true; with the current module installed,
// the normal state should keep GREEN ON and the other warning relays OFF.
static const bool RELAY_ACTIVE_LOW = false;

// Alarm thresholds. Distance is the S1 ultrasonic distance-to-water field.
static const float WATER_RED_DISTANCE_CM = 50.0f;
static const float WATER_CRITICAL_DISTANCE_CM = 5.0f;
static const float SOIL_PH_HIGH_THRESHOLD = 7.0f;

static const uint32_t MODEM_TIMEOUT_MS = 12000;
static const uint32_t HTTP_TIMEOUT_MS = 30000;
static const uint32_t DEFAULT_CONFIG_POLL_INTERVAL_MS = 900000;  // 15 min when CONFIG_POLL_ENABLED=true.
static const uint32_t WATCHDOG_TIMEOUT_MS = 20000;
static const size_t LORA_LINE_MAX_CHARS = 1400;
static const uint32_t BUTTON_DEBOUNCE_MS = 80;
static const uint32_t LORA_WAIT_LOG_INTERVAL_MS = 5000;
static const bool DEBUG_LORA_RAW_UART = false;
static const uint32_t BATCH_UPLOAD_RETRY_MS = 60000;
static const uint32_t BATCH_LORA_SETTLE_MS = 700;
static const uint32_t MODEM_POWER_OFF_SETTLE_MS = 300;
// Do not hold one station's fresh packet indefinitely while waiting for the
// other station. Independent deep-sleep phases can be offset after boot or a
// missed ACK, so upload the available station after this window.
static const uint32_t PAIR_WAIT_TIMEOUT_MS = 90000;
static const uint8_t WEB_QUEUE_CAPACITY = 8; // legacy queue storage; V9 uses paired batch slots.

// Gateway is the LoRa master: it polls exactly one station at a time.
static const uint32_t LORA_POLL_RESPONSE_TIMEOUT_MS = 28000;
static const uint32_t LORA_POLL_GUARD_MS = 5000;

// Reliability layer for noisy / lossy LoRa transparent links.
// The station repeats one payload several times; gateway ACKs every clean copy.
static const uint8_t LORA_ACK_REPEAT_COUNT = 3;
static const uint32_t LORA_ACK_START_DELAY_MS = 600;
static const uint32_t LORA_ACK_REPEAT_GAP_MS = 300;
static const uint32_t LORA_DUPLICATE_ACK_WINDOW_MS = 12000;
static const uint32_t LORA_PARTIAL_FRAME_TIMEOUT_MS = 5000;
static const char *POLL_STATIONS[] = {"STATION_01", "STATION_02"};
static const uint8_t POLL_STATION_COUNT = 2;

HardwareSerial loraSerial(1);
HardwareSerial modemSerial(2);
WebServer dashboardServer(80);

struct Station1DashboardSnapshot {
  bool valid = false;
  uint32_t sequence = 0;
  uint32_t savedAtMs = 0;
  uint32_t lastSeenMs = 0;
  String summaryMinutes;
  String distanceCm;
  String waterLevelCm;
  String ecMsCm;
  String temperatureC;
  String tdsPpm;
  String salinityPpt;
  String batteryVoltageV;
  String batteryPercent;
};

struct Station2DashboardSnapshot {
  bool valid = false;
  uint32_t sequence = 0;
  uint32_t savedAtMs = 0;
  uint32_t lastSeenMs = 0;
  String summaryMinutes;
  String airTempC;
  String airHumidityPct;
  String soilTempC;
  String soilMoisturePct;
  String soilEcMsCm;
  String soilSalinity;
  String soilTds;
  String soilPh;
  String batteryVoltageV;
  String batteryPercent;
};

static Station1DashboardSnapshot dashboardStation1;
static Station2DashboardSnapshot dashboardStation2;

static bool modemReady = false;
static uint32_t activeModemBaud = 0;
static uint32_t lastModemInitAttemptMs = 0;
static uint32_t modemBinaryDropped = 0;
static String loraLine;
static uint32_t lastConfigPollMs = 0;
static uint32_t lastLoraWaitLogMs = 0;
static uint32_t configPollIntervalMs = DEFAULT_CONFIG_POLL_INTERVAL_MS;
static uint32_t gatewaySleepIntervalMs = 0;

// Latest sensor values used by the local 4-relay warning logic.
static bool relayWaterDistanceValid = false;
static float relayWaterDistanceCm = NAN;
static bool relaySoilPhValid = false;
static float relaySoilPh = NAN;
static bool lastRelayGreenOn = false;
static bool lastRelayYellowOn = false;
static bool lastRelayRedOn = false;
static bool lastRelayBuzzerOn = false;
static bool relayStateInitialized = false;

// Buzzer mute latch. When the critical condition clears (> 5 cm), this resets
// automatically so a future critical-water event will sound the buzzer again.
static bool buzzerMutedForCurrentCritical = false;
static bool buzzerCriticalWasActive = false;
static bool buzzerButtonLastRawPressed = false;
static bool buzzerButtonStablePressed = false;
static uint32_t buzzerButtonLastChangeMs = 0;

// Legacy remote-config flags are kept for compatibility with old helper code,
// but the physical relay outputs are driven directly from S1/S2 sensor data.
static bool tideHighAlert = false;
static bool tideCriticalAlert = false;
static bool soilSalinityAlert = false;
static bool forcedBuzzerAlert = false;
static uint32_t ignoredLoraLineCount = 0;
static uint32_t recoveredLoraJsonCount = 0;

// Paired-batch uploader. Gateway stays in LoRa-only mode until it has one fresh
// payload from BOTH stations. Only then is 4G powered, the two payloads are sent,
// and the modem is powered down again. This prevents modem startup/HTTP work from
// stealing the normal LoRa receive window.
static String pendingUploadStation1;
static String pendingUploadStation2;
static bool pendingStation1Ready = false;
static bool pendingStation2Ready = false;
static bool pairedBatchTriggered = false;
static bool batchStation1Uploaded = false;
static bool batchStation2Uploaded = false;
static bool modemHttpBusy = false;
static uint32_t lastBatchUploadAttemptMs = 0;
static uint32_t lastSimpleLoRaActivityMs = 0;
static uint32_t completedBatchCount = 0;
static uint32_t pairWaitStartedMs = 0;
// RX health / auto-recovery state. These are declared early because the SIMPLE
// packet handler updates them before the parser implementation appears below.
static uint32_t loraPhysicalRxBytes = 0;
static uint32_t loraLastGoodFrameMs = 0;
static uint32_t loraHealthWindowStartedMs = 0;
static uint32_t loraHealthPrevGarbageBytes = 0;
static uint32_t loraHealthPrevGoodFrames = 0;
static uint8_t loraGarbageBadWindows = 0;
static uint32_t loraUartRestartCount = 0;
static uint32_t loraLastUartRestartMs = 0;

// Robust JSON framing state for the UART stream.
static String loraJsonBuffer;
static bool loraJsonInString = false;
static bool loraJsonEscape = false;

// Poll scheduler state.
static bool waitingForPollResponse = false;
static String activePollStation;
static uint8_t nextPollStationIndex = 0;
static uint32_t pollStartedMs = 0;
static uint32_t nextPollAtMs = 0;

// Used to ACK retries without forwarding the same measurement twice.
static String lastAcceptedMessageIdStation1;
static String lastAcceptedMessageIdStation2;
static uint32_t lastAcceptedAtStation1 = 0;
static uint32_t lastAcceptedAtStation2 = 0;
static uint32_t lastLoraByteMs = 0;

void serviceWatchdog();
void watchdogDelay(uint32_t ms);
void readSimpleLoRaUart();
void servicePairedBatchUpload();
void serviceBuzzerMuteButton();

void writeRelay(int pin, bool on) {
  const int onLevel = RELAY_ACTIVE_LOW ? LOW : HIGH;
  const int offLevel = RELAY_ACTIVE_LOW ? HIGH : LOW;
  digitalWrite(pin, on ? onLevel : offLevel);
}

void setupStatusOutputs() {
  pinMode(RELAY_GREEN_PIN, OUTPUT);
  pinMode(RELAY_YELLOW_PIN, OUTPUT);
  pinMode(RELAY_RED_PIN, OUTPUT);
  pinMode(BUZZER_RELAY_PIN, OUTPUT);
  pinMode(BUZZER_MUTE_BUTTON_PIN, INPUT_PULLUP);

  // Start safe: all relays OFF until valid S1/S2 data arrives.
  writeRelay(RELAY_GREEN_PIN, false);
  writeRelay(RELAY_YELLOW_PIN, false);
  writeRelay(RELAY_RED_PIN, false);
  writeRelay(BUZZER_RELAY_PIN, false);
}

void selfTestStatusOutputs() {
  writeRelay(RELAY_GREEN_PIN, true);
  watchdogDelay(180);
  writeRelay(RELAY_GREEN_PIN, false);
  writeRelay(RELAY_YELLOW_PIN, true);
  watchdogDelay(180);
  writeRelay(RELAY_YELLOW_PIN, false);
  writeRelay(RELAY_RED_PIN, true);
  watchdogDelay(180);
  writeRelay(RELAY_RED_PIN, false);
  writeRelay(BUZZER_RELAY_PIN, true);
  watchdogDelay(120);
  writeRelay(BUZZER_RELAY_PIN, false);
}

void serviceWatchdog() {
  // Sample the mute button even during modem/HTTP waits where this function is
  // called repeatedly, so the alarm can be silenced without waiting for loop().
  serviceBuzzerMuteButton();

  if (esp_task_wdt_status(NULL) == ESP_OK) {
    esp_task_wdt_reset();
  }
}

void watchdogDelay(uint32_t ms) {
  const uint32_t startedAt = millis();
  while (millis() - startedAt < ms) {
    serviceWatchdog();
    delay(10);
  }
}

void serviceBuzzerMuteButton() {
  const bool rawPressed = digitalRead(BUZZER_MUTE_BUTTON_PIN) == LOW;
  const uint32_t now = millis();

  if (rawPressed != buzzerButtonLastRawPressed) {
    buzzerButtonLastRawPressed = rawPressed;
    buzzerButtonLastChangeMs = now;
  }

  if (now - buzzerButtonLastChangeMs < BUTTON_DEBOUNCE_MS) {
    return;
  }

  if (rawPressed == buzzerButtonStablePressed) {
    return;
  }

  buzzerButtonStablePressed = rawPressed;

  // Act only on the press edge. Pressing while no critical alarm exists does
  // not pre-mute the next alarm.
  if (buzzerButtonStablePressed) {
    const bool criticalNow = relayWaterDistanceValid &&
                             relayWaterDistanceCm <= WATER_CRITICAL_DISTANCE_CM;
    if (criticalNow && !buzzerMutedForCurrentCritical) {
      buzzerMutedForCurrentCritical = true;
      writeRelay(BUZZER_RELAY_PIN, false);
      Serial.println("[BUZZER] Nut IO14 da nhan -> TAT COI cho lan canh bao hien tai");
    }
  }
}

bool parseRelaySensorFloat(const String &wireValue, float &out) {
  if (wireValue.length() == 0 || wireValue == "x" || wireValue == "X" || wireValue == "-") {
    return false;
  }

  char *endPtr = nullptr;
  const float value = strtof(wireValue.c_str(), &endPtr);
  if (endPtr == wireValue.c_str() || *endPtr != '\0' || !isfinite(value)) {
    return false;
  }

  out = value;
  return true;
}

void updateStatusOutputs() {
  serviceBuzzerMuteButton();

  const bool redOn = relayWaterDistanceValid && relayWaterDistanceCm <= WATER_RED_DISTANCE_CM;
  const bool criticalOn = relayWaterDistanceValid && relayWaterDistanceCm <= WATER_CRITICAL_DISTANCE_CM;
  const bool yellowOn = relaySoilPhValid && relaySoilPh > SOIL_PH_HIGH_THRESHOLD;

  // Leaving the <=5 cm critical zone rearms the buzzer for the NEXT event.
  if (!criticalOn && buzzerCriticalWasActive) {
    buzzerMutedForCurrentCritical = false;
    Serial.println("[BUZZER] Muc nuoc da thoat nguong <=5cm -> da ARM lai coi");
  }
  buzzerCriticalWasActive = criticalOn;

  // IN4 is now a continuous buzzer relay. It remains ON throughout the
  // critical event unless the IO14 mute button has been pressed.
  const bool buzzerOn = criticalOn && !buzzerMutedForCurrentCritical;

  // "Normal" is only declared after BOTH required measurements are valid.
  const bool dataReady = relayWaterDistanceValid && relaySoilPhValid;
  const bool greenOn = dataReady && !redOn && !yellowOn && !criticalOn;

  writeRelay(RELAY_GREEN_PIN, greenOn);
  writeRelay(RELAY_YELLOW_PIN, yellowOn);
  writeRelay(RELAY_RED_PIN, redOn);
  writeRelay(BUZZER_RELAY_PIN, buzzerOn);

  if (!relayStateInitialized ||
      greenOn != lastRelayGreenOn ||
      yellowOn != lastRelayYellowOn ||
      redOn != lastRelayRedOn ||
      buzzerOn != lastRelayBuzzerOn) {
    relayStateInitialized = true;
    lastRelayGreenOn = greenOn;
    lastRelayYellowOn = yellowOn;
    lastRelayRedOn = redOn;
    lastRelayBuzzerOn = buzzerOn;

    Serial.printf("[RELAY] xanh=%s vang=%s do=%s coi=%s muted=%s | distance=%s",
                  greenOn ? "ON" : "OFF",
                  yellowOn ? "ON" : "OFF",
                  redOn ? "ON" : "OFF",
                  buzzerOn ? "ON" : "OFF",
                  buzzerMutedForCurrentCritical ? "YES" : "NO",
                  relayWaterDistanceValid ? String(relayWaterDistanceCm, 1).c_str() : "x");
    if (relayWaterDistanceValid) Serial.print("cm");
    Serial.print(" | pH=");
    if (relaySoilPhValid) Serial.print(relaySoilPh, 1);
    else Serial.print("x");
    Serial.println();
  }
}

void clearModemRx(uint32_t quietMs = 80) {
  const uint32_t startedAt = millis();
  uint32_t lastByteAt = millis();
  while (millis() - startedAt < 800) {
    while (modemSerial.available() > 0) {
modemSerial.read();
      lastByteAt = millis();
    }
    if (millis() - lastByteAt >= quietMs) break;
    serviceWatchdog();
    readSimpleLoRaUart();
    delay(2);
  }
}

bool modemProbeBaud(uint32_t baud) {
  modemSerial.end();
  pinMode(MODEM_RX_PIN, INPUT_PULLUP);
  pinMode(MODEM_TX_PIN, OUTPUT);
  digitalWrite(MODEM_TX_PIN, HIGH);
  delay(40);

  modemSerial.setRxBufferSize(2048);
  modemSerial.begin(baud, SERIAL_8N1, MODEM_RX_PIN, MODEM_TX_PIN);
  gpio_pullup_en(static_cast<gpio_num_t>(MODEM_RX_PIN));
  gpio_pulldown_dis(static_cast<gpio_num_t>(MODEM_RX_PIN));
  delay(120);
  clearModemRx();

  String probe;
  probe.reserve(128);
  uint32_t binary = 0;
  for (uint8_t attempt = 0; attempt < 3; ++attempt) {
    modemSerial.print("AT\r\n");
    const uint32_t t0 = millis();
    while (millis() - t0 < MODEM_BAUD_PROBE_MS) {
      serviceWatchdog();
      readSimpleLoRaUart();
      while (modemSerial.available() > 0) {
        const uint8_t b = static_cast<uint8_t>(modemSerial.read());
        if (b == '\r' || b == '\n' || b == '\t' || (b >= 0x20 && b <= 0x7E)) {
          if (probe.length() < 256) probe += static_cast<char>(b);
        } else {
          binary += 1;
        }
      }
      if (probe.indexOf("OK") >= 0) {
        Serial.printf("[MODEM] Tim thay AT baud=%lu (binary_bo=%lu)\n",
                      static_cast<unsigned long>(baud),
                      static_cast<unsigned long>(binary));
        activeModemBaud = baud;
        modemBinaryDropped += binary;
        return true;
      }
      delay(5);
    }
    delay(80);
  }

  Serial.printf("[MODEM] baud=%lu: khong co OK (ascii=%u, binary=%lu)\n",
                static_cast<unsigned long>(baud),
                static_cast<unsigned int>(probe.length()),
                static_cast<unsigned long>(binary));
  modemBinaryDropped += binary;
  return false;
}

bool detectModemBaud() {
  Serial.printf("[MODEM] Tu dong do baud RX=%d TX=%d; RX pull-up=BAT\n", MODEM_RX_PIN, MODEM_TX_PIN);
  for (size_t i = 0; i < MODEM_BAUD_CANDIDATE_COUNT; ++i) {
    if (modemProbeBaud(MODEM_BAUD_CANDIDATES[i])) {
      return true;
    }
  }

  modemSerial.end();
  pinMode(MODEM_RX_PIN, INPUT_PULLUP);
  Serial.println("[MODEM] KHONG tim thay modem AT. Kiem tra ESP TX17 -> SIM RX, ESP RX18 <- SIM TX, GND chung va muc logic UART.");
  return false;
}

bool ensureModemReady() {
  if (!MODEM_ENABLED) return false;
  if (modemReady) return true;

  // Do not block every incoming LoRa packet with repeated modem scans.
  if (lastModemInitAttemptMs != 0 && millis() - lastModemInitAttemptMs < MODEM_RETRY_INTERVAL_MS) {
    const uint32_t elapsed = millis() - lastModemInitAttemptMs;
    const uint32_t remain = (MODEM_RETRY_INTERVAL_MS > elapsed) ? (MODEM_RETRY_INTERVAL_MS - elapsed) : 0;
    Serial.printf("[MODEM] Chua san sang; cho retry ~%lu giay (baud=%lu)\n",
                  static_cast<unsigned long>((remain + 999) / 1000),
                  static_cast<unsigned long>(activeModemBaud));
return false;
  }

  Serial.println("[MODEM] Thu khoi tao lai modem...");
  modemReady = initModem();
  return modemReady;
}

String modemWaitHttpAction(uint8_t method, uint32_t timeoutMs) {
  String response;
  response.reserve(512);
  const String marker = String("+HTTPACTION: ") + String(method) + ",";
  const uint32_t startedAt = millis();
  uint32_t dropped = 0;

  while (millis() - startedAt < timeoutMs) {
    serviceWatchdog();
    readSimpleLoRaUart();
    while (modemSerial.available() > 0) {
      const uint8_t b = static_cast<uint8_t>(modemSerial.read());
      if (b == '\r' || b == '\n' || b == '\t' || (b >= 0x20 && b <= 0x7E)) {
        if (response.length() < 4096) response += static_cast<char>(b);
      } else {
        dropped += 1;
      }
    }

    // IMPORTANT: do NOT stop on the immediate "OK". SIMCom returns OK first,
    // then the asynchronous +HTTPACTION URC when the network transaction finishes.
    if (response.indexOf(marker) >= 0 || response.indexOf("ERROR") >= 0) {
      break;
    }
    watchdogDelay(10);
  }

  modemBinaryDropped += dropped;
  return response;
}

int parseHttpActionStatus(const String &response, uint8_t method) {
  const String marker = String("+HTTPACTION: ") + String(method) + ",";
  const int p = response.indexOf(marker);
  if (p < 0) return -1;
  const int start = p + marker.length();
  const int comma = response.indexOf(',', start);
  if (comma < 0) return response.substring(start).toInt();
  return response.substring(start, comma).toInt();
}

int parseHttpActionLength(const String &response, uint8_t method) {
  const String marker = String("+HTTPACTION: ") + String(method) + ",";
  const int p = response.indexOf(marker);
  if (p < 0) return -1;
  const int firstComma = response.indexOf(',', p + marker.length());
  if (firstComma < 0) return -1;
  const int lengthStart = firstComma + 1;
  return response.substring(lengthStart).toInt();
}

void printHttpActionDiagnostic(const String &response, uint8_t method, uint32_t elapsedMs) {
  const int status = parseHttpActionStatus(response, method);
  const int bodyLength = parseHttpActionLength(response, method);
  if (status == -1) {
    Serial.printf("[NET] HTTPACTION timeout/no-URC after %lums (DNS/TCP/TLS not confirmed)\n", static_cast<unsigned long>(elapsedMs));
    return;
  }
  Serial.printf("[HTTP] status=%d response_bytes=%d elapsed=%lums\n", status, bodyLength, static_cast<unsigned long>(elapsedMs));
  if (status >= 600) {
    Serial.println("[NET] modem transport code (not an HTTP status): inspect DNS, PDP/TCP and TLS diagnostics above");
  }
}

void printSafeHttpResponse(const String &response) {
  String compact = response;
  if (strlen(GATEWAY_INGEST_TOKEN) > 0) compact.replace(GATEWAY_INGEST_TOKEN, "[redacted]");
  compact.replace("\r", " ");
  compact.replace("\n", " ");
  compact.trim();
  if (compact.length() > 240) compact = compact.substring(0, 240) + "...";
  Serial.printf("[HTTP BODY] %s\n", compact.length() ? compact.c_str() : "(empty)");
}

String modemReadUntil(uint32_t timeoutMs) {
  String response;
  response.reserve(512);
  const uint32_t startedAt = millis();
  uint32_t dropped = 0;

  while (millis() - startedAt < timeoutMs) {
    serviceWatchdog();
    readSimpleLoRaUart();

    while (modemSerial.available() > 0) {
      const uint8_t b = static_cast<uint8_t>(modemSerial.read());
      // AT/HTTP responses are text. Keep CR/LF/TAB and printable ASCII;
      // drop binary garbage so a wrong/floating UART cannot fill RAM or spam Serial.
      if (b == '\r' || b == '\n' || b == '\t' || (b >= 0x20 && b <= 0x7E)) {
        if (response.length() < 4096) {
          response += static_cast<char>(b);
        }
      } else {
        dropped += 1;
      }
    }
    if (response.indexOf("\r\nOK\r\n") >= 0 ||
        response.indexOf("\r\nERROR\r\n") >= 0 ||
        response.indexOf("DOWNLOAD") >= 0) {
      break;
    }
    watchdogDelay(10);
  }

  modemBinaryDropped += dropped;
  if (dropped > 0) {
    Serial.printf("[MODEM] Da loc %lu byte binary tren UART modem\n", static_cast<unsigned long>(dropped));
  }
  return response;
}

bool sendAt(const String &command, const char *expected = "OK", uint32_t timeoutMs = MODEM_TIMEOUT_MS) {
  if (activeModemBaud == 0) return false;
  if (MODEM_VERBOSE_AT) {
    Serial.print("[MODEM] ");
    Serial.println(command);
  }
  clearModemRx(30);
  modemSerial.print(command);
  modemSerial.print("\r\n");
const String response = modemReadUntil(timeoutMs);
  const bool ok = response.indexOf(expected) >= 0;
  if (MODEM_VERBOSE_AT) {
    if (response.length() > 0) Serial.println(response);
    else Serial.println("[MODEM] (khong co phan hoi text)");
  } else if (!ok) {
    const bool optionalFailure =
      command == "AT+HTTPTERM" ||
      command.startsWith("AT+HTTPPARA=\"CID\"") ||
      command.startsWith("AT+HTTPPARA=\"REDIR\"") ||
      command == "AT+NETOPEN";
    if (optionalFailure) return ok;
    String compact = response;
    compact.replace("\r", " ");
    compact.replace("\n", " ");
    compact.trim();
    if (compact.length() > 180) compact = compact.substring(0, 180) + "...";
    Serial.printf("[MODEM FAIL] %s -> %s\n", command.c_str(), compact.length() ? compact.c_str() : "no-response");
  }
  return ok;
}

bool sendAtDiagnostic(const String &command, const char *label, uint32_t timeoutMs) {
  if (activeModemBaud == 0) return false;

  clearModemRx(30);
  modemSerial.print(command);
  modemSerial.print("\r\n");

  String response = modemReadUntil(timeoutMs);
  const bool ok = response.indexOf("OK") >= 0;
  response.replace("\r", " ");
  response.replace("\n", " ");
  response.trim();
  if (response.length() > 220) response = response.substring(0, 220) + "...";

  Serial.printf("[MODEM DIAG] %s: %s\n",
                label,
                response.length() ? response.c_str() : "no-response");
  return ok;
}

void diagnoseSupabaseDns() {
  String dnsCommand = "AT+CDNSGIP=\"";
  dnsCommand += WEB_SERVER_HOST;
  dnsCommand += "\"";
  sendAtDiagnostic(dnsCommand, "DNS Supabase", 10000);
}

void configureHttpsForHttpStack() {
  // Supabase is HTTPS-only and requires a clean TLS/SNI handshake. SIMCom HTTP
  // firmwares vary: some infer these defaults, others need an explicit SSL
  // context bound to the HTTP service.
  bool sslContextConfigured = false;
  sslContextConfigured |= sendAt("AT+CSSLCFG=\"sslversion\",0,4", "OK", 3000);
  sslContextConfigured |= sendAt("AT+CSSLCFG=\"authmode\",0,0", "OK", 3000);
  sendAt("AT+CSSLCFG=\"ignorelocaltime\",0,1", "OK", 3000);
  sendAt("AT+CSSLCFG=\"negotiatetime\",0,120", "OK", 3000);
  sendAt("AT+CSSLCFG=\"enableSNI\",0,1", "OK", 3000);

  bool httpUsesSslContext = sendAt("AT+HTTPPARA=\"SSLCFG\",0", "OK", 3000);
  if (!httpUsesSslContext) {
    httpUsesSslContext = sendAt("AT+HTTPPARA=\"SSLCFG\",\"0\"", "OK", 3000);
  }

  Serial.printf("[HTTP] HTTPS ctx0=%s SSLCFG=%s SNI=on auth=none\n",
                sslContextConfigured ? "OK" : "UNSUPPORTED",
                httpUsesSslContext ? "OK" : "UNSUPPORTED");
}

void setupWatchdog() {
  if (esp_task_wdt_status(NULL) != ESP_OK) {
    const esp_err_t addResult = esp_task_wdt_add(NULL);
    if (addResult != ESP_OK && addResult != ESP_ERR_INVALID_STATE) {
      Serial.printf("[WATCHDOG] Loi add task: %d\n", static_cast<int>(addResult));
    }
  }
}

void powerOnModem() {
  if (MODEM_PEN_PIN < 0) {
    return;
  }

  pinMode(MODEM_PEN_PIN, OUTPUT);
  digitalWrite(MODEM_PEN_PIN, HIGH);
  watchdogDelay(5000);
}

void powerOffModem() {
  modemReady = false;
  activeModemBaud = 0;
  modemSerial.end();

  // Turn the 4G module off, but do NOT actively drive its UART pins while LoRa
  // is the priority. Keep IO17/IO18 high-impedance to minimize coupling/noise.
  if (MODEM_PEN_PIN >= 0) {
    pinMode(MODEM_PEN_PIN, OUTPUT);
    digitalWrite(MODEM_PEN_PIN, LOW);
  }

  pinMode(MODEM_RX_PIN, INPUT);
  pinMode(MODEM_TX_PIN, INPUT);
  gpio_pullup_dis(static_cast<gpio_num_t>(MODEM_RX_PIN));
  gpio_pulldown_dis(static_cast<gpio_num_t>(MODEM_RX_PIN));
  gpio_pullup_dis(static_cast<gpio_num_t>(MODEM_TX_PIN));
  gpio_pulldown_dis(static_cast<gpio_num_t>(MODEM_TX_PIN));
  watchdogDelay(MODEM_POWER_OFF_SETTLE_MS);
}

bool initModem() {
  if (!MODEM_ENABLED) {
    Serial.println("[MODEM] Dang tat de gateway uu tien nhan LoRa");
    return false;
  }

  lastModemInitAttemptMs = millis();
  Serial.println("[MODEM] ===== KHOI TAO 4G =====");

  if (!detectModemBaud()) {
    activeModemBaud = 0;
    Serial.println("[MODEM FAIL] Khong tim thay modem tra loi AT");
    return false;
  }

  if (!sendAt("AT", "OK", 2500)) {
    Serial.println("[MODEM FAIL] AT khong OK");
    return false;
  }
  if (!sendAt("ATE0", "OK", 2500)) {
    Serial.println("[MODEM FAIL] Khong tat duoc echo ATE0");
    return false;
  }

  sendAt("AT+IPR?", "OK", 2500);
  sendAt("AT+SIMCOMATI", "OK", 3000);   // diagnostic: modem/firmware family
  if (!sendAt("AT+CPIN?", "READY", 5000)) {
    Serial.println("[MODEM FAIL] SIM chua READY / PIN / SIM khong nhan");
    return false;
  }
  sendAt("AT+COPS?", "OK", 5000);
  sendAt("AT+CPSI?", "OK", 5000);
  if (!sendAt("AT+CSQ", "OK", 3000)) {
Serial.println("[MODEM FAIL] Khong doc duoc CSQ");
    return false;
  }
  sendAt("AT+CREG?", "OK", 3000);
  sendAt("AT+CGREG?", "OK", 3000);
  sendAt("AT+CEREG?", "OK", 3000);

  String apnCommand = "AT+CGDCONT=1,\"IP\",\"";
  apnCommand += SIM_APN;
  apnCommand += "\"";
  if (!sendAt(apnCommand, "OK", 5000)) {
    Serial.printf("[MODEM FAIL] Khong set duoc APN '%s'\n", SIM_APN);
    return false;
  }

  // Attach packet service. If already attached this returns +CGATT: 1.
  if (!sendAt("AT+CGATT?", "+CGATT: 1", 4000)) {
    Serial.println("[MODEM] Chua attach data -> thu AT+CGATT=1");
    if (!sendAt("AT+CGATT=1", "OK", 15000)) {
      Serial.println("[MODEM FAIL] CGATT=1 that bai");
      return false;
    }
  }

  // Activate PDP context. This is the important data-session step for HTTP on A76xx/SIM76xx.
  if (!sendAt("AT+CGACT=1,1", "OK", 15000)) {
    Serial.println("[MODEM FAIL] Khong kich hoat duoc PDP context CGACT=1,1");
    return false;
  }
  if (!sendAt("AT+CGPADDR=1", "OK", 5000)) {
    Serial.println("[MODEM FAIL] Khong lay duoc IP PDP (CGPADDR)");
    return false;
  }
  diagnoseSupabaseDns();

  // NETOPEN belongs to the TCP/IP socket stack on many SIMCom firmwares.
  // HTTP(S) has its own service, so keep this diagnostic/non-fatal instead of blocking HTTP.
  sendAt("AT+NETOPEN", "OK", 8000);

  Serial.printf("[MODEM] SAN SANG baud=%lu APN=%s\n",
                static_cast<unsigned long>(activeModemBaud), SIM_APN);
  return true;
}

// Station packets carry `summary_minutes`, not an epoch. This gateway obtains
// UTC from the cellular network and records it as an explicit receipt time;
// `millis()` is never sent as a measurement timestamp.
static uint32_t networkEpochAtSync = 0;
static uint32_t networkClockSyncedAtMs = 0;

bool isLeapYear(int year) {
  return (year % 4 == 0 && year % 100 != 0) || year % 400 == 0;
}

uint32_t unixSecondsUtc(int year, int month, int day, int hour, int minute, int second) {
  static const uint8_t daysBeforeMonth[] = {0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334};
  uint32_t days = 0;
  for (int y = 1970; y < year; ++y) days += isLeapYear(y) ? 366 : 365;
  days += daysBeforeMonth[month - 1] + day - 1;
  if (month > 2 && isLeapYear(year)) days += 1;
  return days * 86400UL + hour * 3600UL + minute * 60UL + second;
}

bool syncGatewayClock() {
  clearModemRx(30);
  modemSerial.print("AT+CCLK?\r\n");
  const String response = modemReadUntil(5000);
  const int start = response.indexOf('\"');
  const int end = start >= 0 ? response.indexOf('\"', start + 1) : -1;
  if (start < 0 || end < 0) return false;
  const String value = response.substring(start + 1, end);
  int yy, month, day, hour, minute, second, zoneQuarterHours;
  char sign;
  if (sscanf(value.c_str(), "%d/%d/%d,%d:%d:%d%c%d", &yy, &month, &day, &hour, &minute, &second, &sign, &zoneQuarterHours) != 8 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const uint32_t localEpoch = unixSecondsUtc(2000 + yy, month, day, hour, minute, second);
  const int32_t offsetSeconds = zoneQuarterHours * 15L * 60L;
  const int64_t utc = sign == '+' ? static_cast<int64_t>(localEpoch) - offsetSeconds : static_cast<int64_t>(localEpoch) + offsetSeconds;
  if (utc < 1704067200LL || utc > 4102444800LL) return false;
  networkEpochAtSync = static_cast<uint32_t>(utc);
  networkClockSyncedAtMs = millis();
  Serial.printf("[CLOCK] network UTC=%lu\n", static_cast<unsigned long>(networkEpochAtSync));
  return true;
}

uint32_t gatewayReceiptTimestamp() {
  return networkEpochAtSync + ((millis() - networkClockSyncedAtMs) / 1000UL);
}

String attachGatewayReceiptTimestamp(String payload) {
  const String timestamp = String(gatewayReceiptTimestamp());
  payload.replace("\"timestamp\":0", "\"timestamp\":" + timestamp);
  return payload;
}

String httpGet(const char *url) {
  if (!MODEM_ENABLED) {
    return "";
  }

  if (!ensureModemReady()) {
    return "";
  }

  sendAt("AT+HTTPTERM", "OK", 3000);
  if (!sendAt("AT+HTTPINIT")) return "";

  String urlCommand = "AT+HTTPPARA=\"URL\",\"";
  urlCommand += url;
  urlCommand += "\"";
  if (!sendAt(urlCommand)) return "";

  // This modem firmware already reaches HTTPS URLs directly. AT+HTTPSSL=1 returns ERROR,
  // so do not send that unsupported command.
  (void)url;

  String headerCommand = "AT+HTTPPARA=\"USERDATA\",\"User-Agent: HORIZON-Gateway/1.0\\r\\n";
  headerCommand += "x-contract-version: v1\\r\\n";
  if (strlen(GATEWAY_INGEST_TOKEN) > 0) {
    headerCommand += "x-gateway-token: ";
    headerCommand += GATEWAY_INGEST_TOKEN;
    headerCommand += "\\r\\n";
  }
  headerCommand += "\"";
  sendAt(headerCommand, "OK", 3000);

  clearModemRx(30);
  modemSerial.print("AT+HTTPACTION=0\r\n");
  const uint32_t actionStartedAt = millis();
  const String actionResponse = modemWaitHttpAction(0, HTTP_TIMEOUT_MS);
  if (MODEM_VERBOSE_AT) Serial.println(actionResponse);
  const int httpStatus = parseHttpActionStatus(actionResponse, 0);
  printHttpActionDiagnostic(actionResponse, 0, millis() - actionStartedAt);
  if (httpStatus != 200) {
    sendAt("AT+HTTPTERM", "OK", 3000);
    return "";
  }

  modemSerial.println("AT+HTTPREAD");
  const String readResponse = modemReadUntil(HTTP_TIMEOUT_MS);
  printSafeHttpResponse(readResponse);
  sendAt("AT+HTTPTERM", "OK", 3000);

  const int headerEnd = readResponse.indexOf("\r\n");
  const int okStart = readResponse.lastIndexOf("\r\nOK");
  if (headerEnd < 0 || okStart <= headerEnd) {
    return readResponse;
  }

  String body = readResponse.substring(headerEnd + 2, okStart);
  body.trim();
  return body;
}

int extractIntNear(const String &text, int from, const char *field, int fallback) {
  String key = "\"";
  key += field;
  key += "\":";
  const int start = text.indexOf(key, from);
  if (start < 0) return fallback;

  const int valueStart = start + key.length();
  int valueEnd = valueStart;
  while (valueEnd < text.length() && isDigit(text[valueEnd])) {
    valueEnd += 1;
  }
  if (valueEnd == valueStart) return fallback;
  return text.substring(valueStart, valueEnd).toInt();
}

int extractBoolOrIntNear(const String &text, int from, const char *field, int fallback) {
  String key = "\"";
  key += field;
  key += "\":";
  const int start = text.indexOf(key, from);
  if (start < 0) return fallback;

  const int valueStart = start + key.length();
  if (text.startsWith("true", valueStart)) return 1;
  if (text.startsWith("false", valueStart)) return 0;
  if (text[valueStart] == '1') return 1;
  if (text[valueStart] == '0') return 0;
  return fallback;
}

void sendConfigToStation(const char *stationId, int sampleSeconds, int sleepSeconds) {
  String command;
  command.reserve(140);
  command += "{\"type\":\"config\",\"station_id\":\"";
  command += stationId;
  command += "\",\"sample_interval_seconds\":";
  command += String(sampleSeconds);
  command += ",\"sleep_interval_seconds\":";
  command += String(sleepSeconds);
  command += "}";

  loraSerial.println(command);
  Serial.print("[CONFIG->LORA] ");
  Serial.println(command);
}

void applyGatewayConfig(int sampleSeconds, int sleepSeconds, int tideLevel, int salinityAlert, int buzzerAlert) {
  configPollIntervalMs = max<uint32_t>(30000UL, static_cast<uint32_t>(sampleSeconds) * 1000UL);
  gatewaySleepIntervalMs = max<uint32_t>(0UL, static_cast<uint32_t>(sleepSeconds) * 1000UL);

  tideHighAlert = tideLevel >= 1;
  tideCriticalAlert = tideLevel >= 2;
  soilSalinityAlert = salinityAlert == 1;
  forcedBuzzerAlert = buzzerAlert == 1;

  Serial.printf("[CONFIG] gateway poll=%lus sleep=%lus tide=%d salinity=%d buzzer=%d muted=%s\n",
                configPollIntervalMs / 1000UL,
                gatewaySleepIntervalMs / 1000UL,
                tideLevel,
                salinityAlert,
                buzzerAlert,
                buzzerMutedForCurrentCritical ? "yes" : "no");
}

void parseAndForwardConfigs(const String &body) {
const char *stations[] = {"STATION_01", "STATION_02", "STATION_03"};
  for (const char *stationId : stations) {
    String stationKey = "\"station_id\":\"";
    stationKey += stationId;
    stationKey += "\"";

    const int pos = body.indexOf(stationKey);
    if (pos < 0) {
      continue;
    }

    const int sampleSeconds = extractIntNear(body, pos, "sample_interval_seconds", 300);
    const int sleepSeconds = extractIntNear(body, pos, "sleep_interval_seconds", 0);
    if (String(stationId) == "STATION_03") {
      int tideLevel = extractIntNear(body, pos, "tide_alert_level", 0);
      const int redLight = extractBoolOrIntNear(body, pos, "red_light", tideLevel >= 1 ? 1 : 0);
      const int criticalTide = extractBoolOrIntNear(body, pos, "tide_critical", tideLevel >= 2 ? 1 : 0);
      if (criticalTide == 1) {
        tideLevel = 2;
      } else if (redLight == 1) {
        tideLevel = max(tideLevel, 1);
      }

      const int salinityAlert = extractBoolOrIntNear(
        body,
        pos,
        "soil_salinity_alert",
        extractBoolOrIntNear(body, pos, "yellow_light", 0)
      );
      const int buzzerAlert = extractBoolOrIntNear(
        body,
        pos,
        "buzzer_alert",
        extractBoolOrIntNear(body, pos, "buzzer_on", tideLevel >= 2 ? 1 : 0)
      );

      applyGatewayConfig(sampleSeconds, sleepSeconds, tideLevel, salinityAlert, buzzerAlert);
    } else {
      sendConfigToStation(stationId, sampleSeconds, sleepSeconds);
      watchdogDelay(200);
    }
  }

  String gatewayKey = "\"gateway_id\":\"";
  gatewayKey += GATEWAY_ID;
  gatewayKey += "\"";
  const int gatewayPos = body.indexOf(gatewayKey);
  if (gatewayPos >= 0) {
    const int sampleSeconds = extractIntNear(body, gatewayPos, "sample_interval_seconds", configPollIntervalMs / 1000UL);
    const int sleepSeconds = extractIntNear(body, gatewayPos, "sleep_interval_seconds", gatewaySleepIntervalMs / 1000UL);
    int tideLevel = extractIntNear(body, gatewayPos, "tide_alert_level", 0);
    if (extractBoolOrIntNear(body, gatewayPos, "tide_critical", 0) == 1) tideLevel = 2;
    if (extractBoolOrIntNear(body, gatewayPos, "red_light", 0) == 1) tideLevel = max(tideLevel, 1);
    const int salinityAlert = extractBoolOrIntNear(
      body,
      gatewayPos,
      "soil_salinity_alert",
      extractBoolOrIntNear(body, gatewayPos, "yellow_light", 0)
    );
    const int buzzerAlert = extractBoolOrIntNear(
      body,
      gatewayPos,
      "buzzer_alert",
      extractBoolOrIntNear(body, gatewayPos, "buzzer_on", tideLevel >= 2 ? 1 : 0)
    );
    applyGatewayConfig(sampleSeconds, sleepSeconds, tideLevel, salinityAlert, buzzerAlert);
  }
}

void pollRuntimeConfigs() {
  if (!MODEM_ENABLED || !CONFIG_POLL_ENABLED) return;
  if (pairedBatchTriggered || pendingStation1Ready || pendingStation2Ready || modemHttpBusy) return;
  if (loraSerial.available() > 0 || (lastSimpleLoRaActivityMs != 0 && millis() - lastSimpleLoRaActivityMs < 5000)) return;
if (millis() - lastConfigPollMs < configPollIntervalMs) return;
  lastConfigPollMs = millis();

  Serial.println("[CONFIG] Kiem tra cau hinh server...");
  const String body = httpGet(CONFIG_URL);
  if (body.length() == 0) {
    Serial.println("[CONFIG] Khong co phan hoi cau hinh");
    return;
  }

  parseAndForwardConfigs(body);
}

void maybeEnterGatewaySleep() {
  if (gatewaySleepIntervalMs == 0 || loraLine.length() > 0 || pairedBatchTriggered || pendingStation1Ready || pendingStation2Ready || modemHttpBusy) {
    return;
  }

  Serial.printf("[POWER] Gateway ngu sau %lu giay\n", gatewaySleepIntervalMs / 1000UL);
  Serial.flush();
  esp_sleep_enable_timer_wakeup(static_cast<uint64_t>(gatewaySleepIntervalMs) * 1000ULL);
  esp_deep_sleep_start();
}

enum HttpPostOutcome : uint8_t {
  HTTP_POST_DELIVERED,
  HTTP_POST_TERMINAL_REJECTION,
  HTTP_POST_RETRY,
};

HttpPostOutcome httpPostJson(const String &payload) {
  if (!MODEM_ENABLED) {
    Serial.println("[HTTP] Bo POST: MODEM_ENABLED=false");
    return HTTP_POST_RETRY;
  }

  if (!ensureModemReady()) {
    Serial.println("[HTTP] Bo POST: modem chua san sang / chua co data network");
    return HTTP_POST_RETRY;
  }

  Serial.printf("[HTTP] POST %u byte -> %s\n",
                static_cast<unsigned int>(payload.length()), WEB_SERVER_URL);

  // Clean previous session. ERROR here is harmless if no session exists.
  sendAt("AT+HTTPTERM", "OK", 2500);

  if (!sendAt("AT+HTTPINIT", "OK", 5000)) {
    Serial.println("[HTTP FAIL] HTTPINIT");
    return HTTP_POST_RETRY;
  }

  // Some SIMCom firmwares expose CID/redirect, others do not; keep them non-fatal.
  sendAt("AT+HTTPPARA=\"CID\",1", "OK", 3000);
  sendAt("AT+HTTPPARA=\"REDIR\",1", "OK", 3000);
  configureHttpsForHttpStack();

  String urlCommand = "AT+HTTPPARA=\"URL\",\"";
  urlCommand += WEB_SERVER_URL;
  urlCommand += "\"";
  if (!sendAt(urlCommand, "OK", 5000)) {
    Serial.println("[HTTP FAIL] Khong set duoc URL");
    sendAt("AT+HTTPTERM", "OK", 2500);
    return HTTP_POST_RETRY;
  }

  // HTTPS handling differs slightly by SIMCom firmware. A76xx often accepts an
  // https:// URL directly; HTTPSSL is therefore diagnostic/non-fatal here.
  // This modem firmware accepts https:// URLs directly. AT+HTTPSSL=1 is unsupported
  // on the tested firmware and only creates log noise, so it is intentionally skipped.

  String headerCommand = "AT+HTTPPARA=\"USERDATA\",\"User-Agent: HORIZON-Gateway/1.0\\r\\n";
  headerCommand += "x-contract-version: v1\\r\\n";
  if (strlen(GATEWAY_INGEST_TOKEN) > 0) {
    headerCommand += "x-gateway-token: ";
    headerCommand += GATEWAY_INGEST_TOKEN;
    headerCommand += "\\r\\n";
  }
  headerCommand += "\"";
  sendAt(headerCommand, "OK", 3000);

  if (!sendAt("AT+HTTPPARA=\"CONTENT\",\"application/json\"", "OK", 5000)) {
    Serial.println("[HTTP FAIL] CONTENT application/json");
    sendAt("AT+HTTPTERM", "OK", 2500);
    return HTTP_POST_RETRY;
  }

  String dataCommand = "AT+HTTPDATA=";
  dataCommand += String(payload.length());
  dataCommand += ",10000";
  clearModemRx(30);
  modemSerial.print(dataCommand);
  modemSerial.print("\r\n");
  String prompt = modemReadUntil(7000);
  if (MODEM_VERBOSE_AT) Serial.println(prompt);
  if (prompt.indexOf("DOWNLOAD") < 0) {
    Serial.println("[HTTP FAIL] Khong nhan duoc DOWNLOAD sau HTTPDATA");
sendAt("AT+HTTPTERM", "OK", 2500);
    return HTTP_POST_RETRY;
  }

  modemSerial.print(payload);
  String dataResponse = modemReadUntil(15000);
  if (MODEM_VERBOSE_AT) Serial.println(dataResponse);
  if (dataResponse.indexOf("OK") < 0) {
    Serial.println("[HTTP FAIL] Modem khong xac nhan payload OK");
    sendAt("AT+HTTPTERM", "OK", 2500);
    return HTTP_POST_RETRY;
  }

  // AT+HTTPACTION is ASYNCHRONOUS: immediate OK is NOT the HTTP result.
  // Wait for +HTTPACTION: 1,<status>,<length> before deciding success/failure.
  clearModemRx(30);
  modemSerial.print("AT+HTTPACTION=1\r\n");
  const uint32_t actionStartedAt = millis();
  const String actionResponse = modemWaitHttpAction(1, HTTP_TIMEOUT_MS);
  if (MODEM_VERBOSE_AT) Serial.println(actionResponse);

  const int httpStatus = parseHttpActionStatus(actionResponse, 1);
  const int responseLength = parseHttpActionDataLength(actionResponse, 1);
  Serial.printf("[HTTP] HTTPACTION POST status=%d len=%d\n", httpStatus, responseLength);
  printHttpActionDiagnostic(actionResponse, 1, millis() - actionStartedAt);

  const bool success = (httpStatus >= 200 && httpStatus < 300);
  if (!success) {
    if (httpStatus == -1) {
      Serial.println("[HTTP FAIL] Khong thay +HTTPACTION truoc timeout");
    } else if (httpStatus == 715) {
      Serial.println("[HTTP FAIL] 715 = modem khong bat tay TLS/SSL duoc voi host HTTPS");
    } else if (httpStatus >= 600) {
      Serial.println("[HTTP FAIL] Ma 6xx cua modem: loi DNS/network/SSL tuy firmware");
    } else {
      Serial.println("[HTTP FAIL] Server da tra HTTP ngoai 2xx");
    }
  }

  // Read response body for diagnostics. A non-retryable Edge rejection is
  // intentionally not retried forever: it did not create a DB row, and the
  // serial log names it as a rejected payload rather than an upload success.
  bool terminalRejection = false;
  if (httpStatus > 0) {
    clearModemRx(20);
    if (responseLength > 0) {
      const int readLength = min(responseLength, 512);
      modemSerial.printf("AT+HTTPREAD=0,%d\r\n", readLength);
    } else {
      modemSerial.print("AT+HTTPREAD\r\n");
    }
    String readResponse = modemReadUntil(5000);
    if (responseLength > 0 && readResponse.indexOf("+HTTPREAD") < 0) {
      clearModemRx(20);
      modemSerial.print("AT+HTTPREAD\r\n");
      readResponse = modemReadUntil(5000);
    }
    if (readResponse.length() > 0) {
      printSafeHttpResponse(readResponse);
      terminalRejection = readResponse.indexOf("\"retryable\":false") >= 0;
    }
  }

  sendAt("AT+HTTPTERM", "OK", 3000);
  if (success) return HTTP_POST_DELIVERED;
  if (terminalRejection) {
    Serial.println("[HTTP REJECTED] Payload khong retryable; khong co DB reading duoc tao");
    return HTTP_POST_TERMINAL_REJECTION;
  }
  return HTTP_POST_RETRY;
}

bool isLikelyJson(const String &json) {
  return json.length() > 2 && json[0] == '{' && json[json.length() - 1] == '}';
}

String extractJsonStringField(const String &json, const char *field) {
  String key = "\"";
  key += field;
  key += "\":\"";
  const int start = json.indexOf(key);
  if (start < 0) {
    return "";
  }

  const int valueStart = start + key.length();
  const int valueEnd = json.indexOf("\"", valueStart);
  if (valueEnd < 0) {
    return "";
  }

  return json.substring(valueStart, valueEnd);
}

uint8_t countJsonFieldOccurrences(const String &json, const char *field) {
  String key = "\"";
  key += field;
  key += "\":";

  uint8_t count = 0;
  int from = 0;
  while (from < static_cast<int>(json.length())) {
    const int pos = json.indexOf(key, from);
    if (pos < 0) {
      break;
    }
    count += 1;
    from = pos + key.length();
  }
  return count;
}

bool isKnownStationId(const String &stationId) {
  return stationId == "STATION_01" || stationId == "STATION_02";
}

String expectedMessagePrefix(const String &stationId) {
  String prefix = stationId;
  prefix += "-";
  return prefix;
}

String &lastAcceptedMessageIdFor(const String &stationId) {
  if (stationId == "STATION_01") {
    return lastAcceptedMessageIdStation1;
  }
  return lastAcceptedMessageIdStation2;
}
uint32_t &lastAcceptedAtFor(const String &stationId) {
  if (stationId == "STATION_01") {
    return lastAcceptedAtStation1;
  }
  return lastAcceptedAtStation2;
}

void sendStationAck(const String &messageId) {
  if (messageId.length() == 0) {
    return;
  }

  String ack;
  ack.reserve(messageId.length() + 36);
  ack += "{\"type\":\"ack\",\"message_id\":\"";
  ack += messageId;
  ack += "\"}";

  // Cho module tram chuyen TX -> RX sau khi vua phat mot goi dai.
  watchdogDelay(LORA_ACK_START_DELAY_MS);

  for (uint8_t copy = 1; copy <= LORA_ACK_REPEAT_COUNT; copy += 1) {
    loraSerial.println(ack);
    loraSerial.flush();

    Serial.printf("[ACK->LORA] %u/%u %s\n",
                  copy,
                  LORA_ACK_REPEAT_COUNT,
                  ack.c_str());

    if (copy < LORA_ACK_REPEAT_COUNT) {
      watchdogDelay(LORA_ACK_REPEAT_GAP_MS);
    }
  }
}

void finishCurrentPoll(const char *reason) {
  if (waitingForPollResponse) {
    Serial.printf("[POLL] Ket thuc %s: %s\n", activePollStation.c_str(), reason);
  }

  waitingForPollResponse = false;
  activePollStation = "";
  nextPollAtMs = millis() + LORA_POLL_GUARD_MS;
}

void sendPollToStation(const char *stationId) {
  String poll;
  poll.reserve(64);
  poll += "{\"type\":\"poll\",\"station_id\":\"";
  poll += stationId;
  poll += "\"}";

  // Drop stale bytes/fragment left by the previous transaction.
  loraJsonBuffer = "";
  loraJsonInString = false;
  loraJsonEscape = false;
  while (loraSerial.available() > 0) {
    (void)loraSerial.read();
  }

  activePollStation = stationId;
  waitingForPollResponse = true;
  pollStartedMs = millis();

  loraSerial.println(poll);
  loraSerial.flush();

  Serial.print("[POLL->LORA] ");
  Serial.println(poll);
}

void serviceStationPolling() {
  const uint32_t now = millis();

  if (waitingForPollResponse) {
    if (now - pollStartedMs >= LORA_POLL_RESPONSE_TIMEOUT_MS) {
      Serial.printf("[POLL] Het thoi gian cho %s\n", activePollStation.c_str());
      finishCurrentPoll("timeout");
    }
    return;
  }

  if (static_cast<int32_t>(now - nextPollAtMs) < 0) {
    return;
  }

  const char *stationId = POLL_STATIONS[nextPollStationIndex];
  nextPollStationIndex = (nextPollStationIndex + 1) % POLL_STATION_COUNT;
  sendPollToStation(stationId);
}

bool validateStationDataPacket(
  const String &json,
  String &stationId,
  String &payloadType,
  String &messageId
) {
  if (!isLikelyJson(json)) {
    Serial.println("[LORA] BO GOI: khung JSON khong hop le");
    return false;
  }

  // Identity fields must appear exactly once.
  if (countJsonFieldOccurrences(json, "type") != 1 ||
      countJsonFieldOccurrences(json, "station_id") != 1) {
    Serial.println("[LORA] BO GOI: trung/lac field type hoac station_id - nghi collision");
    return false;
  }

  stationId = extractJsonStringField(json, "station_id");
  payloadType = extractJsonStringField(json, "type");

  if (!isKnownStationId(stationId)) {
Serial.print("[LORA] BO GOI: station_id khong hop le: ");
    Serial.println(stationId);
    return false;
  }

  // no_data/status is only accepted for the station currently being polled.
  if (payloadType == "station_status") {
    if (!waitingForPollResponse || stationId != activePollStation) {
      return false;
    }
    return true;
  }

  if (payloadType != "station_summary" && payloadType != "ping") {
    Serial.print("[LORA] BO GOI: type khong duoc chap nhan: ");
    Serial.println(payloadType);
    return false;
  }

  if (countJsonFieldOccurrences(json, "message_id") != 1) {
    Serial.println("[LORA] BO GOI: message_id thieu/trung - nghi collision");
    return false;
  }

  messageId = extractJsonStringField(json, "message_id");
  const String prefix = expectedMessagePrefix(stationId);
  if (!messageId.startsWith(prefix)) {
    Serial.printf("[LORA] BO GOI: station=%s nhung message_id=%s\n",
                  stationId.c_str(),
                  messageId.c_str());
    return false;
  }

  // If a station missed our ACK, it repeats the same message_id.
  // Keep accepting/ACKing that retry briefly, but it will not be forwarded twice.
  String &lastAccepted = lastAcceptedMessageIdFor(stationId);
  uint32_t &lastAcceptedAt = lastAcceptedAtFor(stationId);
  const bool recentDuplicate =
    lastAccepted == messageId &&
    millis() - lastAcceptedAt <= LORA_DUPLICATE_ACK_WINDOW_MS;

  if (recentDuplicate) {
    return true;
  }

  if (!waitingForPollResponse || stationId != activePollStation) {
    Serial.printf("[LORA] BO GOI: nhan %s khi dang cho %s\n",
                  stationId.c_str(),
                  waitingForPollResponse ? activePollStation.c_str() : "khong_tram_nao");
    return false;
  }

  return true;
}

void handleStationPayload(const String &stationPayload) {
  String stationId;
  String payloadType;
  String messageId;

  if (!validateStationDataPacket(stationPayload, stationId, payloadType, messageId)) {
    ignoredLoraLineCount += 1;
    return;
  }

  if (payloadType == "station_status") {
    const String status = extractJsonStringField(stationPayload, "status");
    Serial.printf("[LORA] %s phan hoi trang_thai=%s (%u ky tu)\n",
                  stationId.c_str(),
                  status.length() > 0 ? status.c_str() : "khong_ro",
                  static_cast<unsigned int>(stationPayload.length()));
    finishCurrentPoll("station_status");
    return;
  }

  Serial.println("============================================================");
  Serial.printf("[DATA][%s] type=%s message_id=%s bytes=%u\n",
                stationId.c_str(),
                payloadType.c_str(),
                messageId.c_str(),
                static_cast<unsigned int>(stationPayload.length()));
  Serial.println("[DATA] legacy JSON frame received (content suppressed)");

  // ACK immediately so the station can close its transaction.
  sendStationAck(messageId);
String &lastAccepted = lastAcceptedMessageIdFor(stationId);
  if (lastAccepted == messageId) {
    lastAcceptedAtFor(stationId) = millis();
    Serial.printf("[LORA] Goi lap %s - ACK lai, KHONG gui web lan 2\n", messageId.c_str());
    finishCurrentPoll("duplicate_acked");
    return;
  }

  lastAccepted = messageId;
  lastAcceptedAtFor(stationId) = millis();

  // Legacy JSON is acknowledged during transition but never forwarded.
  // Only the CRC QoS1 path below produces canonical TelemetryPayloadV1.
  Serial.println("[LORA] legacy JSON frame not forwarded to edge-ingest");

  finishCurrentPoll("data_ok");
}

void resetLoraFrameParser() {
  loraJsonBuffer = "";
  loraJsonInString = false;
  loraJsonEscape = false;
}

void consumeLoraByte(char c) {
  lastLoraByteMs = millis();

  if (DEBUG_LORA_RAW_UART) {
    Serial.write(c);
  }

  // Ignore everything until a JSON object starts.
  if (loraJsonBuffer.length() == 0) {
    if (c == '{') {
      loraJsonBuffer = "{";
      loraJsonInString = false;
      loraJsonEscape = false;
    }
    return;
  }

  // All station/gateway protocol packets are flat JSON objects. If a second
  // unquoted '{' appears, the stream was likely joined/corrupted. Restart at
  // the newest object instead of ACKing a mixed frame.
  if (!loraJsonInString && c == '{') {
    Serial.println("[LORA] Phat hien '{' moi khi goi cu chua xong - bo goi cu/restart");
    recoveredLoraJsonCount += 1;
    loraJsonBuffer = "{";
    loraJsonEscape = false;
    return;
  }

  loraJsonBuffer += c;

  if (loraJsonBuffer.length() > LORA_LINE_MAX_CHARS) {
    ignoredLoraLineCount += 1;
    Serial.println("[LORA] BO GOI: qua dai");
    resetLoraFrameParser();
    return;
  }

  if (loraJsonInString) {
    if (loraJsonEscape) {
      loraJsonEscape = false;
    } else if (c == '\\') {
      loraJsonEscape = true;
    } else if (c == '"') {
      loraJsonInString = false;
    }
    return;
  }

  if (c == '"') {
    loraJsonInString = true;
    return;
  }

  if (c == '}') {
    const String completePacket = loraJsonBuffer;
    resetLoraFrameParser();
    handleStationPayload(completePacket);
  }
}

void readLoRaUart() {
  bool gotByte = false;

  if (loraJsonBuffer.length() > 0 &&
      millis() - lastLoraByteMs > LORA_PARTIAL_FRAME_TIMEOUT_MS) {
    Serial.println("[LORA] Bo fragment cu do qua thoi gian cho");
    resetLoraFrameParser();
  }

  while (loraSerial.available() > 0) {
    serviceWatchdog();
    gotByte = true;
    consumeLoraByte(static_cast<char>(loraSerial.read()));
  }

  if (!gotByte && millis() - lastLoraWaitLogMs >= LORA_WAIT_LOG_INTERVAL_MS) {
    lastLoraWaitLogMs = millis();
    Serial.printf("[LORA] Cho theo poll, hien_tai=%s\n",
waitingForPollResponse ? activePollStation.c_str() : "chuan_bi_poll");
  }
}


// ============================================================
// SIMPLE LORA QoS1 RECEIVER
// ============================================================
// Receives only short newline-terminated packets, validates CRC16,
// ACKs immediately, and de-duplicates by station + sequence.

static String simpleRxLine;
static uint32_t lastSimpleSeq1 = 0xFFFFFFFFUL;
static uint32_t lastSimpleSeq2 = 0xFFFFFFFFUL;

uint16_t simpleCrc16(const String &text) {
  uint16_t crc = 0xFFFF;
  for (size_t i = 0; i < text.length(); ++i) {
    crc ^= static_cast<uint16_t>(static_cast<uint8_t>(text[i])) << 8;
    for (uint8_t bit = 0; bit < 8; ++bit) {
      crc = (crc & 0x8000) ? static_cast<uint16_t>((crc << 1) ^ 0x1021) : static_cast<uint16_t>(crc << 1);
    }
  }
  return crc;
}

String simpleField(const String &line, uint8_t index) {
  int start = 0;
  uint8_t current = 0;
  while (true) {
    const int end = line.indexOf('|', start);
    if (current == index) {
      return end < 0 ? line.substring(start) : line.substring(start, end);
    }
    if (end < 0) return "";
    start = end + 1;
    current += 1;
  }
}

String jsonNumberOrNullFromWire(const String &v) {
  if (v.length() == 0 || v == "x" || v == "X") return "null";
  return v;
}

bool wireValueMissing(const String &v) {
  return v.length() == 0 || v == "x" || v == "X";
}


String dashboardWireText(const String &value) {
  if (value.length() == 0 || value == "x" || value == "X") return "-";
  return value;
}

String dashboardJsonString(const String &value) {
  String out;
  out.reserve(value.length() + 8);
  for (size_t i = 0; i < value.length(); ++i) {
    const char c = value[i];
    if (c == '\\' || c == '"') {
      out += '\\';
      out += c;
    } else if (c == '\n') {
      out += "\\n";
    } else if (c == '\r') {
      out += "\\r";
    } else {
      out += c;
    }
  }
  return out;
}

void updateDashboardSnapshot(const String &line, bool station1, uint32_t seq) {
  const uint32_t now = millis();

  if (station1) {
    relayWaterDistanceValid = parseRelaySensorFloat(simpleField(line, 3), relayWaterDistanceCm);

    dashboardStation1.valid = true;
    dashboardStation1.sequence = seq;
    dashboardStation1.savedAtMs = now;
    dashboardStation1.lastSeenMs = now;
    dashboardStation1.summaryMinutes = dashboardWireText(simpleField(line, 2));
    dashboardStation1.distanceCm = dashboardWireText(simpleField(line, 3));
    dashboardStation1.waterLevelCm = dashboardWireText(simpleField(line, 4));
    dashboardStation1.ecMsCm = dashboardWireText(simpleField(line, 5));
    dashboardStation1.temperatureC = dashboardWireText(simpleField(line, 6));
    dashboardStation1.tdsPpm = dashboardWireText(simpleField(line, 7));
    dashboardStation1.salinityPpt = dashboardWireText(simpleField(line, 8));
    dashboardStation1.batteryVoltageV = dashboardWireText(simpleField(line, 9));
    dashboardStation1.batteryPercent = dashboardWireText(simpleField(line, 10));
  } else {
    relaySoilPhValid = parseRelaySensorFloat(simpleField(line, 10), relaySoilPh);

    dashboardStation2.valid = true;
    dashboardStation2.sequence = seq;
    dashboardStation2.savedAtMs = now;
    dashboardStation2.lastSeenMs = now;
    dashboardStation2.summaryMinutes = dashboardWireText(simpleField(line, 2));
    dashboardStation2.airTempC = dashboardWireText(simpleField(line, 3));
    dashboardStation2.airHumidityPct = dashboardWireText(simpleField(line, 4));
    dashboardStation2.soilTempC = dashboardWireText(simpleField(line, 5));
    dashboardStation2.soilMoisturePct = dashboardWireText(simpleField(line, 6));
    dashboardStation2.soilEcMsCm = dashboardWireText(simpleField(line, 7));
    dashboardStation2.soilSalinity = dashboardWireText(simpleField(line, 8));
    dashboardStation2.soilTds = dashboardWireText(simpleField(line, 9));
    dashboardStation2.soilPh = dashboardWireText(simpleField(line, 10));
    dashboardStation2.batteryVoltageV = dashboardWireText(simpleField(line, 11));
    dashboardStation2.batteryPercent = dashboardWireText(simpleField(line, 12));
  }

  // Evaluate the new physical limits to trigger relays immediately
  updateStatusOutputs();
}

void markDashboardStationSeen(bool station1) {
  if (station1) dashboardStation1.lastSeenMs = millis();
  else dashboardStation2.lastSeenMs = millis();
}

const char DASHBOARD_HTML[] PROGMEM = R"rawliteral(
<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>HORIZON Gateway</title>
  <style>
    :root{--bg:#071611;--panel:#0d2119;--panel2:#102b20;--line:#204a38;--text:#eef8f2;--muted:#90ad9f;--green:#5ee28f;--yellow:#ffd166;--blue:#6ecbff}
    *{box-sizing:border-box} body{margin:0;background:radial-gradient(circle at top,#123325 0,#071611 45%);color:var(--text);font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;min-height:100vh}
    .wrap{max-width:1120px;margin:auto;padding:28px 18px 48px}.top{display:flex;gap:16px;justify-content:space-between;align-items:flex-start;margin-bottom:22px;flex-wrap:wrap}
    h1{font-size:34px;margin:0 0 6px;letter-spacing:-.7px}.sub{color:var(--muted);font-size:14px}.brand{display:flex;align-items:center;gap:12px}.dot{width:13px;height:13px;border-radius:50%;background:var(--green);box-shadow:0 0 22px var(--green)}
    .gateway{display:flex;gap:10px;flex-wrap:wrap}.pill{border:1px solid var(--line);background:rgba(13,33,25,.75);padding:9px 12px;border-radius:999px;font-size:13px;color:#cde5d7}
    .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.card{background:linear-gradient(180deg,rgba(16,43,32,.95),rgba(9,27,20,.97));border:1px solid var(--line);border-radius:22px;padding:20px;box-shadow:0 18px 50px rgba(0,0,0,.22)}
    .cardhead{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:17px}.station{font-size:21px;font-weight:800}.desc{font-size:13px;color:var(--muted);margin-top:3px}.state{font-size:12px;padding:7px 10px;border-radius:999px;font-weight:750}.online{color:#b7ffd0;background:rgba(94,226,143,.13);border:1px solid rgba(94,226,143,.4)}.offline{color:#ffd7a3;background:rgba(255,209,102,.10);border:1px solid rgba(255,209,102,.35)}
.metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.metric{padding:13px;border-radius:15px;background:rgba(4,18,13,.55);border:1px solid rgba(32,74,56,.68);min-height:76px}.label{font-size:12px;color:var(--muted);margin-bottom:7px}.value{font-size:20px;font-weight:800;word-break:break-word}.unit{font-size:11px;color:#91b5a3;margin-left:4px;font-weight:600}
    .foot{margin-top:14px;padding-top:13px;border-top:1px solid rgba(32,74,56,.65);display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;color:var(--muted);font-size:12px}.empty{padding:42px 12px;text-align:center;color:var(--muted);border:1px dashed var(--line);border-radius:16px}
    @media(max-width:760px){.grid{grid-template-columns:1fr}h1{font-size:28px}.metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:430px){.metrics{grid-template-columns:1fr}}
  </style>
</head>
<body>
<div class="wrap">
  <div class="top">
    <div><div class="brand"><span class="dot"></span><h1>HORIZON Gateway</h1></div><div class="sub">Mạng lưới giám sát khí hậu do thanh niên dẫn dắt · dữ liệu LoRa gần nhất</div></div>
    <div class="gateway"><div class="pill">Wi‑Fi: <b>HORIZON</b></div><div class="pill">IP: <b>192.168.4.1</b></div><div class="pill" id="gw">Gateway</div></div>
  </div>
  <div class="grid">
    <section class="card"><div class="cardhead"><div><div class="station">STATION 01</div><div class="desc">Mực nước & chất lượng nước</div></div><div id="s1state" class="state offline">CHƯA CÓ DỮ LIỆU</div></div><div id="s1body" class="empty">Đang chờ gói hợp lệ từ trạm 1…</div><div id="s1foot" class="foot"></div></section>
    <section class="card"><div class="cardhead"><div><div class="station">STATION 02</div><div class="desc">Khí hậu & đất vùng bưởi</div></div><div id="s2state" class="state offline">CHƯA CÓ DỮ LIỆU</div></div><div id="s2body" class="empty">Đang chờ gói hợp lệ từ trạm 2…</div><div id="s2foot" class="foot"></div></section>
  </div>
</div>
<script>
const metric=(l,v,u='')=>`<div class="metric"><div class="label">${l}</div><div class="value">${v??'-'}${u?`<span class="unit">${u}</span>`:''}</div></div>`;
const age=t=>t===null?'chưa có':t<2?'vừa xong':t<60?`${t} giây trước`:`${Math.floor(t/60)} phút trước`;
function state(id,on){const e=document.getElementById(id);e.textContent=on?'ONLINE':'CHỜ DỮ LIỆU';e.className='state '+(on?'online':'offline')}
async function refresh(){try{const r=await fetch('/api/status',{cache:'no-store'});const d=await r.json();document.getElementById('gw').innerHTML=`Uptime: <b>${d.uptime_s}s</b> · Client: <b>${d.clients}</b>`;
const a=d.station1; state('s1state',a.online); if(a.valid){document.getElementById('s1body').className='metrics';document.getElementById('s1body').innerHTML=metric('Khoảng cách',a.distance_cm,'cm')+metric('Mực nước',a.water_level_cm,'cm')+metric('EC',a.ec_ms_cm,'mS/cm')+metric('Nhiệt độ nước',a.temperature_c,'°C')+metric('TDS',a.tds_ppm,'ppm')+metric('Độ mặn',a.salinity_ppt,'ppt')+metric('Điện áp pin',a.battery_voltage_v,'V')+metric('Pin',a.battery_percent,'%');document.getElementById('s1foot').innerHTML=`<span>Sequence <b>${a.sequence}</b></span><span>Nhận ${age(a.age_s)}</span>`}
 const b=d.station2; state('s2state',b.online); if(b.valid){document.getElementById('s2body').className='metrics';document.getElementById('s2body').innerHTML=metric('Nhiệt độ không khí',b.air_temp_c,'°C')+metric('Độ ẩm không khí',b.air_humidity_pct,'%')+metric('Nhiệt độ đất',b.soil_temp_c,'°C')+metric('Độ ẩm đất',b.soil_moisture_pct,'%')+metric('EC đất',b.soil_ec_ms_cm,'mS/cm')+metric('Độ mặn đất',b.soil_salinity,'')+metric('TDS đất',b.soil_tds,'')+metric('pH đất',b.soil_ph,'')+metric('Điện áp pin',b.battery_voltage_v,'V')+metric('Pin',b.battery_percent,'%');document.getElementById('s2foot').innerHTML=`<span>Sequence <b>${b.sequence}</b></span><span>Nhận ${age(b.age_s)}</span>`}
}catch(e){console.log(e)}}
refresh();setInterval(refresh,2500);
</script></body></html>
)rawliteral";

String dashboardStation1Json() {
  const uint32_t now = millis();
  const uint32_t ageMs = dashboardStation1.valid ? now - dashboardStation1.savedAtMs : 0;
  const uint32_t seenAgeMs = dashboardStation1.valid ? now - dashboardStation1.lastSeenMs : 0;
  const bool online = dashboardStation1.valid && seenAgeMs <= DASHBOARD_ONLINE_WINDOW_MS;
  String j;
  j.reserve(520);
  j += "{\"valid\":"; j += dashboardStation1.valid ? "true" : "false";
  j += ",\"online\":"; j += online ? "true" : "false";
  j += ",\"sequence\":"; j += String(dashboardStation1.sequence);
  j += ",\"age_s\":"; j += dashboardStation1.valid ? String(ageMs / 1000UL) : "null";
  j += ",\"summary_minutes\":\""; j += dashboardJsonString(dashboardStation1.summaryMinutes); j += "\"";
  j += ",\"distance_cm\":\""; j += dashboardJsonString(dashboardStation1.distanceCm); j += "\"";
  j += ",\"water_level_cm\":\""; j += dashboardJsonString(dashboardStation1.waterLevelCm); j += "\"";
  j += ",\"ec_ms_cm\":\""; j += dashboardJsonString(dashboardStation1.ecMsCm); j += "\"";
  j += ",\"temperature_c\":\""; j += dashboardJsonString(dashboardStation1.temperatureC); j += "\"";
  j += ",\"tds_ppm\":\""; j += dashboardJsonString(dashboardStation1.tdsPpm); j += "\"";
  j += ",\"salinity_ppt\":\""; j += dashboardJsonString(dashboardStation1.salinityPpt); j += "\"";
  j += ",\"battery_voltage_v\":\""; j += dashboardJsonString(dashboardStation1.batteryVoltageV); j += "\"";
  j += ",\"battery_percent\":\""; j += dashboardJsonString(dashboardStation1.batteryPercent); j += "\"}";
  return j;
}

String dashboardStation2Json() {
const uint32_t now = millis();
  const uint32_t ageMs = dashboardStation2.valid ? now - dashboardStation2.savedAtMs : 0;
  const uint32_t seenAgeMs = dashboardStation2.valid ? now - dashboardStation2.lastSeenMs : 0;
  const bool online = dashboardStation2.valid && seenAgeMs <= DASHBOARD_ONLINE_WINDOW_MS;
  String j;
  j.reserve(620);
  j += "{\"valid\":"; j += dashboardStation2.valid ? "true" : "false";
  j += ",\"online\":"; j += online ? "true" : "false";
  j += ",\"sequence\":"; j += String(dashboardStation2.sequence);
  j += ",\"age_s\":"; j += dashboardStation2.valid ? String(ageMs / 1000UL) : "null";
  j += ",\"summary_minutes\":\""; j += dashboardJsonString(dashboardStation2.summaryMinutes); j += "\"";
  j += ",\"air_temp_c\":\""; j += dashboardJsonString(dashboardStation2.airTempC); j += "\"";
  j += ",\"air_humidity_pct\":\""; j += dashboardJsonString(dashboardStation2.airHumidityPct); j += "\"";
  j += ",\"soil_temp_c\":\""; j += dashboardJsonString(dashboardStation2.soilTempC); j += "\"";
  j += ",\"soil_moisture_pct\":\""; j += dashboardJsonString(dashboardStation2.soilMoisturePct); j += "\"";
  j += ",\"soil_ec_ms_cm\":\""; j += dashboardJsonString(dashboardStation2.soilEcMsCm); j += "\"";
  j += ",\"soil_salinity\":\""; j += dashboardJsonString(dashboardStation2.soilSalinity); j += "\"";
  j += ",\"soil_tds\":\""; j += dashboardJsonString(dashboardStation2.soilTds); j += "\"";
  j += ",\"soil_ph\":\""; j += dashboardJsonString(dashboardStation2.soilPh); j += "\"";
  j += ",\"battery_voltage_v\":\""; j += dashboardJsonString(dashboardStation2.batteryVoltageV); j += "\"";
  j += ",\"battery_percent\":\""; j += dashboardJsonString(dashboardStation2.batteryPercent); j += "\"}";
  return j;
}

void handleDashboardRoot() {
  dashboardServer.send_P(200, "text/html; charset=utf-8", DASHBOARD_HTML);
}

void handleDashboardApi() {
  String json;
  json.reserve(1400);
  json += "{\"gateway_id\":\""; json += GATEWAY_ID; json += "\"";
  json += ",\"firmware_version\":\""; json += FIRMWARE_VERSION; json += "\"";
  json += ",\"uptime_s\":"; json += String(millis() / 1000UL);
  json += ",\"clients\":"; json += String(WiFi.softAPgetStationNum());
  json += ",\"station1\":"; json += dashboardStation1Json();
  json += ",\"station2\":"; json += dashboardStation2Json();
  json += "}";
  dashboardServer.sendHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  dashboardServer.send(200, "application/json; charset=utf-8", json);
}

void setupWifiDashboard() {
  WiFi.mode(WIFI_AP);
  WiFi.setSleep(false);
  WiFi.softAPConfig(WIFI_AP_IP, WIFI_AP_GATEWAY, WIFI_AP_SUBNET);

  if (WiFi.softAP(WIFI_AP_SSID, WIFI_AP_PASSWORD)) {
    Serial.printf("[WIFI] AP san sang SSID=%s IP=%s\n", WIFI_AP_SSID, WiFi.softAPIP().toString().c_str());
  } else {
    Serial.println("[WIFI] Khong tao duoc Access Point");
  }

  dashboardServer.on("/", HTTP_GET, handleDashboardRoot);
  dashboardServer.on("/api/status", HTTP_GET, handleDashboardApi);
dashboardServer.on("/favicon.ico", HTTP_GET, []() { dashboardServer.send(204); });
  dashboardServer.onNotFound([]() { dashboardServer.sendHeader("Location", "/", true); dashboardServer.send(302, "text/plain", ""); });
  dashboardServer.begin();
  Serial.println("[WEB] Dashboard: http://192.168.4.1");
}

String scaledWireNumber(const String &v, float scale, uint8_t decimals) {
  if (wireValueMissing(v)) return "null";
  return String(v.toFloat() * scale, static_cast<unsigned int>(decimals));
}

// A receipt timestamp must never be part of the idempotency key: the same
// staged frame can be posted again if the server committed it but the modem
// lost the response. Hashing the complete CRC-validated LoRa frame makes that
// retry stable while distinguishing a station reboot that reuses a sequence.
uint64_t simpleFrameFingerprint(const String &line) {
  uint64_t hash = 1469598103934665603ULL;  // FNV-1a 64-bit.
  for (size_t i = 0; i < line.length(); ++i) {
    hash ^= static_cast<uint8_t>(line[i]);
    hash *= 1099511628211ULL;
  }
  return hash;
}

String stableStationMessageId(bool station1, const String &line, uint32_t seq) {
  char messageId[64];
  const uint64_t fingerprint = simpleFrameFingerprint(line);
  snprintf(messageId, sizeof(messageId), "%s-%lu-%08lX%08lX",
           station1 ? "STATION_01" : "STATION_02",
           static_cast<unsigned long>(seq),
           static_cast<unsigned long>(fingerprint >> 32),
           static_cast<unsigned long>(fingerprint & 0xFFFFFFFFULL));
  return String(messageId);
}

void sendSimpleAck(bool station1, uint32_t seq) {
  String ack = station1 ? "A1|" : "A2|";
  ack += String(seq);

  // Give the remote transparent-LoRa module a short TX->RX turnaround,
  // then repeat the tiny ACK several times inside the station's 1.8 s ACK window.
  watchdogDelay(SIMPLE_ACK_START_DELAY_MS);
  for (uint8_t i = 0; i < SIMPLE_ACK_REPEAT_COUNT; ++i) {
    loraSerial.println(ack);
    loraSerial.flush();
    if (i + 1 < SIMPLE_ACK_REPEAT_COUNT) {
      watchdogDelay(SIMPLE_ACK_REPEAT_GAP_MS);
    }
  }

  Serial.printf("[ACK] %s x%u\n", ack.c_str(), SIMPLE_ACK_REPEAT_COUNT);
}

bool validateSimplePacket(const String &line, String &body) {
  const int lastSep = line.lastIndexOf('|');
  if (lastSep <= 0) return false;

  body = line.substring(0, lastSep);
  const String crcText = line.substring(lastSep + 1);
  if (crcText.length() != 4) return false;

  const uint16_t expected = static_cast<uint16_t>(strtoul(crcText.c_str(), nullptr, 16));
  return simpleCrc16(body) == expected;
}

String simplePacketToStationJson(const String &line, bool station1, uint32_t seq) {
  String json;
  json.reserve(650);
  const String messageId = stableStationMessageId(station1, line, seq);

  if (station1) {
    // S1|seq|min|distance|water|ec_ms|temp|tds|sal_ppt|bat_v|bat_pct|crc
    const String minCount = simpleField(line, 2);
    const String distance = simpleField(line, 3);
    const String water = simpleField(line, 4);
    const String ecMs = simpleField(line, 5);
    const String temp = simpleField(line, 6);
    const String tds = simpleField(line, 7);
    const String salPpt = simpleField(line, 8);
    const String batV = simpleField(line, 9);
    const String batP = simpleField(line, 10);

    const bool ecMissing = wireValueMissing(ecMs);
    const bool ultrasonicMissing = wireValueMissing(water);
    const uint8_t faultFlags = (ecMissing ? 0x01 : 0x00) | (ultrasonicMissing ? 0x02 : 0x00);

    json += "{\"contract_version\":\"v1\",\"reading_kind\":\"water\",\"device_id\":\"STATION_01\",\"firmware_version\":\"simple-qos1-wire\",\"message_id\":\"";
    json += messageId;
    json += "\",\"timestamp\":0,\"fault_flags\":"; json += String(faultFlags); json += ",\"sequence\":"; json += String(seq);
    json += ",\"summary_minutes\":"; json += jsonNumberOrNullFromWire(minCount);
    json += ",\"sensor_height_cm\":350.0";
    json += ",\"distance_cm\":"; json += jsonNumberOrNullFromWire(distance);
    json += ",\"water_level\":"; json += jsonNumberOrNullFromWire(water);
    json += ",\"ec_ms_cm\":"; json += jsonNumberOrNullFromWire(ecMs);
    json += ",\"ec_us_cm\":"; json += scaledWireNumber(ecMs, 1000.0f, 0);
    json += ",\"temperature_c\":"; json += jsonNumberOrNullFromWire(temp);
    json += ",\"tds_ppm\":"; json += jsonNumberOrNullFromWire(tds);
    json += ",\"salinity\":"; json += jsonNumberOrNullFromWire(salPpt);
    json += ",\"salinity_ppm\":"; json += scaledWireNumber(salPpt, 1000.0f, 0);
    json += ",\"battery_voltage\":"; json += jsonNumberOrNullFromWire(batV);
    json += ",\"battery_percent\":"; json += jsonNumberOrNullFromWire(batP);
    json += ",\"sensor_status\":{\"ec_probe\":\""; json += ecMissing ? "fault" : "ok";
    json += "\",\"ultrasonic\":\""; json += ultrasonicMissing ? "fault" : "ok";
    json += "\"},\"raw_station_payload\":{\"wire_protocol\":\"S1|...|CRC16\",\"gateway_id\":\""; json += GATEWAY_ID;
    json += "\",\"timestamp_semantics\":\"gateway_network_receipt_time\"}}";
  } else {
    // S2|seq|min|airT|airH|soilT|moist|ec_ms|sal|tds|ph|bat_v|bat_pct|crc
    const String minCount = simpleField(line, 2);
    const String airT = simpleField(line, 3);
    const String airH = simpleField(line, 4);
    const String soilT = simpleField(line, 5);
    const String moist = simpleField(line, 6);
    const String ecMs = simpleField(line, 7);
    const String sal = simpleField(line, 8);
    const String tds = simpleField(line, 9);
    const String ph = simpleField(line, 10);
    const String batV = simpleField(line, 11);
    const String batP = simpleField(line, 12);

    const uint8_t faultFlags =
      (wireValueMissing(airT) ? 0x01 : 0x00) |
      (wireValueMissing(airH) ? 0x02 : 0x00) |
      (wireValueMissing(soilT) ? 0x04 : 0x00) |
      (wireValueMissing(moist) ? 0x08 : 0x00) |
      (wireValueMissing(ecMs) ? 0x10 : 0x00) |
      (wireValueMissing(sal) ? 0x20 : 0x00) |
      (wireValueMissing(tds) ? 0x40 : 0x00) |
      (wireValueMissing(ph) ? 0x80 : 0x00);

    json += "{\"contract_version\":\"v1\",\"reading_kind\":\"soil\",\"device_id\":\"STATION_02\",\"firmware_version\":\"simple-qos1-wire\",\"message_id\":\"";
    json += messageId;
    json += "\",\"timestamp\":0,\"fault_flags\":"; json += String(faultFlags); json += ",\"sequence\":"; json += String(seq);
    json += ",\"summary_minutes\":"; json += jsonNumberOrNullFromWire(minCount);
    json += ",\"crop\":\"grapefruit\",\"soil\":{\"air_temp_c\":"; json += jsonNumberOrNullFromWire(airT);
    json += ",\"air_humidity_pct\":"; json += jsonNumberOrNullFromWire(airH);
    json += ",\"soil_temp_c\":"; json += jsonNumberOrNullFromWire(soilT);
    json += ",\"soil_moisture_pct\":"; json += jsonNumberOrNullFromWire(moist);
    json += ",\"soil_ec_ms_cm\":"; json += jsonNumberOrNullFromWire(ecMs);
    json += ",\"soil_ec_us_cm\":"; json += scaledWireNumber(ecMs, 1000.0f, 0);
    json += ",\"soil_salinity\":"; json += jsonNumberOrNullFromWire(sal);
    json += ",\"soil_tds\":"; json += jsonNumberOrNullFromWire(tds);
    json += ",\"soil_ph\":"; json += jsonNumberOrNullFromWire(ph);
    json += "},\"battery_voltage\":"; json += jsonNumberOrNullFromWire(batV);
    json += ",\"battery_percent\":"; json += jsonNumberOrNullFromWire(batP);
    json += ",\"raw_station_payload\":{\"wire_protocol\":\"S2|...|CRC16\",\"gateway_id\":\""; json += GATEWAY_ID;
    json += "\",\"timestamp_semantics\":\"gateway_network_receipt_time\"}}";
  }
  return json;
}

void stagePairedUpload(const String &payload, bool station1) {
  // Do not overwrite a payload that already belongs to an active batch. Newer
  // readings are still ACKed/displayed and will form the next batch after this one.
  if (pairedBatchTriggered) {
    Serial.printf("[BATCH] Dang gui cap hien tai -> %s moi se doi cap tiep theo\n",
                  station1 ? "S1" : "S2");
    return;
  }

  if (station1) {
    pendingUploadStation1 = payload;
    pendingStation1Ready = true;
  } else {
    pendingUploadStation2 = payload;
    pendingStation2Ready = true;
  }

  if (!pairedBatchTriggered && pairWaitStartedMs == 0) {
    pairWaitStartedMs = millis();
  }

  Serial.printf("[BATCH] da_co_S1=%s da_co_S2=%s\n",
                pendingStation1Ready ? "YES" : "NO",
                pendingStation2Ready ? "YES" : "NO");

  if (pendingStation1Ready && pendingStation2Ready) {
    pairedBatchTriggered = true;
    batchStation1Uploaded = false;
batchStation2Uploaded = false;
    lastBatchUploadAttemptMs = 0;
    Serial.println("[BATCH] DU S1 + S2 -> se bat 4G va upload 2 goi");
  }
}

void finishPairedBatchIfDone() {
  if (!pairedBatchTriggered) return;
  if (!batchStation1Uploaded || !batchStation2Uploaded) return;

  pendingUploadStation1 = "";
  pendingUploadStation2 = "";
  pendingStation1Ready = false;
  pendingStation2Ready = false;
  pairedBatchTriggered = false;
  pairWaitStartedMs = 0;
  batchStation1Uploaded = false;
  batchStation2Uploaded = false;
  completedBatchCount += 1;
  Serial.printf("[BATCH] HOAN TAT cap #%lu -> quay lai LoRa-only\n",
                static_cast<unsigned long>(completedBatchCount));
}

void servicePairedBatchUpload() {
  if (!MODEM_ENABLED || modemHttpBusy) return;

  if (!pairedBatchTriggered &&
      (pendingStation1Ready || pendingStation2Ready) &&
      pairWaitStartedMs != 0 &&
      millis() - pairWaitStartedMs >= PAIR_WAIT_TIMEOUT_MS) {
    pairedBatchTriggered = true;
    // Mark the absent station as already complete so the existing uploader
    // sends only the station that arrived instead of an empty payload.
    batchStation1Uploaded = !pendingStation1Ready;
    batchStation2Uploaded = !pendingStation2Ready;
    lastBatchUploadAttemptMs = 0;
    Serial.println("[BATCH] Het cua so doi cap -> upload tram dang co, khong cho vo han");
  }

  if (!pairedBatchTriggered) return;
  if (loraSerial.available() > 0) return;
  if (lastSimpleLoRaActivityMs != 0 && millis() - lastSimpleLoRaActivityMs < BATCH_LORA_SETTLE_MS) return;
  if (lastBatchUploadAttemptMs != 0 && millis() - lastBatchUploadAttemptMs < BATCH_UPLOAD_RETRY_MS) return;

  lastBatchUploadAttemptMs = millis();
  modemHttpBusy = true;

  Serial.println("[BATCH] ===== BAT 4G SAU KHI DA NHAN DU S1 + S2 =====");
  powerOnModem();
  lastModemInitAttemptMs = 0;  // this is an intentional fresh power-up
  modemReady = initModem();

  if (!modemReady) {
    Serial.println("[BATCH] Modem khoi tao that bai -> tat 4G, giu cap du lieu de thu lai");
    powerOffModem();
    modemHttpBusy = false;
    return;
  }

  if (!syncGatewayClock()) {
    Serial.println("[BATCH] Khong co gio UTC tu mang; giu goi de thu lai");
    powerOffModem();
    modemHttpBusy = false;
    return;
  }

  if (!batchStation1Uploaded) {
    Serial.println("[BATCH] Upload STATION_01...");
    const HttpPostOutcome outcome = httpPostJson(attachGatewayReceiptTimestamp(pendingUploadStation1));
    batchStation1Uploaded = outcome != HTTP_POST_RETRY;
    Serial.printf("[BATCH] S1 upload=%s\n", outcome == HTTP_POST_DELIVERED ? "ACCEPTED" : outcome == HTTP_POST_TERMINAL_REJECTION ? "REJECTED_TERMINAL" : "RETRY");
  }

  // Give LoRa parser a chance between the two HTTP transactions.
  readSimpleLoRaUart();

  if (!batchStation2Uploaded) {
    Serial.println("[BATCH] Upload STATION_02...");
    const HttpPostOutcome outcome = httpPostJson(attachGatewayReceiptTimestamp(pendingUploadStation2));
    batchStation2Uploaded = outcome != HTTP_POST_RETRY;
    Serial.printf("[BATCH] S2 upload=%s\n", outcome == HTTP_POST_DELIVERED ? "ACCEPTED" : outcome == HTTP_POST_TERMINAL_REJECTION ? "REJECTED_TERMINAL" : "RETRY");
  }

  Serial.println("[BATCH] Tat 4G sau phien upload");
  powerOffModem();
  modemHttpBusy = false;

  if (batchStation1Uploaded && batchStation2Uploaded) {
    finishPairedBatchIfDone();
    lastBatchUploadAttemptMs = 0;
  } else {
    Serial.printf("[BATCH] Con loi S1=%s S2=%s -> giu du lieu, thu lai sau %lus\n",
                  batchStation1Uploaded ? "OK" : "PENDING",
                  batchStation2Uploaded ? "OK" : "PENDING",
                  static_cast<unsigned long>(BATCH_UPLOAD_RETRY_MS / 1000UL));
  }
}

void handleSimpleLoRaLine(String line) {
  line.trim();
  if (line.length() < 8) return;

  const bool station1 = line.startsWith("S1|");
  const bool station2 = line.startsWith("S2|");
  if (!station1 && !station2) {
    Serial.printf("[LORA] Bo dong la: %s\n", line.c_str());
    return;
  }

  String body;
  if (!validateSimplePacket(line, body)) {
    Serial.printf("[LORA] CRC/khung loi, bo: %s\n", line.c_str());
    return;
  }
const uint32_t seq = static_cast<uint32_t>(simpleField(line, 1).toInt());
  loraLastGoodFrameMs = millis();
  loraGarbageBadWindows = 0;
  lastSimpleLoRaActivityMs = millis();
  sendSimpleAck(station1, seq);  // ACK before any HTTP work.
  markDashboardStationSeen(station1);

  uint32_t &lastSeq = station1 ? lastSimpleSeq1 : lastSimpleSeq2;
  if (lastSeq == seq) {
    Serial.printf("[LORA] Goi trung %s seq=%lu -> ACK lai, khong xu ly lai\n",
                  station1 ? "STATION_01" : "STATION_02",
                  static_cast<unsigned long>(seq));
    return;
  }
  lastSeq = seq;
  updateDashboardSnapshot(line, station1, seq);

  const String stationPayload = simplePacketToStationJson(line, station1, seq);
  Serial.println("============================================================");
  Serial.printf("[NHAN OK] %s seq=%lu wire_bytes=%u\n",
                station1 ? "STATION_01" : "STATION_02",
                static_cast<unsigned long>(seq),
                static_cast<unsigned int>(line.length()));
  Serial.println("[LORA] CRC valid; canonical telemetry staged without payload dump");

  if (MODEM_ENABLED) {
    stagePairedUpload(stationPayload, station1);
  } else {
    Serial.println("[HTTP] Modem dang tat, LoRa da ACK thanh cong");
  }
}

// Stream-recovery receiver.
// IMPORTANT: LoRa UART can occasionally contain garbage bytes before a valid frame.
// Never buffer the garbage as part of the packet. Search directly for S1| / S2|,
// then capture only printable ASCII until newline. CRC still decides validity.
static bool simpleCapturingFrame = false;
static String simpleMarkerProbe;
static uint32_t simpleGarbageBytes = 0;
static uint32_t simpleAbortedFrames = 0;
static uint32_t simpleRecoveredStarts = 0;
static uint32_t simpleFastCompletedFrames = 0;
static uint32_t simpleLastFrameByteMs = 0;
static uint8_t simplePipeCount = 0;
static uint8_t simpleExpectedPipeCount = 0;
static uint32_t simpleS1MarkerStarts = 0;
static uint32_t simpleS2MarkerStarts = 0;
static uint32_t simpleCrcRejectCount = 0;

bool simpleIsHex(char c) {
  return (c >= '0' && c <= '9') ||
         (c >= 'A' && c <= 'F') ||
         (c >= 'a' && c <= 'f');
}

void resetSimpleStreamCapture() {
  simpleRxLine = "";
  simpleMarkerProbe = "";
  simpleCapturingFrame = false;
  simpleLastFrameByteMs = 0;
  simplePipeCount = 0;
  simpleExpectedPipeCount = 0;
}

void startSimpleFrame(const String &marker) {
  simpleRxLine = marker;
  simpleMarkerProbe = "";
  simpleCapturingFrame = true;
  simpleLastFrameByteMs = millis();
  simplePipeCount = 1;  // marker S1| / S2| already contains one separator.
  simpleExpectedPipeCount = marker.startsWith("S1|") ? 11 : 13;
  if (marker.startsWith("S1|")) simpleS1MarkerStarts += 1;
  else simpleS2MarkerStarts += 1;
}

void searchSimpleFrameMarker(char c) {
  // State machine for exactly S1| or S2|. Everything else is garbage.
  if (simpleMarkerProbe.length() == 0) {
    if (c == 'S') {
      simpleMarkerProbe = "S";
    } else {
      simpleGarbageBytes += 1;
    }
    return;
  }
if (simpleMarkerProbe == "S") {
    if (c == '1' || c == '2') {
      simpleMarkerProbe += c;
    } else if (c == 'S') {
      simpleMarkerProbe = "S";
      simpleGarbageBytes += 1;
    } else {
      simpleMarkerProbe = "";
      simpleGarbageBytes += 2;
    }
    return;
  }

  if (simpleMarkerProbe == "S1" || simpleMarkerProbe == "S2") {
    if (c == '|') {
      startSimpleFrame(simpleMarkerProbe + "|");
    } else if (c == 'S') {
      simpleMarkerProbe = "S";
      simpleGarbageBytes += 2;
    } else {
      simpleMarkerProbe = "";
      simpleGarbageBytes += 3;
    }
  }
}

bool tryCompleteSimpleFrameNow() {
  if (!simpleCapturingFrame || simplePipeCount != simpleExpectedPipeCount) {
    return false;
  }

  const int lastSep = simpleRxLine.lastIndexOf('|');
  if (lastSep < 0) return false;

  const int crcChars = static_cast<int>(simpleRxLine.length()) - lastSep - 1;
  if (crcChars < 4) return false;

  // As soon as exactly four CRC hex characters arrive, validate immediately.
  // We do NOT wait for \r/\n, so garbage appended after a good radio packet
  // cannot destroy a frame that was already complete.
  if (crcChars == 4) {
    for (int i = lastSep + 1; i < static_cast<int>(simpleRxLine.length()); ++i) {
      if (!simpleIsHex(simpleRxLine[i])) {
        simpleAbortedFrames += 1;
        resetSimpleStreamCapture();
        return true;
      }
    }

    String body;
    if (validateSimplePacket(simpleRxLine, body)) {
      const String completed = simpleRxLine;
      simpleFastCompletedFrames += 1;
      resetSimpleStreamCapture();
      handleSimpleLoRaLine(completed);
      return true;
    }

    // Four CRC characters arrived but CRC is wrong: the frame is corrupted.
    // Drop it immediately so the next retry can be acquired cleanly.
    simpleCrcRejectCount += 1;
    simpleAbortedFrames += 1;
    resetSimpleStreamCapture();
    return true;
  }

  // More than four characters after the CRC separator means corruption.
  simpleAbortedFrames += 1;
  resetSimpleStreamCapture();
  return true;
}

void consumeSimpleLoRaByte(char c) {
  if (!simpleCapturingFrame) {
    if (c == '\r' || c == '\n') {
      simpleMarkerProbe = "";
      return;
    }
    searchSimpleFrameMarker(c);
    return;
  }

  simpleLastFrameByteMs = millis();

  if (c == '\r' || c == '\n') {
    // Normally the frame has already been completed by CRC before newline.
    // Keep this as a fallback for compatibility.
    if (c == '\n' && simpleRxLine.length() >= 8) {
      String body;
      if (validateSimplePacket(simpleRxLine, body)) {
        const String completed = simpleRxLine;
        resetSimpleStreamCapture();
        handleSimpleLoRaLine(completed);
        return;
      }
    }
    resetSimpleStreamCapture();
    return;
  }

  const uint8_t raw = static_cast<uint8_t>(c);
  if (raw < 32 || raw > 126) {
    simpleAbortedFrames += 1;
    resetSimpleStreamCapture();
    simpleGarbageBytes += 1;
    return;
  }

  simpleRxLine += c;
  if (c == '|') {
    simplePipeCount += 1;
if (simplePipeCount > simpleExpectedPipeCount) {
      simpleAbortedFrames += 1;
      resetSimpleStreamCapture();
      return;
    }
  }

  // If another clean marker appears inside a concatenated/damaged frame,
  // restart directly from the newest marker.
  if (simpleRxLine.length() > 3) {
    const int s1 = simpleRxLine.lastIndexOf("S1|");
    const int s2 = simpleRxLine.lastIndexOf("S2|");
    const int newest = s1 > s2 ? s1 : s2;
    if (newest > 0) {
      const String marker = simpleRxLine.substring(newest, newest + 3);
      const String tail = simpleRxLine.substring(newest + 3);
      simpleRecoveredStarts += 1;
      startSimpleFrame(marker);
      for (size_t i = 0; i < tail.length() && simpleCapturingFrame; ++i) {
        consumeSimpleLoRaByte(tail[i]);
      }
      return;
    }
  }

  if (simpleRxLine.length() > 180) {
    simpleAbortedFrames += 1;
    resetSimpleStreamCapture();
    return;
  }

  (void)tryCompleteSimpleFrameNow();
}

void restartLoRaUartFromGarbageStorm() {
  const uint32_t now = millis();
  if (loraLastUartRestartMs != 0 && now - loraLastUartRestartMs < LORA_UART_RESTART_COOLDOWN_MS) return;

  Serial.printf("[LORA RECOVERY] UART ngap rac -> restart UART1. AUX=%s lan=%lu\n",
                digitalRead(LORA_AUX_PIN) == HIGH ? "HIGH" : "LOW",
                static_cast<unsigned long>(loraUartRestartCount + 1));
  loraSerial.end();
  resetSimpleStreamCapture();
  pinMode(LORA_UART_RX_PIN, INPUT_PULLUP);
  pinMode(LORA_UART_TX_PIN, OUTPUT);
  digitalWrite(LORA_UART_TX_PIN, HIGH);
  watchdogDelay(250);

  pinMode(LORA_AUX_PIN, INPUT_PULLUP);
  loraSerial.setRxBufferSize(LORA_RX_BUFFER_BYTES);
  loraSerial.begin(LORA_UART_BAUD, SERIAL_8N1, LORA_UART_RX_PIN, LORA_UART_TX_PIN);
  gpio_pullup_en(static_cast<gpio_num_t>(LORA_UART_RX_PIN));
  gpio_pulldown_dis(static_cast<gpio_num_t>(LORA_UART_RX_PIN));
  watchdogDelay(120);
  while (loraSerial.available() > 0) (void)loraSerial.read();

  loraUartRestartCount += 1;
  loraLastUartRestartMs = millis();
  loraGarbageBadWindows = 0;
  loraHealthWindowStartedMs = millis();
  loraHealthPrevGarbageBytes = simpleGarbageBytes;
  loraHealthPrevGoodFrames = simpleFastCompletedFrames;
  Serial.printf("[LORA RECOVERY] UART1 san sang RX=%d TX=%d AUX=%s\n",
                LORA_UART_RX_PIN, LORA_UART_TX_PIN,
                digitalRead(LORA_AUX_PIN) == HIGH ? "HIGH" : "LOW");
}

void serviceLoRaRxHealth() {
  const uint32_t now = millis();
  if (loraHealthWindowStartedMs == 0) {
    loraHealthWindowStartedMs = now;
    loraHealthPrevGarbageBytes = simpleGarbageBytes;
    loraHealthPrevGoodFrames = simpleFastCompletedFrames;
    return;
  }
  if (now - loraHealthWindowStartedMs < LORA_RX_HEALTH_WINDOW_MS) return;

  const uint32_t garbageDelta = simpleGarbageBytes - loraHealthPrevGarbageBytes;
  const uint32_t goodDelta = simpleFastCompletedFrames - loraHealthPrevGoodFrames;
  const uint32_t noGoodFor = loraLastGoodFrameMs == 0 ? now : (now - loraLastGoodFrameMs);
const bool storm = garbageDelta >= LORA_GARBAGE_STORM_BYTES_PER_WINDOW &&
                     goodDelta == 0 && noGoodFor >= LORA_NO_GOOD_FRAME_BEFORE_RESTART_MS;
  if (storm) {
    if (loraGarbageBadWindows < 255) loraGarbageBadWindows += 1;
    Serial.printf("[LORA WARN] rac=%lu/%lus (~%lu B/s) AUX=%s bad=%u/%u\n",
                  static_cast<unsigned long>(garbageDelta),
                  static_cast<unsigned long>(LORA_RX_HEALTH_WINDOW_MS / 1000UL),
                  static_cast<unsigned long>((garbageDelta * 1000UL) / LORA_RX_HEALTH_WINDOW_MS),
                  digitalRead(LORA_AUX_PIN) == HIGH ? "HIGH" : "LOW",
                  loraGarbageBadWindows,
                  LORA_GARBAGE_BAD_WINDOWS_BEFORE_RESTART);
  } else {
    loraGarbageBadWindows = 0;
  }
  loraHealthWindowStartedMs = now;
  loraHealthPrevGarbageBytes = simpleGarbageBytes;
  loraHealthPrevGoodFrames = simpleFastCompletedFrames;
  if (loraGarbageBadWindows >= LORA_GARBAGE_BAD_WINDOWS_BEFORE_RESTART) restartLoRaUartFromGarbageStorm();
}

void readSimpleLoRaUart() {
  bool gotByte = false;
  if (simpleCapturingFrame && simpleLastFrameByteMs != 0 &&
      millis() - simpleLastFrameByteMs > SIMPLE_FRAME_IDLE_TIMEOUT_MS) {
    simpleAbortedFrames += 1;
    resetSimpleStreamCapture();
  }

  while (loraSerial.available() > 0) {
    serviceWatchdog();
    gotByte = true;
    loraPhysicalRxBytes += 1;
    lastSimpleLoRaActivityMs = millis();
    consumeSimpleLoRaByte(static_cast<char>(loraSerial.read()));
  }

  serviceLoRaRxHealth();
  if (!gotByte && millis() - lastLoraWaitLogMs >= LORA_WAIT_LOG_INTERVAL_MS) {
    lastLoraWaitLogMs = millis();
    Serial.printf("[LORA] rx=%lu rac=%lu hong=%lu crc_fail=%lu fast_ok=%lu markerS1=%lu markerS2=%lu AUX=%s restart=%lu S1=%s S2=%s batch=%s\n",
                  static_cast<unsigned long>(loraPhysicalRxBytes),
                  static_cast<unsigned long>(simpleGarbageBytes),
                  static_cast<unsigned long>(simpleAbortedFrames),
                  static_cast<unsigned long>(simpleCrcRejectCount),
                  static_cast<unsigned long>(simpleFastCompletedFrames),
                  static_cast<unsigned long>(simpleS1MarkerStarts),
                  static_cast<unsigned long>(simpleS2MarkerStarts),
                  digitalRead(LORA_AUX_PIN) == HIGH ? "HIGH" : "LOW",
                  static_cast<unsigned long>(loraUartRestartCount),
                  pendingStation1Ready ? "YES" : "NO",
                  pendingStation2Ready ? "YES" : "NO",
                  pairedBatchTriggered ? "READY" : "WAIT");
  }
}

void setup() {
  Serial.begin(DEBUG_BAUD);
  delay(300);

  setupWatchdog();
  setupStatusOutputs();
  // BO self-test relay luc boot: tranh xung dong/noise lam LoRa khoi dong sai.

  Serial.println();
  Serial.println("[HORIZON] Gateway dang khoi dong");
  Serial.printf("[HORIZON] Gateway: %s\n", GATEWAY_ID);
  Serial.printf("[STATUS] green=%d yellow=%d red=%d buzzer=%d active=%s\n",
                RELAY_GREEN_PIN,
                RELAY_YELLOW_PIN,
                RELAY_RED_PIN,
                BUZZER_RELAY_PIN,
                RELAY_ACTIVE_LOW ? "LOW" : "HIGH");
  Serial.printf("[STATUS] Nut tat coi IO%d, nhan xuong GND\n", BUZZER_MUTE_BUTTON_PIN);
loraSerial.setRxBufferSize(LORA_RX_BUFFER_BYTES);
  loraSerial.begin(LORA_UART_BAUD, SERIAL_8N1, LORA_UART_RX_PIN, LORA_UART_TX_PIN);
  gpio_pullup_en(static_cast<gpio_num_t>(LORA_UART_RX_PIN));
  gpio_pulldown_dis(static_cast<gpio_num_t>(LORA_UART_RX_PIN));
  Serial.printf("[LORA] RX=%d TX=%d baud=%lu rx_buffer=%u pullup_RX=BAT\n",
                LORA_UART_RX_PIN, LORA_UART_TX_PIN,
                static_cast<unsigned long>(LORA_UART_BAUD),
                static_cast<unsigned int>(LORA_RX_BUFFER_BYTES));
  Serial.printf("[DEBUG] lora_raw_uart=%s\n", DEBUG_LORA_RAW_UART ? "on" : "off");
  pinMode(LORA_AUX_PIN, INPUT_PULLUP);
  Serial.println("[LORA] RX PRIORITY: HTTP/403 FIX GIU NGUYEN, ACK ngan de nghe 2 tram");
  Serial.printf("[LORA] AUX IO%d=%s\n", LORA_AUX_PIN, digitalRead(LORA_AUX_PIN) == HIGH ? "HIGH" : "LOW");
  Serial.printf("[CONFIG] runtime_poll=%s (server hien dang tra 403)\n", CONFIG_POLL_ENABLED ? "BAT" : "TAT");

  Serial.println("[FLASH] Gateway khong dung SPIFFS/SD");

  setupWifiDashboard();

  if (MODEM_ENABLED) {
    // V11 policy: keep 4G physically off, but leave its UART pins untouched /
    // high-impedance so modem handling cannot disturb LoRa RX at boot.
    modemReady = false;
    activeModemBaud = 0;
    modemSerial.end();
    if (MODEM_PEN_PIN >= 0) {
      pinMode(MODEM_PEN_PIN, OUTPUT);
      digitalWrite(MODEM_PEN_PIN, LOW);
    }
    pinMode(MODEM_RX_PIN, INPUT);
    pinMode(MODEM_TX_PIN, INPUT);
    gpio_pullup_dis(static_cast<gpio_num_t>(MODEM_RX_PIN));
    gpio_pulldown_dis(static_cast<gpio_num_t>(MODEM_RX_PIN));
    gpio_pullup_dis(static_cast<gpio_num_t>(MODEM_TX_PIN));
    gpio_pulldown_dis(static_cast<gpio_num_t>(MODEM_TX_PIN));
    Serial.printf("[MODEM] CHO CAP S1+S2; PEN LOW, UART modem high-Z TX=%d RX=%d PEN=%d\n", MODEM_TX_PIN, MODEM_RX_PIN, MODEM_PEN_PIN);
  } else {
    Serial.println("[MODEM] MODEM_ENABLED=false");
  }
}

void loop() {
  serviceWatchdog();
  updateStatusOutputs();

  // LoRa has priority over the local web dashboard. Drain RX first,
  // service HTTP only while the UART is idle, then drain RX once more.
  readSimpleLoRaUart();
  if (loraSerial.available() == 0) {
    dashboardServer.handleClient();
  }
  readSimpleLoRaUart();

  // Only after one fresh packet from BOTH stations do we power 4G and upload.
  servicePairedBatchUpload();
  // Runtime CONFIG GET remains disabled while the endpoint returns 403.
  if (CONFIG_POLL_ENABLED) pollRuntimeConfigs();
  maybeEnterGatewaySleep();
  updateStatusOutputs();
  watchdogDelay(10);
}
