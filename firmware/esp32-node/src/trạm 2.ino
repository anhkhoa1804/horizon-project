#include <Arduino.h>
#include <Wire.h>
#include <SPI.h>
#include <esp_sleep.h>
#include <esp_task_wdt.h>
#include <driver/gpio.h>
#include <string.h>

/*
  HORIZON - Station 2, grapefruit soil node

  Hardware:
  - ES-SM-THEC-01 soil temperature / moisture / EC / salinity / TDS sensor, RS485 Modbus RTU.
  - ES-PH-SOIL-01 soil pH sensor, RS485 Modbus RTU.
  - SHT30 ambient temperature / humidity sensor, I2C.
  - CJMCU-226 / INA226 battery monitor, I2C.
  - SX1278 LoRa UART module, sends readings to the gateway.

  Proposed pins, kept close to Station 1:
  - INA226 I2C: SDA IO19, SCL IO20.
  - SHT30 I2C: SDA IO8, SCL IO9.
  - RS485 auto-direction module: ESP32 TX IO17 -> module RX/DI, ESP32 RX IO18 <- module TX/RO.
  - LoRa UART: ESP32 RX IO16 <- LoRa TX, ESP32 TX IO15 -> LoRa RX.

  RS485 soil bus:
  - Connect A with A and B with B for both soil sensors on the same RS485 bus.
  - ES-SM-THEC-01 slave ID = 2.
  - ES-PH-SOIL-01 slave ID = 1.
  - Baudrate = 4800, 8 data bits, 1 stop bit, no parity.

  Battery:
  - Station 2 uses 4S1P LiFePO4. Percent is estimated from 4S pack voltage.
*/

static const char *STATION_ID = "STATION_02";
static const char *FIRMWARE_VERSION = "station2-grapefruit-soil-0.6.7-simple-qos1-dual-rs485-sht30-io8-io9";

static const uint32_t DEBUG_BAUD = 115200;
static const uint32_t RS485_BAUD = 4800;
static const uint32_t LORA_UART_BAUD = 9600;
static const uint32_t I2C_CLOCK_HZ = 25000;

static const int INA226_SDA_PIN = 4;
static const int INA226_SCL_PIN = 5;
static const int SHT30_SDA_PIN = 47;
static const int SHT30_SCL_PIN = 48;
static const uint8_t SHT30_I2C_ADDRESS = 0x44;


static const int RS485_TX_PIN = 6;
static const int RS485_RX_PIN = 7;
static const int RS485_DE_RE_PIN = -1;  // Current module is assumed auto-direction like Station 1.

static const int LORA_UART_RX_PIN = 15;
static const int LORA_UART_TX_PIN = 16;
static const int LORA_M0_PIN = -1;   // Tie M0 to GND for normal transparent mode.
static const int LORA_M1_PIN = -1;   // Tie M1 to GND for normal transparent mode.
static const int LORA_AUX_PIN = -1;  // Recommended later: connect AUX to an input GPIO, e.g. IO10.

static const uint8_t INA226_ADDRESS = 0x40;
static const uint8_t LIFEPO4_CELL_COUNT = 4;

static const uint8_t SOIL_THEC_SLAVE_ID = 2;
static const uint8_t SOIL_PH_SLAVE_ID = 1;

static const uint16_t THEC_START_REG = 0x0000;
static const uint16_t THEC_REG_COUNT = 5;
static const uint16_t PH_START_REG = 0x0000;
static const uint16_t PH_REG_COUNT = 1;
static const uint16_t PH_DEVICE_ADDRESS_REG = 0x07D0;
static const uint32_t PH_BAUD_CANDIDATES[] = {2400, 4800, 9600};

static const uint8_t INA226_REG_CONFIG = 0x00;
static const uint8_t INA226_REG_BUS_VOLTAGE = 0x02;

static const bool LORA_TEST_FAST_SEND = false;
static const bool LORA_TEST_SHORT_PACKET = false;
static const bool DEBUG_DISABLE_LORA_UART = false;
static const uint8_t RAW_SAMPLES_PER_MINUTE = LORA_TEST_FAST_SEND ? 1 : 8;
static const uint8_t MIN_VALID_RAW_SAMPLES = LORA_TEST_FAST_SEND ? 1 : 3;
static const uint8_t MINUTE_RECORDS_PER_PACKET = 1;
static const uint32_t SAMPLE_INTERVAL_MS = LORA_TEST_FAST_SEND ? 5UL * 1000UL : 60UL * 1000UL;
static const uint32_t RAW_SAMPLE_GAP_MS = 450;
static const uint32_t RS485_INTER_REQUEST_GAP_MS = 500;
static const uint32_t SOIL_THEC_TIMEOUT_MS = 1500;
static const uint8_t SOIL_THEC_READ_RETRIES = 4;
static const uint32_t SOIL_THEC_RETRY_GAP_MS = 250;
static const uint32_t SOIL_PH_TIMEOUT_MS = 1500;
static const uint8_t SOIL_PH_READ_RETRIES = 4;
static const uint32_t SOIL_PH_RETRY_GAP_MS = 250;
// Controlled burst: one poll can produce several copies of the SAME message_id.
static const uint8_t LORA_TX_BURST_COUNT = 5;
static const uint32_t LORA_ACK_TIMEOUT_MS = 1700;
static const uint32_t LORA_REPLY_GUARD_MS = 700;
static const uint32_t LORA_TX_RETRY_GAP_MS = 220;
static const uint32_t DEFAULT_SLEEP_INTERVAL_MS = 60UL * 1000UL;
static const uint32_t WATCHDOG_TIMEOUT_MS = 60000;
static const bool DEBUG_RAW_SENSOR_SAMPLES = true;
static const uint8_t SHT30_READ_RETRIES = 3;
static const uint32_t SHT30_MEASUREMENT_DELAY_MS = 20;
static const bool DEBUG_PH_ADDRESS_SETUP_MODE = false;  // LUON false trong firmware chay binh thuong.
static const bool DEBUG_SKIP_PH_SENSOR = false;

HardwareSerial rs485Serial(2);
HardwareSerial loraSerial(1);
TwoWire sht30Wire = TwoWire(1);

struct SensorValue {
  bool ok;
  float value;
  const char *status;
};

struct Sht30Reading {
  SensorValue airTempC;
  SensorValue airHumidityPct;
};

struct SoilThecReading {
  SensorValue soilMoisturePct;
  SensorValue soilTempC;
  SensorValue soilEcUsCm;
  SensorValue soilSalinity;
  SensorValue soilTds;
};

struct BatteryReading {
  bool ok;
  float voltageV;
  float percent;
  const char *status;
};

struct MinuteReading {
  bool ambientOk;
  bool soilOk;
  bool phOk;
  bool batteryOk;
  float airTempC;
  float airHumidityPct;
  float soilTempC;
  float soilMoisturePct;
  float soilEcUsCm;
  float soilEcMsCm;
  float soilSalinity;
  float soilTds;
  float soilPh;
  float batteryVoltageV;
  float batteryPercent;
  uint8_t validAmbientSamples;
  uint8_t validSoilSamples;
  uint8_t validPhSamples;
  const char *ambientStatus;
  const char *soilStatus;
  const char *phStatus;
  const char *batteryStatus;
  const char *grapefruitAdvice;
};

struct AggregateReading {
  float airTempC;
  float airHumidityPct;
  float soilTempC;
  float soilMoisturePct;
  float soilEcUsCm;
  float soilEcMsCm;
  float soilSalinity;
  float soilTds;
  float soilPh;
  float batteryVoltageV;
  float batteryPercent;
  uint8_t minuteCount;
  const char *grapefruitAdvice;
};

RTC_DATA_ATTR static uint32_t sequenceNumber = 0;
RTC_DATA_ATTR static uint32_t pendingSequence = 0;
RTC_DATA_ATTR static uint8_t aggregateCount = 0;
RTC_DATA_ATTR static float aggregateAirTempC[MINUTE_RECORDS_PER_PACKET] = {};
RTC_DATA_ATTR static float aggregateAirHumidityPct[MINUTE_RECORDS_PER_PACKET] = {};
RTC_DATA_ATTR static float aggregateSoilTempC[MINUTE_RECORDS_PER_PACKET] = {};
RTC_DATA_ATTR static float aggregateSoilMoisturePct[MINUTE_RECORDS_PER_PACKET] = {};
RTC_DATA_ATTR static float aggregateSoilEcUsCm[MINUTE_RECORDS_PER_PACKET] = {};
RTC_DATA_ATTR static float aggregateSoilEcMsCm[MINUTE_RECORDS_PER_PACKET] = {};
RTC_DATA_ATTR static float aggregateSoilSalinity[MINUTE_RECORDS_PER_PACKET] = {};
RTC_DATA_ATTR static float aggregateSoilTds[MINUTE_RECORDS_PER_PACKET] = {};
RTC_DATA_ATTR static float aggregateSoilPh[MINUTE_RECORDS_PER_PACKET] = {};
RTC_DATA_ATTR static float aggregateBatteryVoltageV[MINUTE_RECORDS_PER_PACKET] = {};
RTC_DATA_ATTR static float aggregateBatteryPercent[MINUTE_RECORDS_PER_PACKET] = {};
static bool ina226Ready = false;
static bool sht30Ready = false;
static uint8_t activeSoilPhSlaveId = SOIL_PH_SLAVE_ID;
static uint32_t activeSoilPhBaud = RS485_BAUD;
static uint16_t lastSoilPhRaw = 0;
static bool lastSoilPhRawValid = false;
static uint32_t currentRs485Baud = 0;
static bool lastSoilThecRawOk = false;
static uint16_t lastSoilThecRegs[THEC_REG_COUNT] = {};
static uint32_t lastRs485TransactionMs = 0;
static uint32_t lastSampleMs = 0;
static uint32_t configuredSleepIntervalMs = DEFAULT_SLEEP_INTERVAL_MS;
static String loraCommandLine;
static bool gatewayPollPending = false;

String numberOrNull(float value, uint8_t decimals) {
  if (!isfinite(value)) {
    return "null";
  }
  return String(value, static_cast<unsigned int>(decimals));
}

const char *statusToVietnamese(const char *status) {
  if (strcmp(status, "ok") == 0) return "binh_thuong";
  if (strcmp(status, "disabled") == 0) return "tam_tat";
  if (strcmp(status, "timeout") == 0) return "qua_thoi_gian_cho";
  if (strcmp(status, "i2c_error") == 0) return "loi_i2c";
  if (strcmp(status, "sht30_timeout") == 0) return "sht30_khong_phan_hoi";
  if (strcmp(status, "sht30_crc_error") == 0) return "sht30_loi_crc";
  if (strcmp(status, "sht30_out_of_range") == 0) return "sht30_ngoai_khoang_do";
  if (strcmp(status, "checksum_error") == 0) return "loi_kiem_tra";
  if (strcmp(status, "modbus_error") == 0) return "loi_modbus";
  if (strcmp(status, "out_of_range") == 0) return "ngoai_khoang_do";
  if (strcmp(status, "ina226_not_ready") == 0) return "cam_bien_pin_chua_san_sang";
  if (strcmp(status, "bus_read_error") == 0) return "loi_doc_dien_ap";
  if (strcmp(status, "no_valid_sample") == 0) return "khong_co_mau_hop_le";
  return status;
}

void setRs485Transmit(bool enabled) {
  if (RS485_DE_RE_PIN < 0) {
    (void)enabled;
    delayMicroseconds(300);
    return;
  }
  digitalWrite(RS485_DE_RE_PIN, enabled ? HIGH : LOW);
  delayMicroseconds(300);
}

void setupWatchdog() {
  esp_task_wdt_config_t wdtConfig = {};
  wdtConfig.timeout_ms = WATCHDOG_TIMEOUT_MS;
  wdtConfig.idle_core_mask = (1 << portNUM_PROCESSORS) - 1;
  wdtConfig.trigger_panic = true;
  esp_task_wdt_init(&wdtConfig);
  esp_task_wdt_add(NULL);
}

void serviceWatchdog() {
  esp_task_wdt_reset();
}

void ensureRs485Baud(uint32_t baud) {
  if (currentRs485Baud == baud) {
    return;
  }

  rs485Serial.end();
  delay(20);
  rs485Serial.begin(baud, SERIAL_8N1, RS485_RX_PIN, RS485_TX_PIN);
  currentRs485Baud = baud;
  delay(20);
}

uint32_t extractUintField(const String &json, const char *field, uint32_t fallback) {
  String key = "\"";
  key += field;
  key += "\":";
  const int start = json.indexOf(key);
  if (start < 0) {
    return fallback;
  }

  const int valueStart = start + key.length();
  int valueEnd = valueStart;
  while (valueEnd < json.length() && isDigit(json[valueEnd])) {
    valueEnd += 1;
  }
  if (valueEnd == valueStart) {
    return fallback;
  }

  return static_cast<uint32_t>(json.substring(valueStart, valueEnd).toInt());
}

bool configTargetsThisStation(const String &json) {
  String stationKey = "\"station_id\":\"";
  stationKey += STATION_ID;
  stationKey += "\"";
  return json.indexOf("\"type\":\"config\"") >= 0 && json.indexOf(stationKey) >= 0;
}

bool pollTargetsThisStation(const String &json) {
  String stationKey = "\"station_id\":\"";
  stationKey += STATION_ID;
  stationKey += "\"";
  return json.indexOf("\"type\":\"poll\"") >= 0 && json.indexOf(stationKey) >= 0;
}

void applyConfigCommand(const String &json) {
  if (!configTargetsThisStation(json)) {
    return;
  }

  const uint32_t sleepSeconds = extractUintField(
    json,
    "sleep_interval_seconds",
    configuredSleepIntervalMs / 1000UL
  );
  configuredSleepIntervalMs = min<uint32_t>(86400UL, sleepSeconds) * 1000UL;
  Serial.printf("[CONFIG] ngu=%lu giay\n", configuredSleepIntervalMs / 1000UL);
}

void sendNoDataStatus() {
  String status;
  status.reserve(120);
  status += "{\"type\":\"station_status\",\"station_id\":\"";
  status += STATION_ID;
  status += "\",\"status\":\"no_data\",\"aggregate_count\":";
  status += String(aggregateCount);
  status += "}";

  delay(LORA_REPLY_GUARD_MS);
  loraSerial.println(status);
  loraSerial.flush();
  Serial.print("[POLL] Chua du du lieu, phan hoi gateway: ");
  Serial.println(status);
}

void handleGatewayCommand(const String &json) {
  if (configTargetsThisStation(json)) {
    applyConfigCommand(json);
    return;
  }

  if (!pollTargetsThisStation(json)) {
    return;
  }

  if (aggregateCount >= MINUTE_RECORDS_PER_PACKET) {
    gatewayPollPending = true;
    Serial.printf("[POLL] Gateway goi %s - du lieu san sang, cho phep TX\n", STATION_ID);
  } else {
    gatewayPollPending = false;
    sendNoDataStatus();
  }
}

void readLoRaCommands() {
  if (DEBUG_DISABLE_LORA_UART) {
    return;
  }

  while (loraSerial.available() > 0) {
    const char c = static_cast<char>(loraSerial.read());
    if (c == '\n') {
      loraCommandLine.trim();
      if (loraCommandLine.length() > 0) {
        handleGatewayCommand(loraCommandLine);
      }
      loraCommandLine = "";
    } else if (c != '\r') {
      loraCommandLine += c;
      if (loraCommandLine.length() > 420) {
        loraCommandLine = "";
      }
    }
  }
}

void maybeEnterConfiguredSleep() {
  if (configuredSleepIntervalMs == 0) {
    return;
  }

  Serial.printf("[NGUON] Ngu sau %lu giay\n", configuredSleepIntervalMs / 1000UL);
  Serial.flush();
  esp_sleep_enable_timer_wakeup(static_cast<uint64_t>(configuredSleepIntervalMs) * 1000ULL);
  esp_deep_sleep_start();
}

// ============================================================
// SHT30 AMBIENT SENSOR - I2C SDA IO8, SCL IO9
// ============================================================

uint8_t sht30Crc8(const uint8_t *data, size_t length) {
  uint8_t crc = 0xFF;
  for (size_t index = 0; index < length; index += 1) {
    crc ^= data[index];
    for (uint8_t bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x80) ? static_cast<uint8_t>((crc << 1) ^ 0x31) : static_cast<uint8_t>(crc << 1);
    }
  }
  return crc;
}

Sht30Reading readSht30() {
  const char *lastError = "sht30_timeout";

  for (uint8_t attempt = 1; attempt <= SHT30_READ_RETRIES; attempt += 1) {
    sht30Wire.beginTransmission(SHT30_I2C_ADDRESS);
    sht30Wire.write(0x24);
    sht30Wire.write(0x00);
    if (sht30Wire.endTransmission() != 0) {
      lastError = "i2c_error";
      delay(10);
      continue;
    }

    delay(SHT30_MEASUREMENT_DELAY_MS);
    if (sht30Wire.requestFrom(SHT30_I2C_ADDRESS, static_cast<uint8_t>(6)) != 6) {
      lastError = "sht30_timeout";
      delay(10);
      continue;
    }

    uint8_t raw[6] = {};
    for (uint8_t index = 0; index < 6; index += 1) {
      raw[index] = static_cast<uint8_t>(sht30Wire.read());
    }

    if (sht30Crc8(raw, 2) != raw[2] || sht30Crc8(raw + 3, 2) != raw[5]) {
      lastError = "sht30_crc_error";
      Serial.printf("[SHT30] Doc lan %u/%u loi CRC\n",
                    static_cast<unsigned int>(attempt),
                    static_cast<unsigned int>(SHT30_READ_RETRIES));
      continue;
    }

    const uint16_t rawTemperature = (static_cast<uint16_t>(raw[0]) << 8) | raw[1];
    const uint16_t rawHumidity = (static_cast<uint16_t>(raw[3]) << 8) | raw[4];
    const float temperatureC = -45.0f + 175.0f * rawTemperature / 65535.0f;
    const float humidityPct = 100.0f * rawHumidity / 65535.0f;

    if (!isfinite(temperatureC) || !isfinite(humidityPct) ||
        temperatureC < -40.0f || temperatureC > 125.0f ||
        humidityPct < 0.0f || humidityPct > 100.0f) {
      lastError = "sht30_out_of_range";
      continue;
    }

    sht30Ready = true;
    Serial.printf("[SHT30] OK T=%.1f C H=%.1f %% SDA=IO%d SCL=IO%d\n",
                  temperatureC, humidityPct, SHT30_SDA_PIN, SHT30_SCL_PIN);
    return {
      {true, temperatureC, "ok"},
      {true, humidityPct, "ok"},
    };
  }

  sht30Ready = false;
  return {
    {false, NAN, lastError},
    {false, NAN, lastError},
  };
}

uint16_t crc16Modbus(const uint8_t *data, size_t len) {
  uint16_t crc = 0xFFFF;
  for (size_t i = 0; i < len; i += 1) {
    crc ^= data[i];
    for (uint8_t bit = 0; bit < 8; bit += 1) {
      if (crc & 0x0001) {
        crc = static_cast<uint16_t>((crc >> 1) ^ 0xA001);
      } else {
        crc >>= 1;
      }
    }
  }
  return crc;
}

void waitForRs485IdleGap() {
  while (lastRs485TransactionMs != 0 && millis() - lastRs485TransactionMs < RS485_INTER_REQUEST_GAP_MS) {
    serviceWatchdog();
    delay(2);
  }
}

bool readHoldingRegisters(uint8_t slaveId, uint16_t startReg, uint16_t regCount, uint16_t *outRegs, uint32_t timeoutMs = 800) {
  if (regCount == 0 || regCount > 10) {
    return false;
  }

  waitForRs485IdleGap();

  while (rs485Serial.available() > 0) {
    rs485Serial.read();
  }

  uint8_t request[8] = {
    slaveId,
    0x03,
    highByte(startReg),
    lowByte(startReg),
    highByte(regCount),
    lowByte(regCount),
    0,
    0,
  };
  const uint16_t requestCrc = crc16Modbus(request, 6);
  request[6] = lowByte(requestCrc);
  request[7] = highByte(requestCrc);

  setRs485Transmit(true);
  rs485Serial.write(request, sizeof(request));
  rs485Serial.flush();
  setRs485Transmit(false);
  serviceWatchdog();

  const uint8_t expectedLen = static_cast<uint8_t>(5 + regCount * 2);
  uint8_t response[32] = {};
  uint8_t count = 0;
  const uint32_t startedAt = millis();

  while (millis() - startedAt < timeoutMs && count < expectedLen) {
    serviceWatchdog();

    if (rs485Serial.available() > 0) {
      response[count++] = static_cast<uint8_t>(rs485Serial.read());
    } else {
      delay(2);
    }
  }

  if (count != expectedLen) {
    return false;
  }

  const uint16_t receivedCrc = static_cast<uint16_t>(response[count - 2]) | (static_cast<uint16_t>(response[count - 1]) << 8);
  const uint16_t expectedCrc = crc16Modbus(response, count - 2);
  if (receivedCrc != expectedCrc) {
    return false;
  }

  if (response[0] != slaveId || response[1] != 0x03 || response[2] != regCount * 2) {
    return false;
  }

  for (uint16_t i = 0; i < regCount; i += 1) {
    const uint8_t offset = static_cast<uint8_t>(3 + i * 2);
    outRegs[i] = (static_cast<uint16_t>(response[offset]) << 8) | response[offset + 1];
  }

  lastRs485TransactionMs = millis();
  return true;
}

bool writeSingleRegister(uint8_t slaveId, uint16_t reg, uint16_t value, uint32_t timeoutMs = 800) {
  waitForRs485IdleGap();

  while (rs485Serial.available() > 0) {
    rs485Serial.read();
  }

  uint8_t request[8] = {
    slaveId,
    0x06,
    highByte(reg),
    lowByte(reg),
    highByte(value),
    lowByte(value),
    0,
    0,
  };
  const uint16_t requestCrc = crc16Modbus(request, 6);
  request[6] = lowByte(requestCrc);
  request[7] = highByte(requestCrc);

  setRs485Transmit(true);
  rs485Serial.write(request, sizeof(request));
  rs485Serial.flush();
  setRs485Transmit(false);
  serviceWatchdog();

  uint8_t response[8] = {};
  uint8_t count = 0;
  const uint32_t startedAt = millis();

  while (millis() - startedAt < timeoutMs && count < sizeof(response)) {
    serviceWatchdog();

    if (rs485Serial.available() > 0) {
      response[count++] = static_cast<uint8_t>(rs485Serial.read());
    } else {
      delay(2);
    }
  }

  if (count != sizeof(response)) {
    return false;
  }

  const uint16_t receivedCrc = static_cast<uint16_t>(response[6]) | (static_cast<uint16_t>(response[7]) << 8);
  const uint16_t expectedCrc = crc16Modbus(response, 6);
  if (receivedCrc != expectedCrc) {
    return false;
  }

  for (uint8_t i = 0; i < sizeof(request); i += 1) {
    if (response[i] != request[i]) {
      return false;
    }
  }

  lastRs485TransactionMs = millis();
  return true;
}

SoilThecReading readSoilThec() {
  ensureRs485Baud(RS485_BAUD);

  uint16_t regs[THEC_REG_COUNT] = {};
  bool readOk = false;

  for (uint8_t attempt = 1; attempt <= SOIL_THEC_READ_RETRIES; ++attempt) {
    for (uint8_t i = 0; i < THEC_REG_COUNT; ++i) regs[i] = 0;

    if (readHoldingRegisters(SOIL_THEC_SLAVE_ID, THEC_START_REG, THEC_REG_COUNT, regs, SOIL_THEC_TIMEOUT_MS)) {
      readOk = true;
      break;
    }

    if (attempt < SOIL_THEC_READ_RETRIES) {
      Serial.printf("[THEC] Doc Modbus lan %u/%u that bai, thu lai...\n",
                    static_cast<unsigned int>(attempt),
                    static_cast<unsigned int>(SOIL_THEC_READ_RETRIES));
      delay(SOIL_THEC_RETRY_GAP_MS);
    }
  }

  if (!readOk) {
    lastSoilThecRawOk = false;
    return {
      {false, NAN, "modbus_error"},
      {false, NAN, "modbus_error"},
      {false, NAN, "modbus_error"},
      {false, NAN, "modbus_error"},
      {false, NAN, "modbus_error"},
    };
  }

  lastSoilThecRawOk = true;
  for (uint8_t i = 0; i < THEC_REG_COUNT; i += 1) {
    lastSoilThecRegs[i] = regs[i];
  }

  Serial.printf("[THEC RAW] 0000=%u 0001=%u 0002=%u 0003=%u 0004=%u\n",
                regs[0], regs[1], regs[2], regs[3], regs[4]);

  if (regs[0] > 0 && regs[1] == 0 && regs[2] == 0 && regs[3] == 0 && regs[4] == 0) {
    Serial.println("[THEC] CANH BAO: Modbus OK nhung chi do_am co gia_tri; temp/EC/salinity/TDS deu RAW=0");
  }

  const float moisturePct = regs[0] / 10.0f;
  const int16_t rawTemp = static_cast<int16_t>(regs[1]);
  const float tempC = rawTemp / 10.0f;
  const float ecUsCm = static_cast<float>(regs[2]);
  const float salinity = static_cast<float>(regs[3]);
  const float tds = static_cast<float>(regs[4]);

  return {
    {true, moisturePct, "ok"},
    {true, tempC, "ok"},
    {true, ecUsCm, "ok"},
    {true, salinity, "ok"},
    {true, tds, "ok"},
  };
}

SensorValue readSoilPh() {
  ensureRs485Baud(activeSoilPhBaud);

  uint16_t regs[PH_REG_COUNT] = {};
  for (uint8_t attempt = 1; attempt <= SOIL_PH_READ_RETRIES; attempt += 1) {
    if (readHoldingRegisters(activeSoilPhSlaveId, PH_START_REG, PH_REG_COUNT, regs, SOIL_PH_TIMEOUT_MS)) {
      lastSoilPhRaw = regs[0];
      lastSoilPhRawValid = true;
      Serial.printf("[PH RAW] ID=%u baud=%lu 0000=%u -> pH=%.1f (lan %u/%u)\n",
                    activeSoilPhSlaveId,
                    static_cast<unsigned long>(activeSoilPhBaud),
                    regs[0],
                    regs[0] / 10.0f,
                    attempt,
                    static_cast<unsigned int>(SOIL_PH_READ_RETRIES));

      const float ph = regs[0] / 10.0f;
      if (ph < 0.0f || ph > 14.0f) {
        return {false, ph, "out_of_range"};
      }
      return {true, ph, "ok"};
    }
    if (attempt < SOIL_PH_READ_RETRIES) delay(SOIL_PH_RETRY_GAP_MS);
  }

  lastSoilPhRawValid = false;
  Serial.printf("[PH RAW] ID=%u baud=%lu KHONG_PHAN_HOI sau %u lan\n",
                activeSoilPhSlaveId,
                static_cast<unsigned long>(activeSoilPhBaud),
                static_cast<unsigned int>(SOIL_PH_READ_RETRIES));
  return {false, NAN, "modbus_error"};
}

bool diagnosePhAddressRegister() {
  ensureRs485Baud(activeSoilPhBaud);
  uint16_t addrReg[1] = {};
  if (!readHoldingRegisters(activeSoilPhSlaveId, PH_DEVICE_ADDRESS_REG, 1, addrReg, 900)) {
    Serial.printf("[PH DIAG] ID=%u khong doc duoc thanh ghi 07D0H - co the sai ID/baud hoac khong phai module pH\n", activeSoilPhSlaveId);
    return false;
  }
  Serial.printf("[PH DIAG] ID dang doc=%u | thanh ghi 07D0H tra ve=%u\n", activeSoilPhSlaveId, addrReg[0]);
  return addrReg[0] == activeSoilPhSlaveId;
}

void setupPhAddressIfRequested() {
  if (!DEBUG_PH_ADDRESS_SETUP_MODE || DEBUG_SKIP_PH_SENSOR) {
    return;
  }

  Serial.println("[PH SETUP] Dang cai dia chi pH - chi noi rieng cam bien pH vao RS485");

  for (uint8_t baudIndex = 0; baudIndex < sizeof(PH_BAUD_CANDIDATES) / sizeof(PH_BAUD_CANDIDATES[0]); baudIndex += 1) {
    const uint32_t baud = PH_BAUD_CANDIDATES[baudIndex];
    ensureRs485Baud(baud);

    uint16_t regs[PH_REG_COUNT] = {};
    if (!readHoldingRegisters(1, PH_START_REG, PH_REG_COUNT, regs, 800)) {
      Serial.printf("[PH SETUP] baud=%lu dia_chi_mac_dinh=1 khong_phan_hoi\n", static_cast<unsigned long>(baud));
      continue;
    }

    Serial.printf("[PH SETUP] baud=%lu dia_chi_mac_dinh=1 raw=%u ph=%.1f\n",
                  static_cast<unsigned long>(baud),
                  regs[0],
                  regs[0] / 10.0f);

    if (!writeSingleRegister(1, PH_DEVICE_ADDRESS_REG, SOIL_PH_SLAVE_ID, 800)) {
      Serial.println("[PH SETUP] Ghi dia chi moi that bai");
      return;
    }

    delay(300);

    if (!readHoldingRegisters(SOIL_PH_SLAVE_ID, PH_START_REG, PH_REG_COUNT, regs, 800)) {
      Serial.println("[PH SETUP] Da ghi dia chi nhung dia chi moi khong phan hoi");
      return;
    }

    activeSoilPhSlaveId = SOIL_PH_SLAVE_ID;
    activeSoilPhBaud = baud;
    Serial.printf("[PH SETUP] Da doi dia chi pH sang %u baud=%lu raw=%u ph=%.1f\n",
                  activeSoilPhSlaveId,
                  static_cast<unsigned long>(activeSoilPhBaud),
                  regs[0],
                  regs[0] / 10.0f);
    return;
  }

  Serial.println("[PH SETUP] Khong tim thay dia chi mac dinh=1 tai 2400/4800/9600");
}

bool ina226ReadRegister(uint8_t reg, uint16_t &value) {
  Wire.beginTransmission(INA226_ADDRESS);
  Wire.write(reg);
  if (Wire.endTransmission(false) != 0) {
    return false;
  }

  if (Wire.requestFrom(static_cast<int>(INA226_ADDRESS), 2) != 2) {
    return false;
  }

  value = (static_cast<uint16_t>(Wire.read()) << 8) | static_cast<uint16_t>(Wire.read());
  return true;
}

bool ina226WriteRegister(uint8_t reg, uint16_t value) {
  Wire.beginTransmission(INA226_ADDRESS);
  Wire.write(reg);
  Wire.write(static_cast<uint8_t>(value >> 8));
  Wire.write(static_cast<uint8_t>(value & 0xFF));
  return Wire.endTransmission() == 0;
}

bool setupIna226() {
  uint16_t config = 0;
  if (!ina226ReadRegister(INA226_REG_CONFIG, config)) {
    return false;
  }

  return ina226WriteRegister(INA226_REG_CONFIG, 0x4527);
}

float estimateLifePo4Percent(float packVoltage) {
  if (!isfinite(packVoltage) || LIFEPO4_CELL_COUNT == 0) {
    return NAN;
  }

  const float cellVoltage = packVoltage / LIFEPO4_CELL_COUNT;
  const float pointsV[] = {2.80f, 3.00f, 3.10f, 3.20f, 3.25f, 3.30f, 3.35f, 3.40f, 3.50f, 3.60f};
  const float pointsPct[] = {0.0f, 5.0f, 10.0f, 20.0f, 40.0f, 60.0f, 80.0f, 90.0f, 98.0f, 100.0f};
  const uint8_t pointCount = sizeof(pointsV) / sizeof(pointsV[0]);

  if (cellVoltage <= pointsV[0]) {
    return 0.0f;
  }
  if (cellVoltage >= pointsV[pointCount - 1]) {
    return 100.0f;
  }

  for (uint8_t i = 1; i < pointCount; i += 1) {
    if (cellVoltage <= pointsV[i]) {
      const float spanV = pointsV[i] - pointsV[i - 1];
      const float ratio = spanV > 0 ? (cellVoltage - pointsV[i - 1]) / spanV : 0.0f;
      return pointsPct[i - 1] + ratio * (pointsPct[i] - pointsPct[i - 1]);
    }
  }

  return NAN;
}

BatteryReading readBattery() {
  if (!ina226Ready) {
    return {false, NAN, NAN, "ina226_not_ready"};
  }

  uint16_t rawBus = 0;
  if (!ina226ReadRegister(INA226_REG_BUS_VOLTAGE, rawBus)) {
    return {false, NAN, NAN, "bus_read_error"};
  }

  const float voltageV = rawBus * 0.00125f;
  const float percent = estimateLifePo4Percent(voltageV);
  return {true, voltageV, percent, "ok"};
}

float ecUsCmToMsCm(float ecUsCm) {
  if (!isfinite(ecUsCm)) {
    return NAN;
  }
  return ecUsCm / 1000.0f;
}

const char *buildGrapefruitAdvice(float moisturePct, float ecMsCm, float ph) {
  if (isfinite(moisturePct) && moisturePct > 80.0f) {
    return "soil_too_wet_stop_pump_check_root_rot_risk";
  }
  if (isfinite(moisturePct) && moisturePct < 35.0f) {
    return "soil_too_dry_consider_irrigation";
  }
  if (isfinite(ecMsCm) && ecMsCm >= 2.0f) {
    return "soil_ec_high_reduce_fertilizer_flush_salt";
  }
  if (isfinite(ecMsCm) && ecMsCm >= 1.5f) {
    return "soil_ec_warning_monitor_before_fertilizing";
  }
  if (isfinite(ph) && ph < 5.0f) {
    return "soil_too_acidic_check_lime_and_nutrient_plan";
  }
  if (isfinite(ph) && ph > 7.0f) {
    return "soil_too_alkaline_watch_micronutrient_deficiency";
  }
  if (isfinite(ph) && (ph < 5.5f || ph > 6.5f)) {
    return "soil_ph_near_edge_monitor_grapefruit_root_zone";
  }
  return "soil_conditions_suitable_continue_monitoring";
}

float filteredAverage(float *values, uint8_t count) {
  if (count == 0) {
    return NAN;
  }
  if (count < 4) {
    float sum = 0.0f;
    for (uint8_t i = 0; i < count; i += 1) {
      sum += values[i];
    }
    return sum / count;
  }

  float minValue = values[0];
  float maxValue = values[0];
  float sum = 0.0f;
  for (uint8_t i = 0; i < count; i += 1) {
    minValue = min(minValue, values[i]);
    maxValue = max(maxValue, values[i]);
    sum += values[i];
  }

  return (sum - minValue - maxValue) / (count - 2);
}

float averageFinite(const float *values, uint8_t count) {
  float sum = 0.0f;
  uint8_t valid = 0;
  for (uint8_t i = 0; i < count; i += 1) {
    if (isfinite(values[i])) {
      sum += values[i];
      valid += 1;
    }
  }
  return valid > 0 ? sum / valid : NAN;
}

MinuteReading collectMinuteReading() {
  float airTempC[RAW_SAMPLES_PER_MINUTE] = {};
  float airHumidityPct[RAW_SAMPLES_PER_MINUTE] = {};
  float soilTempC[RAW_SAMPLES_PER_MINUTE] = {};
  float soilMoisturePct[RAW_SAMPLES_PER_MINUTE] = {};
  float soilEcUsCm[RAW_SAMPLES_PER_MINUTE] = {};
  float soilEcMsCm[RAW_SAMPLES_PER_MINUTE] = {};
  float soilSalinity[RAW_SAMPLES_PER_MINUTE] = {};
  float soilTds[RAW_SAMPLES_PER_MINUTE] = {};
  float soilPh[RAW_SAMPLES_PER_MINUTE] = {};

  uint8_t ambientCount = 0;
  uint8_t soilCount = 0;
  uint8_t phCount = 0;
  const char *ambientStatus = "no_valid_sample";
  const char *soilStatus = "no_valid_sample";
  const char *phStatus = "no_valid_sample";

  for (uint8_t i = 0; i < RAW_SAMPLES_PER_MINUTE; i += 1) {
    serviceWatchdog();

    const Sht30Reading ambient = readSht30();
    if (ambient.airTempC.ok && ambient.airHumidityPct.ok) {
      airTempC[ambientCount] = ambient.airTempC.value;
      airHumidityPct[ambientCount] = ambient.airHumidityPct.value;
      ambientCount += 1;
    }
    ambientStatus = ambient.airTempC.ok ? ambient.airHumidityPct.status : ambient.airTempC.status;

    const SoilThecReading soil = readSoilThec();
    if (soil.soilMoisturePct.ok && soil.soilTempC.ok && soil.soilEcUsCm.ok) {
      soilTempC[soilCount] = soil.soilTempC.value;
      soilMoisturePct[soilCount] = soil.soilMoisturePct.value;
      soilEcUsCm[soilCount] = soil.soilEcUsCm.value;
      soilEcMsCm[soilCount] = ecUsCmToMsCm(soil.soilEcUsCm.value);
      soilSalinity[soilCount] = soil.soilSalinity.value;
      soilTds[soilCount] = soil.soilTds.value;
      soilCount += 1;
    }
    soilStatus = soil.soilEcUsCm.status;

    SensorValue ph = {false, NAN, "disabled"};
    if (!DEBUG_SKIP_PH_SENSOR) {
      ph = readSoilPh();
    }

    if (ph.ok) {
      soilPh[phCount++] = ph.value;
    }
    phStatus = ph.status;

    if (DEBUG_RAW_SENSOR_SAMPLES) {
      Serial.printf("[MAU THO %u/%u]\n",
                    static_cast<unsigned int>(i + 1),
                    static_cast<unsigned int>(RAW_SAMPLES_PER_MINUTE));

      Serial.print("  Khong khi: ");
      Serial.print(ambient.airTempC.ok && ambient.airHumidityPct.ok ? "binh_thuong" : statusToVietnamese(ambientStatus));
      if (ambient.airTempC.ok && ambient.airHumidityPct.ok) {
        Serial.printf(" | Nhiet do khong khi: %.1f C | Do am khong khi: %.1f %%",
                      ambient.airTempC.value,
                      ambient.airHumidityPct.value);
      }
      Serial.println();

      Serial.print("  Cam bien dat: ");
      Serial.print(soil.soilMoisturePct.ok && soil.soilTempC.ok && soil.soilEcUsCm.ok ? "binh_thuong" : statusToVietnamese(soilStatus));
      if (soil.soilMoisturePct.ok && soil.soilTempC.ok && soil.soilEcUsCm.ok) {
        Serial.printf(" | Do am dat: %.1f %% | Nhiet do dat: %.1f C | EC dat: %.0f uS/cm (%.3f mS/cm) | Do man dat: %.0f | TDS dat: %.0f",
                      soil.soilMoisturePct.value,
                      soil.soilTempC.value,
                      soil.soilEcUsCm.value,
                      ecUsCmToMsCm(soil.soilEcUsCm.value),
                      soil.soilSalinity.value,
                      soil.soilTds.value);
      }
      Serial.println();

      Serial.print("  Du lieu tho cam bien dat:");
      if (lastSoilThecRawOk) {
        for (uint8_t regIndex = 0; regIndex < THEC_REG_COUNT; regIndex += 1) {
          Serial.printf(" %04X=%u",
                        THEC_START_REG + regIndex,
                        lastSoilThecRegs[regIndex]);
        }
      } else {
        Serial.print(" loi_modbus");
      }
      Serial.println();

      Serial.print("  pH dat: ");
      if (ph.ok) {
        Serial.printf("%.1f", ph.value);
      } else {
        Serial.printf("%s | Dang doc Modbus ID: %u | Baud: %lu",
                      statusToVietnamese(ph.status),
                      activeSoilPhSlaveId,
                      static_cast<unsigned long>(activeSoilPhBaud));
      }

      Serial.println();
    }

    delay(RAW_SAMPLE_GAP_MS);
  }

  const bool ambientOk = ambientCount >= MIN_VALID_RAW_SAMPLES;
  const bool soilOk = soilCount >= MIN_VALID_RAW_SAMPLES;
  const bool phOk = phCount >= MIN_VALID_RAW_SAMPLES;
  const BatteryReading battery = readBattery();

  if (!ambientOk) {
    Serial.printf("[KHI HAU] SHT30 loi=%s SDA=IO%d SCL=IO%d\n",
                  statusToVietnamese(ambientStatus),
            SHT30_SDA_PIN,
            SHT30_SCL_PIN);
  }

  const float filteredMoisture = soilOk ? filteredAverage(soilMoisturePct, soilCount) : NAN;
  const float filteredEcMsCm = soilOk ? filteredAverage(soilEcMsCm, soilCount) : NAN;
  const float filteredPh = phOk ? filteredAverage(soilPh, phCount) : NAN;
  const char *advice = buildGrapefruitAdvice(filteredMoisture, filteredEcMsCm, filteredPh);

  return {
    ambientOk,
    soilOk,
    phOk,
    battery.ok,
    ambientOk ? filteredAverage(airTempC, ambientCount) : NAN,
    ambientOk ? filteredAverage(airHumidityPct, ambientCount) : NAN,
    soilOk ? filteredAverage(soilTempC, soilCount) : NAN,
    filteredMoisture,
    soilOk ? filteredAverage(soilEcUsCm, soilCount) : NAN,
    filteredEcMsCm,
    soilOk ? filteredAverage(soilSalinity, soilCount) : NAN,
    soilOk ? filteredAverage(soilTds, soilCount) : NAN,
    filteredPh,
    battery.voltageV,
    battery.percent,
    ambientCount,
    soilCount,
    phCount,
    ambientOk ? "ok" : ambientStatus,
    soilOk ? "ok" : soilStatus,
    phOk ? "ok" : phStatus,
    battery.status,
    advice,
  };
}

void pushAggregateMinute(const MinuteReading &reading) {
  if (aggregateCount >= MINUTE_RECORDS_PER_PACKET) {
    aggregateCount = 0;
  }

  aggregateAirTempC[aggregateCount] = reading.airTempC;
  aggregateAirHumidityPct[aggregateCount] = reading.airHumidityPct;
  aggregateSoilTempC[aggregateCount] = reading.soilTempC;
  aggregateSoilMoisturePct[aggregateCount] = reading.soilMoisturePct;
  aggregateSoilEcUsCm[aggregateCount] = reading.soilEcUsCm;
  aggregateSoilEcMsCm[aggregateCount] = reading.soilEcMsCm;
  aggregateSoilSalinity[aggregateCount] = reading.soilSalinity;
  aggregateSoilTds[aggregateCount] = reading.soilTds;
  aggregateSoilPh[aggregateCount] = reading.soilPh;
  aggregateBatteryVoltageV[aggregateCount] = reading.batteryVoltageV;
  aggregateBatteryPercent[aggregateCount] = reading.batteryPercent;
  aggregateCount += 1;
}

AggregateReading buildAggregateReading() {
  const float moisture = averageFinite(aggregateSoilMoisturePct, aggregateCount);
  const float ecMsCm = averageFinite(aggregateSoilEcMsCm, aggregateCount);
  const float ph = averageFinite(aggregateSoilPh, aggregateCount);

  return {
    averageFinite(aggregateAirTempC, aggregateCount),
    averageFinite(aggregateAirHumidityPct, aggregateCount),
    averageFinite(aggregateSoilTempC, aggregateCount),
    moisture,
    averageFinite(aggregateSoilEcUsCm, aggregateCount),
    ecMsCm,
    averageFinite(aggregateSoilSalinity, aggregateCount),
    averageFinite(aggregateSoilTds, aggregateCount),
    ph,
    averageFinite(aggregateBatteryVoltageV, aggregateCount),
    averageFinite(aggregateBatteryPercent, aggregateCount),
    aggregateCount,
    buildGrapefruitAdvice(moisture, ecMsCm, ph),
  };
}

String buildMinutePayload(const MinuteReading &reading) {
  String payload;
  payload.reserve(880);
  payload += "{\"type\":\"minute_reading\",\"station_id\":\"";
  payload += STATION_ID;
  payload += "\",\"firmware_version\":\"";
  payload += FIRMWARE_VERSION;
  payload += "\",\"uptime_ms\":";
  payload += String(millis());
  payload += ",\"crop\":\"grapefruit\",\"air_temp_c\":";
  payload += numberOrNull(reading.airTempC, 1);
  payload += ",\"air_humidity_pct\":";
  payload += numberOrNull(reading.airHumidityPct, 1);
  payload += ",\"soil_temp_c\":";
  payload += numberOrNull(reading.soilTempC, 1);
  payload += ",\"soil_moisture_pct\":";
  payload += numberOrNull(reading.soilMoisturePct, 1);
  payload += ",\"soil_ec_us_cm\":";
  payload += numberOrNull(reading.soilEcUsCm, 0);
  payload += ",\"soil_ec_ms_cm\":";
  payload += numberOrNull(reading.soilEcMsCm, 3);
  payload += ",\"soil_salinity\":";
  payload += numberOrNull(reading.soilSalinity, 0);
  payload += ",\"soil_tds\":";
  payload += numberOrNull(reading.soilTds, 0);
  payload += ",\"soil_ph\":";
  payload += numberOrNull(reading.soilPh, 1);
  payload += ",\"battery_voltage_v\":";
  payload += numberOrNull(reading.batteryVoltageV, 2);
  payload += ",\"battery_percent\":";
  payload += numberOrNull(reading.batteryPercent, 1);
  payload += ",\"valid_ambient_samples\":";
  payload += String(reading.validAmbientSamples);
  payload += ",\"valid_soil_samples\":";
  payload += String(reading.validSoilSamples);
  payload += ",\"valid_ph_samples\":";
  payload += String(reading.validPhSamples);
  payload += ",\"ambient_status\":\"";
  payload += reading.ambientStatus;
  payload += "\",\"soil_status\":\"";
  payload += reading.soilStatus;
  payload += "\",\"ph_status\":\"";
  payload += reading.phStatus;
  payload += "\",\"battery_status\":\"";
  payload += reading.batteryStatus;
  payload += "\",\"advice\":\"";
  payload += reading.grapefruitAdvice;
  payload += "\"}";
  return payload;
}

String buildAggregatePayload(const AggregateReading &reading, const char *messageId) {
  String payload;
  payload.reserve(900);
  payload += "{\"type\":\"station_summary\",\"station_id\":\"";
  payload += STATION_ID;
  payload += "\",\"firmware_version\":\"";
  payload += FIRMWARE_VERSION;
  payload += "\",\"message_id\":\"";
  payload += messageId;
  payload += "\",\"sequence\":";
  payload += String(sequenceNumber);
  payload += ",\"uptime_ms\":";
  payload += String(millis());
  payload += ",\"summary_minutes\":";
  payload += String(reading.minuteCount);
  payload += ",\"crop\":\"grapefruit\",\"air_temp_c\":";
  payload += numberOrNull(reading.airTempC, 1);
  payload += ",\"air_humidity_pct\":";
  payload += numberOrNull(reading.airHumidityPct, 1);
  payload += ",\"soil_temp_c\":";
  payload += numberOrNull(reading.soilTempC, 1);
  payload += ",\"soil_moisture_pct\":";
  payload += numberOrNull(reading.soilMoisturePct, 1);
  payload += ",\"soil_ec_us_cm\":";
  payload += numberOrNull(reading.soilEcUsCm, 0);
  payload += ",\"soil_ec_ms_cm\":";
  payload += numberOrNull(reading.soilEcMsCm, 3);
  payload += ",\"soil_salinity\":";
  payload += numberOrNull(reading.soilSalinity, 0);
  payload += ",\"soil_tds\":";
  payload += numberOrNull(reading.soilTds, 0);
  payload += ",\"soil_ph\":";
  payload += numberOrNull(reading.soilPh, 1);
  payload += ",\"battery_voltage_v\":";
  payload += numberOrNull(reading.batteryVoltageV, 2);
  payload += ",\"battery_percent\":";
  payload += numberOrNull(reading.batteryPercent, 1);
  payload += ",\"advice\":\"";
  payload += reading.grapefruitAdvice;
  payload += "\"}";
  return payload;
}

String buildLoraTestPayload(const char *messageId) {
  String payload;
  payload.reserve(120);
  payload += "{\"type\":\"ping\",\"station_id\":\"";
  payload += STATION_ID;
  payload += "\",\"firmware_version\":\"";
  payload += FIRMWARE_VERSION;
  payload += "\",\"message_id\":\"";
  payload += messageId;
  payload += "\"}";
  return payload;
}

bool waitForAck(const char *messageId, uint32_t timeoutMs) {
  if (DEBUG_DISABLE_LORA_UART) {
    return false;
  }

  const uint32_t startedAt = millis();
  String line;

  while (millis() - startedAt < timeoutMs) {
    serviceWatchdog();
    while (loraSerial.available() > 0) {
      const char c = static_cast<char>(loraSerial.read());
      if (c == '\n') {
        line.trim();
        if (line.indexOf("\"type\":\"ack\"") >= 0 && line.indexOf(messageId) >= 0) {
          return true;
        }
        applyConfigCommand(line);
        line = "";
      } else if (c != '\r') {
        line += c;
        if (line.length() > 420) {
          line = "";
        }
      }
    }
    delay(10);
  }

  return false;
}

void sendAggregateIfReady() {
  if (aggregateCount < MINUTE_RECORDS_PER_PACKET) {
    return;
  }

  if (!gatewayPollPending) {
    return;
  }
  gatewayPollPending = false;

  if (DEBUG_DISABLE_LORA_UART) {
    Serial.println("[LORA] UART dang tat - giu goi tong hop de gui lai");
    return;
  }

  if (pendingSequence == 0) {
    sequenceNumber += 1;
    pendingSequence = sequenceNumber;
  }

  char messageId[48];
  snprintf(
    messageId,
    sizeof(messageId),
    "%s-%lu",
    STATION_ID,
    static_cast<unsigned long>(pendingSequence)
  );

  const AggregateReading aggregate = buildAggregateReading();
  const String payload = LORA_TEST_SHORT_PACKET
    ? buildLoraTestPayload(messageId)
    : buildAggregatePayload(aggregate, messageId);

  Serial.printf("[LORA] Gateway poll -> bat dau BURST %u lan cho %s\n",
                LORA_TX_BURST_COUNT,
                messageId);
  Serial.println(payload);

  delay(LORA_REPLY_GUARD_MS);

  // Remove stale poll/garbage bytes before the first data transmission.
  while (loraSerial.available() > 0) {
    (void)loraSerial.read();
  }

  bool ackOk = false;
  uint8_t sentCopies = 0;

  for (uint8_t attempt = 1; attempt <= LORA_TX_BURST_COUNT; attempt += 1) {
    sentCopies = attempt;

    Serial.printf("[LORA-TX] %s lan %u/%u, bytes=%u\n",
                  messageId,
                  attempt,
                  LORA_TX_BURST_COUNT,
                  static_cast<unsigned int>(payload.length()));

    loraSerial.println(payload);
    loraSerial.flush();

    ackOk = waitForAck(messageId, LORA_ACK_TIMEOUT_MS);
    if (ackOk) {
      Serial.printf("[LORA] ACK thanh cong sau lan TX %u/%u\n",
                    attempt,
                    LORA_TX_BURST_COUNT);
      break;
    }

    if (attempt < LORA_TX_BURST_COUNT) {
      Serial.printf("[LORA] Chua ACK %s -> gui lai sau %lu ms\n",
                    messageId,
                    static_cast<unsigned long>(LORA_TX_RETRY_GAP_MS));
      delay(LORA_TX_RETRY_GAP_MS);
    }
  }

  Serial.printf("[LORA] Ket qua %s: %s, da_gui=%u\n",
                messageId,
                ackOk ? "da_nhan" : "chua_nhan_duoc",
                sentCopies);

  String packetLog = payload;
  if (packetLog.endsWith("}")) {
    packetLog.remove(packetLog.length() - 1);
  }
  packetLog += ",\"ack_ok\":";
  packetLog += ackOk ? "true" : "false";
  packetLog += ",\"tx_copies\":";
  packetLog += String(sentCopies);
  packetLog += "}";
  Serial.printf("[LOG-PACKET] %s\n", packetLog.c_str());

  if (ackOk) {
    aggregateCount = 0;
    pendingSequence = 0;
    Serial.println("[LORA] Gateway da ACK - xoa aggregate va cho chu ky moi");
    maybeEnterConfiguredSleep();
  } else {
    Serial.println("[LORA] Het burst van khong ACK - GIU aggregate + message_id cho poll sau");
  }
}


// ============================================================
// SIMPLE LORA QoS1 WIRE PROTOCOL
// ============================================================
// No poll, no long JSON over LoRa.
// Packet: S2|seq|minutes|airT|airH|soilT|moist|ec_ms|sal|tds|ph|bat_v|bat_pct|CRC16
// ACK:    A2|seq
// The same sequence is retried FOREVER until ACK is received.

static uint32_t simpleNextTxMs = 0;
static uint32_t simpleTxAttempts = 0;

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

String simpleFloat(float value, uint8_t decimals) {
  if (!isfinite(value)) return "x";
  return String(value, static_cast<unsigned int>(decimals));
}

String buildSimpleLoRaPacket(const AggregateReading &r, uint32_t seq) {
  String body;
  body.reserve(170);
  body += "S2|";
  body += String(seq);
  body += "|"; body += String(r.minuteCount);
  body += "|"; body += simpleFloat(r.airTempC, 1);
  body += "|"; body += simpleFloat(r.airHumidityPct, 1);
  body += "|"; body += simpleFloat(r.soilTempC, 1);
  body += "|"; body += simpleFloat(r.soilMoisturePct, 1);
  body += "|"; body += simpleFloat(r.soilEcMsCm, 3);
  body += "|"; body += simpleFloat(r.soilSalinity, 0);
  body += "|"; body += simpleFloat(r.soilTds, 0);
  body += "|"; body += simpleFloat(r.soilPh, 1);
  body += "|"; body += simpleFloat(r.batteryVoltageV, 2);
  body += "|"; body += simpleFloat(r.batteryPercent, 1);

  char crcHex[5];
  snprintf(crcHex, sizeof(crcHex), "%04X", simpleCrc16(body));
  body += "|";
  body += crcHex;
  return body;
}

bool waitSimpleAck(uint32_t seq, uint32_t timeoutMs) {
  String expected = "A2|" + String(seq);
  String line;
  const uint32_t started = millis();

  while (millis() - started < timeoutMs) {
    serviceWatchdog();
    while (loraSerial.available() > 0) {
      const char c = static_cast<char>(loraSerial.read());
      if (c == '\n') {
        line.trim();
        if (line == expected) return true;
        line = "";
      } else if (c != '\r') {
        line += c;
        if (line.length() > 64) line = "";
      }
    }
    delay(5);
  }
  return false;
}

void readLoRaCommandsSimple() {
  // ACK is consumed synchronously by waitSimpleAck().
}

void sendAggregateIfReadySimple() {
  // A minute record is still sent when THEC is unavailable. Its THEC fields
  // remain unavailable in the packet; only aggregateCount controls batching.
  if (aggregateCount < MINUTE_RECORDS_PER_PACKET || DEBUG_DISABLE_LORA_UART) return;

  const uint32_t now = millis();
  if (simpleNextTxMs != 0 && static_cast<int32_t>(now - simpleNextTxMs) < 0) return;

  if (pendingSequence == 0) {
    sequenceNumber += 1;
    pendingSequence = sequenceNumber;
    simpleTxAttempts = 0;
    // Station 2 uses a later slot so it does not collide with Station 1's
    // one-minute first attempt.
    simpleNextTxMs = millis() + 2600 + (esp_random() % 900);
    return;
  }

  const AggregateReading aggregate = buildAggregateReading();
  const String packet = buildSimpleLoRaPacket(aggregate, pendingSequence);

  while (loraSerial.available() > 0) (void)loraSerial.read();
  loraSerial.println(packet);
  loraSerial.flush();
  simpleTxAttempts += 1;

  const bool ackOk = waitSimpleAck(pendingSequence, 1800);

  String packetLog = packet;
  packetLog += ackOk ? "|ACK" : "|NOACK";
  Serial.printf("[LOG-PACKET] %s\n", packetLog.c_str());

  if (ackOk) {
    aggregateCount = 0;
    pendingSequence = 0;
    simpleTxAttempts = 0;
    simpleNextTxMs = 0;
    maybeEnterConfiguredSleep();
    return;
  }

  // Never give up. Keep Station 2 retries in the later retry slot.
  simpleNextTxMs = millis() + 4200 + (esp_random() % 2000);
}

void setup() {
  Serial.begin(DEBUG_BAUD);
  delay(300);

  setupWatchdog();

  if (RS485_DE_RE_PIN >= 0) {
    pinMode(RS485_DE_RE_PIN, OUTPUT);
  }
  setRs485Transmit(false);

  Wire.begin(INA226_SDA_PIN, INA226_SCL_PIN);
  Wire.setClock(I2C_CLOCK_HZ);
  ina226Ready = setupIna226();

  sht30Ready = sht30Wire.begin(SHT30_SDA_PIN, SHT30_SCL_PIN, I2C_CLOCK_HZ);
  Serial.printf("[SHT30] SDA=IO%d SCL=IO%d dia_chi=0x%02X trang_thai=%s\n",
                SHT30_SDA_PIN,
                SHT30_SCL_PIN,
                SHT30_I2C_ADDRESS,
                sht30Ready ? "san_sang" : "khong_co");

  ensureRs485Baud(RS485_BAUD);
  // Khong bao gio doi Modbus ID trong firmware chay thuong.
  // Cau hinh da chot: pH=ID1, THEC=ID2, cung baud 4800.
  diagnosePhAddressRegister();

  if (DEBUG_DISABLE_LORA_UART) {
    pinMode(LORA_UART_RX_PIN, INPUT);
    pinMode(LORA_UART_TX_PIN, INPUT);
    Serial.println("[LORA] Tam tat UART de kiem tra nhiet module");
  } else {
    loraSerial.begin(LORA_UART_BAUD, SERIAL_8N1, LORA_UART_RX_PIN, LORA_UART_TX_PIN);
    Serial.println("[LORA] SIMPLE QoS1: goi ngan + retry vo han den khi ACK");
  }

  Serial.println();
  Serial.println("[HORIZON] Tram 2 do dat buoi dang khoi dong");
  Serial.printf("[HORIZON] Tram: %s\n", STATION_ID);
  Serial.printf("[HORIZON] Phien ban: %s\n", FIRMWARE_VERSION);
  Serial.println("[RS485] BUS CHUNG: pH=ID1 | THEC=ID2 | baud=4800 | doc TUAN TU, khong ghi ID");
  Serial.printf("[PIN] SDA=%d SCL=%d dia_chi=0x%02X trang_thai=%s\n",
                INA226_SDA_PIN,
                INA226_SCL_PIN,
                INA226_ADDRESS,
                ina226Ready ? "san_sang" : "khong_co");
  Serial.printf("[KHI HAU] SHT30 SDA=IO%d SCL=IO%d trang_thai=cho_doc_lan_dau\n",
                SHT30_SDA_PIN,
                SHT30_SCL_PIN);
  Serial.printf("[DAT RS485] baud=%lu TX=%d RX=%d tu_dong_doi_chieu=%s THEC_ID=%u PH_ID=%u PH_BAUD=%lu\n",
                static_cast<unsigned long>(RS485_BAUD),
                RS485_TX_PIN,
                RS485_RX_PIN,
                RS485_DE_RE_PIN < 0 ? "co" : "khong",
                SOIL_THEC_SLAVE_ID,
                activeSoilPhSlaveId,
                static_cast<unsigned long>(activeSoilPhBaud));
  Serial.printf("[LORA] RX=%d TX=%d baud=%lu trang_thai=%s\n",
                LORA_UART_RX_PIN,
                LORA_UART_TX_PIN,
                static_cast<unsigned long>(LORA_UART_BAUD),
                DEBUG_DISABLE_LORA_UART ? "tam_tat_de_do_nhiet" : "san_sang");
  Serial.println("[LOG] Luu du lieu flash: tat");
  Serial.printf("[KIEM THU] mau_tho=%s ph=%s\n",
                DEBUG_RAW_SENSOR_SAMPLES ? "bat" : "tat",
                DEBUG_SKIP_PH_SENSOR ? "tam_tat" : "bat");
  Serial.printf("[NGUON] chu_ky_do=%lu giay ngu=%lu giay\n", SAMPLE_INTERVAL_MS / 1000UL, configuredSleepIntervalMs / 1000UL);
  Serial.println("[HORIZON] Khoi dong xong, san sang do va gui du lieu");
}

void loop() {
  serviceWatchdog();
  readLoRaCommandsSimple();

  // Reply immediately when this station is selected by the gateway.
  sendAggregateIfReadySimple();

  // Do not start another long sensor cycle while a packet is
  // waiting for its ACK. This is especially important when sensors are
  // disconnected and their Modbus reads consume several seconds.
  if (pendingSequence != 0) {
    delay(20);
    return;
  }

  const uint32_t now = millis();
  if (lastSampleMs != 0 && now - lastSampleMs < SAMPLE_INTERVAL_MS) {
    delay(20);
    return;
  }
  lastSampleMs = now;

  const MinuteReading minute = collectMinuteReading();
  const String minutePayload = buildMinutePayload(minute);

  Serial.printf("[LOG-MINUTE] %s\n", minutePayload.c_str());

  pushAggregateMinute(minute);
  Serial.printf("[TONG HOP] %u/%u phut | THEC_mau_hop_le=%u | THEC_trang_thai=%s\n",
                aggregateCount,
                MINUTE_RECORDS_PER_PACKET,
                minute.validSoilSamples,
                minute.soilStatus);
  sendAggregateIfReadySimple();
}
