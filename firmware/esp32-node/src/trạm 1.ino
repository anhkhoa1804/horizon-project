#include <Arduino.h>

#include <SPI.h>
#include <Wire.h>
#include <esp_sleep.h>
#include <esp_task_wdt.h>
#include <math.h>
#include <string.h>

// USB CDC is used for diagnostics. UART0 remains dedicated to A02YYUW through
// ultrasonicSerial, so Serial output does not share the sensor input stream.

/*
  ============================================================
  HORIZON - Station 1, upstream water node
  ============================================================

  Sensors:
  - A02YYUW ultrasonic UART
  - ES-EC-WT-01 EC/salinity sensor via RS485 Modbus RTU
  - SX1278 LoRa transparent UART

  Operation:
  - Every ~1 minute:
      + 8 ultrasonic samples
      + 8 EC samples
      + filtered average

  - Every ~1 minute:
      + build aggregate
      + send through LoRa
      + wait for ACK
      + if ACK OK -> clear aggregate
      + if ACK fails -> keep aggregate for retry

  - Optional deep sleep:
      + controlled by LoRa config command
      + configuredSleepIntervalMs = 0 means no deep sleep

  ============================================================
*/


// ============================================================
// STATION INFORMATION
// ============================================================

static const char *STATION_ID = "STATION_01";
static const char *FIRMWARE_VERSION = "station1-water-0.6.0-simple-qos1";


// ============================================================
// ULTRASONIC GEOMETRY
// ============================================================

// Distance from A02YYUW sensor face to water reference line.
static const float SENSOR_HEIGHT_CM = 350.0f;

static const float A02YYUW_MIN_CM = 3.0f;
static const float A02YYUW_MAX_CM = 450.0f;


// ============================================================
// SAMPLING
// ============================================================

static const uint32_t I2C_CLOCK_HZ = 100000;

// Production wiring restored to the original Station 1 pinout.
// USB CDC/debug is not used in this build.
static const int I2C_SDA_PIN = 4;
static const int I2C_SCL_PIN = 5;

static const uint8_t INA226_ADDRESS = 0x40;
static const uint8_t LIFEPO4_CELL_COUNT = 4;
static const uint8_t INA226_REG_CONFIG = 0x00;
static const uint8_t INA226_REG_SHUNT_VOLTAGE = 0x01;
static const uint8_t INA226_REG_BUS_VOLTAGE = 0x02;
static const float INA226_SHUNT_OHMS = 0.1f;
static const bool DEBUG_BATTERY_READING = false;

static const bool LORA_TEST_FAST_SEND = false;
static const uint8_t RAW_SAMPLES_PER_MINUTE = LORA_TEST_FAST_SEND ? 1 : 8;
static const uint8_t MIN_VALID_RAW_SAMPLES = LORA_TEST_FAST_SEND ? 1 : 3;

static const uint8_t MINUTE_RECORDS_PER_PACKET = 1;

static const bool DEBUG_RAW_SENSOR_SAMPLES = false;
static const bool DEBUG_SKIP_ULTRASONIC = false;
static const bool DEBUG_SKIP_EC = false;
static const bool DEBUG_MODBUS_FRAMES = false;
static const bool DEBUG_EC_MODBUS_SCAN = true;  // Keep auto-detect; output is suppressed in production.
static const bool DEBUG_PRINT_SENSOR_CYCLE = false;
static const bool DEBUG_PRINT_MINUTE_PAYLOAD = false;
static const bool DEBUG_PRINT_AGGREGATE_STATUS = false;

// Minimum interval between completed measurement cycles.
static const uint32_t SAMPLE_INTERVAL_MS = LORA_TEST_FAST_SEND ? 5UL * 1000UL : 60UL * 1000UL;

// Gap between raw sensor samples.
static const uint32_t RAW_SAMPLE_GAP_MS = 450;

// Read a fresh A02YYUW frame instead of a stale frame already queued in UART.
static const uint32_t A02YYUW_SAMPLE_TIMEOUT_MS = 600;

// Reject one-off ultrasonic spikes while keeping normal river ripple.
static const float A02YYUW_MAX_MEDIAN_DEVIATION_CM = 30.0f;

// LoRa ACK timeout.
// Controlled burst: one poll can produce several copies of the SAME message_id.
static const uint8_t LORA_TX_BURST_COUNT = 3;
static const uint32_t LORA_ACK_TIMEOUT_MS = 5000;
static const uint32_t LORA_REPLY_GUARD_MS = 1000;
static const uint32_t LORA_TX_RETRY_GAP_MS = 1200;
static const uint32_t DEFAULT_SLEEP_INTERVAL_MS = 60UL * 1000UL;


// ============================================================
// SERIAL BAUD RATES
// ============================================================

static const uint32_t DEBUG_BAUD = 115200;

static const uint32_t A02YYUW_BAUD = 9600;

// ES-EC-WT-01 default.
static const uint32_t EC_RS485_BAUD = 4800;
static const uint8_t EC_RS485_SLAVE_ID = 1;

static const uint32_t EC_SCAN_TIMEOUT_MS = 250;
static const uint8_t EC_SCAN_MAX_SLAVE_ID = 10;
static const uint32_t EC_SCAN_BAUDS[] = {
  4800,
  9600,
  2400,
  19200
};

static const uint32_t LORA_UART_BAUD = 9600;


// ============================================================
// A02YYUW UART
// ============================================================

// A02YYUW TX -> ESP32 RX
static const int A02YYUW_RX_PIN = 14;


// ============================================================
// ES-EC-WT-01 + auto-direction TTL-RS485 module
// ============================================================

// This station has only one RS485 sensor module connected,
// so the slave ID is handled directly in the Modbus calls.

// ESP32 TX -> TTL-RS485 RXD
static const int EC_RS485_TX_PIN = 6;

// ESP32 RX <- TTL-RS485 TXD
static const int EC_RS485_RX_PIN = 7;

// Your SN74HC14 TTL-RS485 board is auto-direction and has no DE/RE pin.
// Keep this at -1 for that board.
static const int EC_RS485_DE_RE_PIN = -1;
static const uint32_t EC_RS485_TURNAROUND_DELAY_MS = 2;
static const uint32_t EC_RS485_INTER_REQUEST_GAP_MS = 100;
static const uint32_t EC_RS485_AUTO_RX_SETTLE_US = 300;

// ============================================================
// LORA UART
// ============================================================

// SX1278 UART module
static const int LORA_UART_RX_PIN = 15;
static const int LORA_UART_TX_PIN = 16;

// Debug is on USB CDC; all three hardware UARTs are dedicated:
// UART0=A02YYUW, UART1=LoRa, UART2=EC RS485.
static const bool DEBUG_DISABLE_LORA_UART = false;


// ============================================================
// WATCHDOG
// ============================================================

static const uint32_t WATCHDOG_TIMEOUT_MS = 60000;


// ============================================================
// MODBUS REGISTER MAP
// ============================================================
//
// Float values are CDAB byte order.
//

static const uint16_t REG_EC_MSCM = 0x0000;
static const uint16_t REG_RESISTIVITY_OHM_CM = 0x0002;
static const uint16_t REG_TEMPERATURE_C = 0x0004;
static const uint16_t REG_TDS_PPM = 0x0006;
static const uint16_t REG_SALINITY_PPM = 0x0008;


// ============================================================
// SERIAL / SPI OBJECTS
// ============================================================

// Do not use Serial0 for debug. Serial is USB CDC because of the compile guard above.
HardwareSerial ultrasonicSerial(0);  // UART0: A02YYUW RX only
HardwareSerial ecSerial(2);          // UART2: EC RS485
HardwareSerial loraSerial(1);        // UART1: LoRa

// ============================================================
// DATA STRUCTURES
// ============================================================

struct SensorValue {
  bool ok;
  float value;
  const char *status;
};


struct WaterEcReading {
  bool ok;

  float ecMsCm;
  float ecUsCm;

  float temperatureC;

  float tdsPpm;

  float salinityPpm;
  float salinityPpt;

  const char *status;
};


struct BatteryReading {
  bool ok;
  float voltageV;
  float percent;
  const char *status;
};


struct MinuteReading {
  bool waterOk;
  bool ecOk;

  float distanceCm;
  float waterLevelCm;

  float ecMsCm;
  float ecUsCm;

  float temperatureC;

  float tdsPpm;

  float salinityPpm;
  float salinityPpt;

  uint8_t validDistanceSamples;
  uint8_t validEcSamples;

  bool batteryOk;
  float batteryVoltageV;
  float batteryPercent;

  const char *ultrasonicStatus;
  const char *ecStatus;
  const char *batteryStatus;
};


struct AggregateReading {
  float distanceCm;
  float waterLevelCm;

  float ecMsCm;
  float ecUsCm;

  float temperatureC;

  float tdsPpm;

  float salinityPpm;
  float salinityPpt;

  float batteryVoltageV;
  float batteryPercent;

  uint8_t minuteCount;
};


// ============================================================
// RTC DATA
// ============================================================
//
// These variables survive deep sleep.
//

RTC_DATA_ATTR static uint32_t sequenceNumber = 0;

RTC_DATA_ATTR static uint8_t aggregateCount = 0;

RTC_DATA_ATTR static float aggregateWaterLevel[
  MINUTE_RECORDS_PER_PACKET
] = {};

RTC_DATA_ATTR static float aggregateDistance[
  MINUTE_RECORDS_PER_PACKET
] = {};

RTC_DATA_ATTR static float aggregateEcMsCm[
  MINUTE_RECORDS_PER_PACKET
] = {};

RTC_DATA_ATTR static float aggregateEcUsCm[
  MINUTE_RECORDS_PER_PACKET
] = {};

RTC_DATA_ATTR static float aggregateTempC[
  MINUTE_RECORDS_PER_PACKET
] = {};

RTC_DATA_ATTR static float aggregateTdsPpm[
  MINUTE_RECORDS_PER_PACKET
] = {};

RTC_DATA_ATTR static float aggregateSalinityPpm[
  MINUTE_RECORDS_PER_PACKET
] = {};

RTC_DATA_ATTR static float aggregateSalinityPpt[
  MINUTE_RECORDS_PER_PACKET
] = {};

RTC_DATA_ATTR static float aggregateBatteryVoltageV[
  MINUTE_RECORDS_PER_PACKET
] = {};

RTC_DATA_ATTR static float aggregateBatteryPercent[
  MINUTE_RECORDS_PER_PACKET
] = {};


// ============================================================
// GLOBAL STATE
// ============================================================

static bool watchdogReady = false;

static bool ina226Ready = false;

static bool loraReady = false;

static const char *lastModbusStatus = "not_started";
static size_t lastModbusBytesRead = 0;

static uint32_t activeEcRs485Baud = EC_RS485_BAUD;
static uint8_t activeEcSlaveId = EC_RS485_SLAVE_ID;

static uint32_t lastSampleMs = 0;

static uint32_t configuredSleepIntervalMs = DEFAULT_SLEEP_INTERVAL_MS;

static String loraCommandLine;
static bool gatewayPollPending = false;

// Sequence currently waiting for ACK.
// 0 = no pending packet.
RTC_DATA_ATTR static uint32_t pendingSequence = 0;


// ============================================================
// DEBUG
// ============================================================

void debugLine(const String &line) {
  Serial.println(line);
}


const char *statusToVietnamese(const char *status) {
  if (strcmp(status, "ok") == 0) return "binh_thuong";
  if (strcmp(status, "disabled") == 0) return "tam_tat";
  if (strcmp(status, "timeout") == 0) return "qua_thoi_gian_cho";
  if (strcmp(status, "timeout_no_bytes") == 0) return "khong_co_du_lieu";
  if (strcmp(status, "short_response") == 0) return "phan_hoi_thieu";
  if (strcmp(status, "crc_error") == 0) return "loi_kiem_tra_crc";
  if (strcmp(status, "wrong_slave") == 0) return "sai_dia_chi_cam_bien";
  if (strcmp(status, "wrong_function") == 0) return "sai_lenh_modbus";
  if (strcmp(status, "wrong_byte_count") == 0) return "sai_so_byte";
  if (strcmp(status, "checksum_error") == 0) return "loi_kiem_tra";
  if (strcmp(status, "out_of_range") == 0) return "ngoai_khoang_do";
  if (strcmp(status, "ina226_not_ready") == 0) return "cam_bien_pin_chua_san_sang";
  if (strcmp(status, "bus_read_error") == 0) return "loi_doc_dien_ap";
  if (strcmp(status, "shunt_read_error") == 0) return "loi_doc_dong";
  if (strcmp(status, "nan") == 0) return "du_lieu_khong_hop_le";
  if (strcmp(status, "no_valid_sample") == 0) return "khong_co_mau_hop_le";
  if (strcmp(status, "not_started") == 0) return "chua_bat_dau";
  return status;
}


// ============================================================
// FLOAT -> JSON
// ============================================================

String numberOrNull(float value, uint8_t decimals) {

  if (!isfinite(value)) {
    return "null";
  }

  return String(
    value,
    static_cast<unsigned int>(decimals)
  );
}


// ============================================================
// WATCHDOG
// ============================================================

void setupWatchdog() {

  watchdogReady = false;

  Serial.println(
    "[WATCHDOG] Tam tat trong che do kiem thu"
  );
}


void serviceWatchdog() {
  if (watchdogReady) {
    esp_task_wdt_reset();
  }
}


// ============================================================
// SD LOG ROTATION
// ============================================================

// ============================================================
// MODBUS CRC16
// ============================================================

uint16_t modbusCrc16(
  const uint8_t *data,
  size_t length
) {

  uint16_t crc = 0xFFFF;

  for (size_t i = 0; i < length; i++) {

    crc ^= data[i];

    for (uint8_t bit = 0; bit < 8; bit++) {

      if (crc & 0x0001) {

        crc =
          (crc >> 1) ^
          0xA001;

      } else {

        crc >>= 1;
      }
    }
  }

  return crc;
}


// ============================================================
// RS485 DIRECTION
// ============================================================

void setEcRs485Transmit(
  bool transmit
) {

  if (EC_RS485_DE_RE_PIN < 0) {
    (void)transmit;
    delayMicroseconds(EC_RS485_AUTO_RX_SETTLE_US);
    return;
  }

  digitalWrite(
    EC_RS485_DE_RE_PIN,
    transmit ? HIGH : LOW
  );

  delay(
    EC_RS485_TURNAROUND_DELAY_MS
  );
}


void debugHexBytes(
  const char *label,
  const uint8_t *data,
  size_t length
) {

  if (!DEBUG_MODBUS_FRAMES) {
    return;
  }

  Serial.print(label);
  Serial.print(" do_dai=");
  Serial.print(length);
  Serial.print(" du_lieu=");

  for (
    size_t i = 0;
    i < length;
    i++
  ) {

    if (data[i] < 0x10) {
      Serial.print('0');
    }

    Serial.print(
      data[i],
      HEX
    );

    if (i + 1 < length) {
      Serial.print(' ');
    }
  }

  Serial.println();
}


// ============================================================
// READ MODBUS RESPONSE
// ============================================================

bool readModbusResponse(
  uint8_t *buffer,
  size_t expectedLength,
  uint32_t timeoutMs
) {

  const uint32_t startedAt = millis();

  size_t index = 0;
  lastModbusBytesRead = 0;

  while (
    millis() - startedAt < timeoutMs &&
    index < expectedLength
  ) {

    while (
      ecSerial.available() > 0 &&
      index < expectedLength
    ) {

      buffer[index++] =
        static_cast<uint8_t>(
          ecSerial.read()
        );
    }

    serviceWatchdog();

    delay(2);
  }

  lastModbusBytesRead = index;

  return index == expectedLength;
}


// ============================================================
// MODBUS READ HOLDING REGISTERS
// ============================================================

bool readHoldingRegisters(
  uint8_t slaveId,
  uint16_t startRegister,
  uint16_t registerCount,
  uint8_t *response,
  size_t responseLength,
  uint32_t timeoutMs = 900
) {

  lastModbusStatus = "ok";

  // Give an auto-direction RS485 transceiver time to release the bus before
  // starting the next request, especially after a previous timeout.
  delay(EC_RS485_INTER_REQUEST_GAP_MS);

  while (ecSerial.available() > 0) {
    ecSerial.read();
  }


  uint8_t request[8] = {

    slaveId,

    0x03,

    static_cast<uint8_t>(
      startRegister >> 8
    ),

    static_cast<uint8_t>(
      startRegister & 0xFF
    ),

    static_cast<uint8_t>(
      registerCount >> 8
    ),

    static_cast<uint8_t>(
      registerCount & 0xFF
    ),

    0,
    0
  };


  const uint16_t crc =
    modbusCrc16(request, 6);


  request[6] =
    static_cast<uint8_t>(
      crc & 0xFF
    );

  request[7] =
    static_cast<uint8_t>(
      crc >> 8
    );

  debugHexBytes(
    "[EC TX]",
    request,
    sizeof(request)
  );


  setEcRs485Transmit(true);

  ecSerial.write(
    request,
    sizeof(request)
  );

  ecSerial.flush();

  setEcRs485Transmit(false);

  // RX
  if (
    !readModbusResponse(
      response,
      responseLength,
      timeoutMs
    )
  ) {

    lastModbusStatus =
      lastModbusBytesRead == 0
        ? "timeout_no_bytes"
        : "short_response";

    debugHexBytes(
      "[EC RX]",
      response,
      lastModbusBytesRead
    );

    return false;
  }

  debugHexBytes(
    "[EC RX]",
    response,
    responseLength
  );


  // CRC
  const uint16_t responseCrc =
    static_cast<uint16_t>(
      response[responseLength - 1]
    ) << 8 |
    response[responseLength - 2];


  const uint16_t expectedCrc =
    modbusCrc16(
      response,
      responseLength - 2
    );


  if (responseCrc != expectedCrc) {
    lastModbusStatus = "crc_error";
    return false;
  }


  // Header validation
  if (response[0] != slaveId) {
    lastModbusStatus = "wrong_slave";
    return false;
  }

  if (response[1] != 0x03) {
    lastModbusStatus = "wrong_function";
    return false;
  }

  if (
    response[2] !=
    registerCount * 2
  ) {
    lastModbusStatus = "wrong_byte_count";
    return false;
  }


  return true;
}


// ============================================================
// CDAB FLOAT DECODER
// ============================================================

float floatFromCdabBytes(
  const uint8_t *raw
) {

  /*
    Sensor:
      C D A B

    Convert:
      A B C D

    Example:
      72 37 41 DB

    -> 41 DB 72 37
    -> 27.4
  */

  const uint32_t bits =

    (static_cast<uint32_t>(
      raw[2]
    ) << 24) |

    (static_cast<uint32_t>(
      raw[3]
    ) << 16) |

    (static_cast<uint32_t>(
      raw[0]
    ) << 8) |

    static_cast<uint32_t>(
      raw[1]
    );


  float value;

  memcpy(
    &value,
    &bits,
    sizeof(value)
  );

  return value;
}


// ============================================================
// READ ONE EC FLOAT REGISTER
// ============================================================

SensorValue readEcFloatRegister(
  uint16_t reg
) {

  uint8_t response[9] = {};


  if (
    !readHoldingRegisters(
      activeEcSlaveId,
      reg,
      2,
      response,
      sizeof(response)
    )
  ) {

    return {
      false,
      NAN,
      lastModbusStatus
    };
  }


  const float value =
    floatFromCdabBytes(
      &response[3]
    );


  if (!isfinite(value)) {

    return {
      false,
      NAN,
      "nan"
    };
  }


  return {
    true,
    value,
    "ok"
  };
}


bool scanEcModbus() {

  if (!DEBUG_EC_MODBUS_SCAN) {
    return false;
  }

  Serial.println(
    "[EC SCAN] Dang tim baud va dia chi cam bien..."
  );

  const size_t baudCount =
    sizeof(EC_SCAN_BAUDS) /
    sizeof(EC_SCAN_BAUDS[0]);

  for (
    size_t baudIndex = 0;
    baudIndex < baudCount;
    baudIndex++
  ) {

    const uint32_t baud =
      EC_SCAN_BAUDS[baudIndex];

    ecSerial.updateBaudRate(baud);
    delay(80);

    for (
      uint8_t slaveId = 1;
      slaveId <= EC_SCAN_MAX_SLAVE_ID;
      slaveId++
    ) {

      uint8_t response[9] = {};

      const bool ok =
        readHoldingRegisters(
          slaveId,
          REG_EC_MSCM,
          2,
          response,
          sizeof(response),
          EC_SCAN_TIMEOUT_MS
        );

      if (ok) {
        activeEcRs485Baud = baud;
        activeEcSlaveId = slaveId;

        Serial.printf(
          "[EC SCAN] Tim thay baud=%lu dia_chi=%u\n",
          static_cast<unsigned long>(activeEcRs485Baud),
          activeEcSlaveId
        );

        return true;
      }

      Serial.printf(
        "[EC SCAN] baud=%lu dia_chi=%u trang_thai=%s so_byte=%u\n",
        static_cast<unsigned long>(baud),
        slaveId,
        statusToVietnamese(lastModbusStatus),
        static_cast<unsigned int>(lastModbusBytesRead)
      );
    }
  }

  ecSerial.updateBaudRate(EC_RS485_BAUD);
  activeEcRs485Baud = EC_RS485_BAUD;
  activeEcSlaveId = EC_RS485_SLAVE_ID;

  Serial.println(
    "[EC SCAN] Khong tim thay phan hoi Modbus"
  );

  return false;
}


// ============================================================
// READ A02YYUW
// ============================================================

void clearUltrasonicBuffer() {

  while (ultrasonicSerial.available() > 0) {
    ultrasonicSerial.read();
  }
}


SensorValue readA02yyuwDistanceCm(
  uint32_t timeoutMs = A02YYUW_SAMPLE_TIMEOUT_MS
) {

  clearUltrasonicBuffer();

  const uint32_t startedAt = millis();


  while (
    millis() - startedAt <
    timeoutMs
  ) {

    if (
      ultrasonicSerial.available() < 4
    ) {

      delay(5);

      serviceWatchdog();

      continue;
    }


    if (
      ultrasonicSerial.read() != 0xFF
    ) {

      continue;
    }


    const uint8_t highByte =
      ultrasonicSerial.read();

    const uint8_t lowByte =
      ultrasonicSerial.read();

    const uint8_t checksum =
      ultrasonicSerial.read();


    const uint8_t expected =
      static_cast<uint8_t>(
        0xFF +
        highByte +
        lowByte
      );


    if (checksum != expected) {

      return {
        false,
        NAN,
        "checksum_error"
      };
    }


    const uint16_t distanceMm =
      (static_cast<uint16_t>(
        highByte
      ) << 8) |
      lowByte;


    const float distanceCm =
      distanceMm / 10.0f;


    if (
      distanceCm <
      A02YYUW_MIN_CM ||

      distanceCm >
      A02YYUW_MAX_CM
    ) {

      return {
        false,
        distanceCm,
        "out_of_range"
      };
    }


    return {
      true,
      distanceCm,
      "ok"
    };
  }


  return {
    false,
    NAN,
    "timeout"
  };
}


// ============================================================
// READ WATER EC
// ============================================================

WaterEcReading readWaterEc() {

  const SensorValue ec =
    readEcFloatRegister(
      REG_EC_MSCM
    );


  if (!ec.ok) {

    return {
      false,

      NAN,
      NAN,
      NAN,
      NAN,
      NAN,
      NAN,

      ec.status
    };
  }


  const SensorValue temperature =
    readEcFloatRegister(
      REG_TEMPERATURE_C
    );


  const SensorValue tds =
    readEcFloatRegister(
      REG_TDS_PPM
    );


  const SensorValue salinity =
    readEcFloatRegister(
      REG_SALINITY_PPM
    );


  const float ecMsCm =
    ec.value;


  const float salinityPpm =
    salinity.ok
      ? salinity.value
      : NAN;


  /*
    If salinity register is unavailable,
    estimate ppt from EC.

    This is only an approximation.
  */

  const float salinityPpt =
    isfinite(salinityPpm)
      ? salinityPpm / 1000.0f
      : ecMsCm * 0.64f;


  return {

    true,

    ecMsCm,

    ecMsCm * 1000.0f,

    temperature.ok
      ? temperature.value
      : NAN,

    tds.ok
      ? tds.value
      : NAN,

    salinityPpm,

    salinityPpt,

    "ok"
  };
}


// ============================================================
// FILTERED AVERAGE
// ============================================================
//
// For >=4 samples:
// remove min + max, then average.
//

float filteredAverage(
  float *values,
  uint8_t count
) {

  if (count == 0) {
    return NAN;
  }


  if (count < 4) {

    float sum = 0.0f;

    for (
      uint8_t i = 0;
      i < count;
      i++
    ) {

      sum += values[i];
    }

    return sum / count;
  }


  float minValue = values[0];
  float maxValue = values[0];

  float sum = 0.0f;


  for (
    uint8_t i = 0;
    i < count;
    i++
  ) {

    minValue =
      min(
        minValue,
        values[i]
      );

    maxValue =
      max(
        maxValue,
        values[i]
      );

    sum += values[i];
  }


  return (
    sum -
    minValue -
    maxValue
  ) / (count - 2);
}


void sortSmallFloatArray(
  float *values,
  uint8_t count
) {

  for (
    uint8_t i = 1;
    i < count;
    i++
  ) {

    const float current =
      values[i];

    int8_t j =
      static_cast<int8_t>(i) - 1;

    while (
      j >= 0 &&
      values[j] > current
    ) {

      values[j + 1] =
        values[j];

      j--;
    }

    values[j + 1] =
      current;
  }
}


float medianValue(
  const float *values,
  uint8_t count
) {

  if (count == 0) {
    return NAN;
  }

  float sorted[
    RAW_SAMPLES_PER_MINUTE
  ] = {};

  for (
    uint8_t i = 0;
    i < count;
    i++
  ) {

    sorted[i] =
      values[i];
  }

  sortSmallFloatArray(
    sorted,
    count
  );

  if (count % 2 == 1) {
    return sorted[count / 2];
  }

  return (
    sorted[count / 2 - 1] +
    sorted[count / 2]
  ) / 2.0f;
}


float filteredUltrasonicAverage(
  float *values,
  uint8_t count
) {

  if (count < 4) {
    return filteredAverage(
      values,
      count
    );
  }

  const float median =
    medianValue(
      values,
      count
    );

  if (!isfinite(median)) {
    return filteredAverage(
      values,
      count
    );
  }

  float stableValues[
    RAW_SAMPLES_PER_MINUTE
  ] = {};

  uint8_t stableCount = 0;

  for (
    uint8_t i = 0;
    i < count;
    i++
  ) {

    if (
      fabs(values[i] - median) <=
      A02YYUW_MAX_MEDIAN_DEVIATION_CM
    ) {

      stableValues[stableCount++] =
        values[i];
    }
  }

  return stableCount >= MIN_VALID_RAW_SAMPLES
    ? filteredAverage(
        stableValues,
        stableCount
      )
    : filteredAverage(
        values,
        count
      );
}


// ============================================================
// COLLECT ONE MINUTE
// ============================================================

MinuteReading collectMinuteReading() {

  float distances[
    RAW_SAMPLES_PER_MINUTE
  ] = {};

  float ecMsCm[
    RAW_SAMPLES_PER_MINUTE
  ] = {};

  float ecUsCm[
    RAW_SAMPLES_PER_MINUTE
  ] = {};

  float tempC[
    RAW_SAMPLES_PER_MINUTE
  ] = {};

  float tdsPpm[
    RAW_SAMPLES_PER_MINUTE
  ] = {};

  float salPpm[
    RAW_SAMPLES_PER_MINUTE
  ] = {};

  float salPpt[
    RAW_SAMPLES_PER_MINUTE
  ] = {};


  uint8_t distanceCount = 0;
  uint8_t ecCount = 0;


  const char *distanceStatus =
    "no_valid_sample";

  const char *ecStatus =
    "no_valid_sample";


  for (
    uint8_t i = 0;
    i < RAW_SAMPLES_PER_MINUTE;
    i++
  ) {

    serviceWatchdog();


    // --------------------------------------------------------
    // Ultrasonic
    // --------------------------------------------------------

    SensorValue distance = {
      false,
      NAN,
      "disabled"
    };

    if (!DEBUG_SKIP_ULTRASONIC) {
      distance =
        readA02yyuwDistanceCm();
    }


    if (
      distance.ok &&
      distanceCount <
      RAW_SAMPLES_PER_MINUTE
    ) {

      distances[distanceCount++] =
        distance.value;
    }


    distanceStatus =
      distance.status;


    // --------------------------------------------------------
    // EC sensor
    // --------------------------------------------------------

    WaterEcReading ec = {
      false,
      NAN,
      NAN,
      NAN,
      NAN,
      NAN,
      NAN,
      "disabled"
    };

    if (!DEBUG_SKIP_EC) {
      ec =
        readWaterEc();
    }


    if (
      ec.ok &&
      ecCount <
      RAW_SAMPLES_PER_MINUTE
    ) {

      ecMsCm[ecCount] =
        ec.ecMsCm;

      ecUsCm[ecCount] =
        ec.ecUsCm;

      tempC[ecCount] =
        ec.temperatureC;

      tdsPpm[ecCount] =
        ec.tdsPpm;

      salPpm[ecCount] =
        ec.salinityPpm;

      salPpt[ecCount] =
        ec.salinityPpt;

      ecCount++;
    }


    ecStatus =
      ec.status;


    if (DEBUG_RAW_SENSOR_SAMPLES) {
      Serial.printf(
        "[MAU THO %u/%u]\n",
        static_cast<unsigned int>(i + 1),
        static_cast<unsigned int>(RAW_SAMPLES_PER_MINUTE)
      );

      Serial.print(
        "  Muc nuoc: "
      );

      Serial.print(
        distance.ok ? "binh_thuong" : statusToVietnamese(distance.status)
      );

      if (distance.ok) {
        Serial.printf(
          " | Khoang cach cam bien: %.1f cm | Muc nuoc: %.1f cm",
          distance.value,
          max(
            0.0f,
            SENSOR_HEIGHT_CM -
            distance.value
          )
        );
      }

      Serial.println();


      Serial.print(
        "  Cam bien nuoc EC: "
      );

      Serial.print(
        ec.ok ? "binh_thuong" : statusToVietnamese(ec.status)
      );

      if (ec.ok) {
        Serial.printf(
          " | EC nuoc: %.0f uS/cm (%.3f mS/cm) | Nhiet do nuoc: %s C | TDS nuoc: %s ppm | Do man: %s ppm (%s ppt)",
          ec.ecUsCm,
          ec.ecMsCm,
          numberOrNull(
            ec.temperatureC,
            2
          ).c_str(),
          numberOrNull(
            ec.tdsPpm,
            1
          ).c_str(),
          numberOrNull(
            ec.salinityPpm,
            1
          ).c_str(),
          numberOrNull(
            ec.salinityPpt,
            3
          ).c_str()
        );
      }

      Serial.println();
    }


    serviceWatchdog();


    // Wait before next raw sample.
    delay(RAW_SAMPLE_GAP_MS);
  }


  // ==========================================================
  // VALIDITY
  // ==========================================================

  const bool waterOk =
    distanceCount >=
    MIN_VALID_RAW_SAMPLES;


  const bool ecOk =
    ecCount >=
    MIN_VALID_RAW_SAMPLES;

  const BatteryReading battery = readBattery();


  // ==========================================================
  // FILTER
  // ==========================================================

  const float distanceCm =
    waterOk
      ? filteredUltrasonicAverage(
          distances,
          distanceCount
        )
      : NAN;


  const float waterLevelCm =
    waterOk
      ? max(
          0.0f,
          SENSOR_HEIGHT_CM -
          distanceCm
        )
      : NAN;


  const float filteredEc =
    ecOk
      ? filteredAverage(
          ecMsCm,
          ecCount
        )
      : NAN;


  const float filteredEcUs =
    ecOk
      ? filteredAverage(
          ecUsCm,
          ecCount
        )
      : NAN;


  const float filteredTemp =
    ecOk
      ? filteredAverage(
          tempC,
          ecCount
        )
      : NAN;


  const float filteredTds =
    ecOk
      ? filteredAverage(
          tdsPpm,
          ecCount
        )
      : NAN;


  const float filteredSalPpm =
    ecOk
      ? filteredAverage(
          salPpm,
          ecCount
        )
      : NAN;


  const float filteredSalPpt =
    ecOk
      ? filteredAverage(
          salPpt,
          ecCount
        )
      : NAN;


  // ==========================================================
  // RESULT
  // ==========================================================

  return {

    waterOk,

    ecOk,

    distanceCm,

    waterLevelCm,

    filteredEc,

    filteredEcUs,

    filteredTemp,

    filteredTds,

    filteredSalPpm,

    filteredSalPpt,

    distanceCount,

    ecCount,

    battery.ok,
    battery.voltageV,
    battery.percent,

    waterOk
      ? "ok"
      : distanceStatus,

    ecOk
      ? "ok"
      : ecStatus,

    battery.ok
      ? "ok"
      : battery.status
  };
}


// ============================================================
// PUSH MINUTE INTO RTC AGGREGATE
// ============================================================

void pushAggregateMinute(
  const MinuteReading &reading
) {

  if (
    aggregateCount >=
    MINUTE_RECORDS_PER_PACKET
  ) {

    aggregateCount = 0;
  }


  aggregateDistance[
    aggregateCount
  ] = reading.distanceCm;


  aggregateWaterLevel[
    aggregateCount
  ] = reading.waterLevelCm;


  aggregateEcMsCm[
    aggregateCount
  ] = reading.ecMsCm;


  aggregateEcUsCm[
    aggregateCount
  ] = reading.ecUsCm;


  aggregateTempC[
    aggregateCount
  ] = reading.temperatureC;


  aggregateTdsPpm[
    aggregateCount
  ] = reading.tdsPpm;


  aggregateSalinityPpm[
    aggregateCount
  ] = reading.salinityPpm;


  aggregateSalinityPpt[
    aggregateCount
  ] = reading.salinityPpt;

  aggregateBatteryVoltageV[
    aggregateCount
  ] = reading.batteryVoltageV;

  aggregateBatteryPercent[
    aggregateCount
  ] = reading.batteryPercent;


  aggregateCount++;
}


// ============================================================
// AVERAGE FINITE VALUES
// ============================================================

float averageFinite(
  const float *values,
  uint8_t count
) {

  float sum = 0.0f;

  uint8_t valid = 0;


  for (
    uint8_t i = 0;
    i < count;
    i++
  ) {

    if (isfinite(values[i])) {

      sum += values[i];

      valid++;
    }
  }


  return valid > 0
    ? sum / valid
    : NAN;
}


bool ina226ReadRegister(
  uint8_t reg,
  uint16_t &value
) {

  Wire.beginTransmission(INA226_ADDRESS);
  Wire.write(reg);

  if (Wire.endTransmission(false) != 0) {
    return false;
  }

  if (Wire.requestFrom(static_cast<int>(INA226_ADDRESS), 2) != 2) {
    return false;
  }

  value =
    (static_cast<uint16_t>(Wire.read()) << 8) |
    static_cast<uint16_t>(Wire.read());

  return true;
}


bool ina226WriteRegister(
  uint8_t reg,
  uint16_t value
) {

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
  const float pointsV[] = {
    2.80f, 3.00f, 3.10f, 3.20f, 3.25f, 3.30f, 3.35f, 3.40f, 3.50f, 3.60f
  };
  const float pointsPct[] = {
    0.0f, 5.0f, 10.0f, 20.0f, 40.0f, 60.0f, 80.0f, 90.0f, 98.0f, 100.0f
  };
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

  uint16_t rawShuntRegister = 0;
  if (!ina226ReadRegister(INA226_REG_SHUNT_VOLTAGE, rawShuntRegister)) {
    return {false, NAN, NAN, "shunt_read_error"};
  }

  const int16_t rawShunt =
    static_cast<int16_t>(rawShuntRegister);

  const float voltageV = rawBus * 0.00125f;
  const float shuntMv = rawShunt * 0.0025f;
  const float currentA =
    (shuntMv / 1000.0f) /
    INA226_SHUNT_OHMS;
  const float percent = estimateLifePo4Percent(voltageV);

  if (DEBUG_BATTERY_READING) {
    Serial.printf(
      "[PIN] raw_dien_ap=%u dien_ap=%.3fV raw_dong=%d dien_ap_shunt=%.4fmV dong=%.4fA phan_tram=%.1f\n",
      rawBus,
      voltageV,
      rawShunt,
      shuntMv,
      currentA,
      percent
    );
  }

  return {true, voltageV, percent, "ok"};
}


// ============================================================
// BUILD AGGREGATE
// ============================================================

AggregateReading buildAggregateReading() {

  return {

    averageFinite(
      aggregateDistance,
      aggregateCount
    ),

    averageFinite(
      aggregateWaterLevel,
      aggregateCount
    ),

    averageFinite(
      aggregateEcMsCm,
      aggregateCount
    ),

    averageFinite(
      aggregateEcUsCm,
      aggregateCount
    ),

    averageFinite(
      aggregateTempC,
      aggregateCount
    ),

    averageFinite(
      aggregateTdsPpm,
      aggregateCount
    ),

    averageFinite(
      aggregateSalinityPpm,
      aggregateCount
    ),

    averageFinite(
      aggregateSalinityPpt,
      aggregateCount
    ),

    averageFinite(
      aggregateBatteryVoltageV,
      aggregateCount
    ),

    averageFinite(
      aggregateBatteryPercent,
      aggregateCount
    ),

    aggregateCount
  };
}


// ============================================================
// BUILD MINUTE JSON
// ============================================================

String buildMinutePayload(
  const MinuteReading &reading
) {

  String payload;

  payload.reserve(520);


  payload +=
    "{\"type\":\"minute_reading\"";


  payload +=
    ",\"station_id\":\"";

  payload += STATION_ID;

  payload += "\"";


  payload +=
    ",\"firmware_version\":\"";

  payload += FIRMWARE_VERSION;

  payload += "\"";


  payload +=
    ",\"uptime_ms\":";

  payload +=
    String(millis());


  payload +=
    ",\"sensor_height_cm\":";

  payload +=
    String(
      SENSOR_HEIGHT_CM,
      1
    );


  payload +=
    ",\"distance_cm\":";

  payload +=
    numberOrNull(
      reading.distanceCm,
      1
    );


  payload +=
    ",\"water_level_cm\":";

  payload +=
    numberOrNull(
      reading.waterLevelCm,
      1
    );


  payload +=
    ",\"ec_ms_cm\":";

  payload +=
    numberOrNull(
      reading.ecMsCm,
      3
    );


  payload +=
    ",\"ec_us_cm\":";

  payload +=
    numberOrNull(
      reading.ecUsCm,
      1
    );


  payload +=
    ",\"temperature_c\":";

  payload +=
    numberOrNull(
      reading.temperatureC,
      2
    );


  payload +=
    ",\"tds_ppm\":";

  payload +=
    numberOrNull(
      reading.tdsPpm,
      1
    );


  payload +=
    ",\"salinity_ppm\":";

  payload +=
    numberOrNull(
      reading.salinityPpm,
      1
    );


  payload +=
    ",\"salinity_ppt\":";

  payload +=
    numberOrNull(
      reading.salinityPpt,
      3
    );


  payload +=
    ",\"battery_voltage_v\":";

  payload +=
    numberOrNull(
      reading.batteryVoltageV,
      2
    );


  payload +=
    ",\"battery_percent\":";

  payload +=
    numberOrNull(
      reading.batteryPercent,
      1
    );


  payload +=
    ",\"valid_distance_samples\":";

  payload +=
    String(
      reading.validDistanceSamples
    );


  payload +=
    ",\"valid_ec_samples\":";

  payload +=
    String(
      reading.validEcSamples
    );


  payload +=
    ",\"ultrasonic_status\":\"";

  payload +=
    reading.ultrasonicStatus;

  payload += "\"";


  payload +=
    ",\"ec_status\":\"";

  payload +=
    reading.ecStatus;

  payload += "\"";


  payload +=
    ",\"battery_status\":\"";

  payload +=
    reading.batteryStatus;

  payload += "\"}";


  return payload;
}


// ============================================================
// BUILD AGGREGATE JSON
// ============================================================

String buildAggregatePayload(
  const AggregateReading &reading,
  const char *messageId
) {

  String payload;

  payload.reserve(620);


  payload +=
    "{\"type\":\"station_summary\"";


  payload +=
    ",\"station_id\":\"";

  payload += STATION_ID;

  payload += "\"";


  payload +=
    ",\"firmware_version\":\"";

  payload += FIRMWARE_VERSION;

  payload += "\"";


  payload +=
    ",\"message_id\":\"";

  payload += messageId;

  payload += "\"";


  payload +=
    ",\"sequence\":";

  payload +=
    String(sequenceNumber);


  payload +=
    ",\"uptime_ms\":";

  payload +=
    String(millis());


  payload +=
    ",\"summary_minutes\":";

  payload +=
    String(
      reading.minuteCount
    );


  payload +=
    ",\"sensor_height_cm\":";

  payload +=
    String(
      SENSOR_HEIGHT_CM,
      1
    );


  payload +=
    ",\"distance_cm\":";

  payload +=
    numberOrNull(
      reading.distanceCm,
      1
    );


  payload +=
    ",\"water_level_cm\":";

  payload +=
    numberOrNull(
      reading.waterLevelCm,
      1
    );


  payload +=
    ",\"ec_ms_cm\":";

  payload +=
    numberOrNull(
      reading.ecMsCm,
      3
    );


  payload +=
    ",\"ec_us_cm\":";

  payload +=
    numberOrNull(
      reading.ecUsCm,
      1
    );


  payload +=
    ",\"temperature_c\":";

  payload +=
    numberOrNull(
      reading.temperatureC,
      2
    );


  payload +=
    ",\"tds_ppm\":";

  payload +=
    numberOrNull(
      reading.tdsPpm,
      1
    );


  payload +=
    ",\"salinity_ppm\":";

  payload +=
    numberOrNull(
      reading.salinityPpm,
      1
    );


  payload +=
    ",\"salinity_ppt\":";

  payload +=
    numberOrNull(
      reading.salinityPpt,
      3
    );


  payload +=
    ",\"battery_voltage_v\":";

  payload +=
    numberOrNull(
      reading.batteryVoltageV,
      2
    );


  payload +=
    ",\"battery_percent\":";

  payload +=
    numberOrNull(
      reading.batteryPercent,
      1
    );


  payload += "}";


  return payload;
}


// ============================================================
// JSON UINT FIELD PARSER
// ============================================================

uint32_t extractUintField(
  const String &json,
  const char *field,
  uint32_t fallback
) {

  String key = "\"";

  key += field;

  key += "\":";


  const int start =
    json.indexOf(key);


  if (start < 0) {
    return fallback;
  }


  const int valueStart =
    start + key.length();


  int valueEnd =
    valueStart;


  while (
    valueEnd < json.length() &&
    isDigit(
      json[valueEnd]
    )
  ) {

    valueEnd++;
  }


  if (
    valueEnd ==
    valueStart
  ) {

    return fallback;
  }


  return static_cast<uint32_t>(
    json
      .substring(
        valueStart,
        valueEnd
      )
      .toInt()
  );
}


// ============================================================
// GATEWAY COMMANDS: CONFIG + POLL
// ============================================================

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

  const uint32_t currentSeconds = configuredSleepIntervalMs / 1000UL;
  const uint32_t sleepSeconds = extractUintField(
    json,
    "sleep_interval_seconds",
    currentSeconds
  );

  configuredSleepIntervalMs = min<uint32_t>(86400UL, sleepSeconds) * 1000UL;
  Serial.printf("[CONFIG] ngu=%lu giay\n", configuredSleepIntervalMs / 1000UL);
}

void sendNoDataStatus() {
  if (!loraReady) {
    return;
  }

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
  if (!loraReady) {
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

// ============================================================
// WAIT FOR LORA ACK
// ============================================================

bool waitForAck(
  const char *messageId,
  uint32_t timeoutMs
) {

  if (!loraReady) {
    return false;
  }

  const uint32_t startedAt =
    millis();


  String line;


  while (
    millis() - startedAt <
    timeoutMs
  ) {

    serviceWatchdog();


    while (
      loraSerial.available() > 0
    ) {

      const char c =
        static_cast<char>(
          loraSerial.read()
        );


      if (c == '\n') {

        line.trim();


        if (
          line.indexOf(
            "\"type\":\"ack\""
          ) >= 0 &&

          line.indexOf(
            messageId
          ) >= 0
        ) {

          return true;
        }


        applyConfigCommand(line);


        line = "";
      }


      else if (c != '\r') {

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


// ============================================================
// DEEP SLEEP
// ============================================================

void maybeEnterConfiguredSleep() {

  if (
    configuredSleepIntervalMs == 0
  ) {

    return;
  }


  Serial.printf(
    "[NGUON] Ngu sau %lu giay\n",
    configuredSleepIntervalMs /
    1000UL
  );


  Serial.flush();


  esp_sleep_enable_timer_wakeup(
    static_cast<uint64_t>(
      configuredSleepIntervalMs
    ) * 1000ULL
  );


  esp_deep_sleep_start();
}


// ============================================================
// SEND AGGREGATE
// ============================================================

void sendAggregateIfReady() {

  if (aggregateCount < MINUTE_RECORDS_PER_PACKET) {
    return;
  }

  // Only transmit after this station was explicitly polled.
  if (!gatewayPollPending) {
    return;
  }
  gatewayPollPending = false;

  if (!loraReady) {
    Serial.println("[LORA] UART dang tat - giu goi tong hop de gui lai");
    return;
  }

  if (pendingSequence == 0) {
    sequenceNumber++;
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
  const String payload = buildAggregatePayload(aggregate, messageId);

  Serial.printf("[LORA] Gateway poll -> bat dau BURST %u lan cho %s\n",
                LORA_TX_BURST_COUNT,
                messageId);
  Serial.println(payload);

  // Give the gateway/module time to finish TX->RX switching after the poll.
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

  Serial.printf(
    "[LORA] Ket qua %s: %s, da_gui=%u\n",
    messageId,
    ackOk ? "da_nhan" : "chua_nhan_duoc",
    sentCopies
  );

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
    Serial.println("[LORA] Gateway da xac nhan - xoa aggregate");
    aggregateCount = 0;
    pendingSequence = 0;
    maybeEnterConfiguredSleep();
  } else {
    Serial.println("[LORA] Het burst van khong ACK - GIU aggregate + message_id cho poll sau");
  }
}


// ============================================================
// SIMPLE LORA QoS1 WIRE PROTOCOL
// ============================================================
// No poll, no long JSON over LoRa.
// Packet: S1|seq|minutes|distance|water|ec_ms|temp|tds|sal_ppt|bat_v|bat_pct|CRC16
// ACK:    A1|seq
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
  body.reserve(140);
  body += "S1|";
  body += String(seq);
  body += "|"; body += String(r.minuteCount);
  body += "|"; body += simpleFloat(r.distanceCm, 1);
  body += "|"; body += simpleFloat(r.waterLevelCm, 1);
  body += "|"; body += simpleFloat(r.ecMsCm, 3);
  body += "|"; body += simpleFloat(r.temperatureC, 1);
  body += "|"; body += simpleFloat(r.tdsPpm, 0);
  body += "|"; body += simpleFloat(r.salinityPpt, 3);
  body += "|"; body += simpleFloat(r.batteryVoltageV, 2);
  body += "|"; body += simpleFloat(r.batteryPercent, 1);

  char crcHex[5];
  snprintf(crcHex, sizeof(crcHex), "%04X", simpleCrc16(body));
  body += "|";
  body += crcHex;
  return body;
}

bool waitSimpleAck(uint32_t seq, uint32_t timeoutMs) {
  String expected = "A1|" + String(seq);
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
  // No polling/config protocol is used in this reliability test build.
}

void sendAggregateIfReadySimple() {
  if (aggregateCount < MINUTE_RECORDS_PER_PACKET || !loraReady) return;

  const uint32_t now = millis();
  if (simpleNextTxMs != 0 && static_cast<int32_t>(now - simpleNextTxMs) < 0) return;

  if (pendingSequence == 0) {
    sequenceNumber += 1;
    pendingSequence = sequenceNumber;
    simpleTxAttempts = 0;
    // Station 1 uses the early slot; Station 2 uses a later slot.
    // Keeping the first attempts apart matters more now that both stations
    // report every minute.
    simpleNextTxMs = millis() + 350 + (esp_random() % 500);
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

  // Never give up. Keep Station 1 retries in the earlier retry slot.
  simpleNextTxMs = millis() + 1000 + (esp_random() % 900);
}

// ============================================================
// SETUP
// ============================================================

void setup() {

  // USB CDC diagnostics; ultrasonicSerial remains dedicated to UART0.
  Serial.begin(
    DEBUG_BAUD
  );


  delay(700);

  Serial.println();
  Serial.println(
    "[KHOI DONG] Tram 1 bat dau chay"
  );
  Serial.println("[DEBUG] USB CDC Serial enabled; UART0 reserved for A02YYUW");
  Serial.println("[UART MAP] UART0=A02YYUW | UART1=LoRa | UART2=EC RS485");
  Serial.println("[I2C] INA226: SDA=IO19 SCL=IO20");
  Serial.flush();


  // ----------------------------------------------------------
  // Watchdog
  // ----------------------------------------------------------

  setupWatchdog();


  // ----------------------------------------------------------
  // A02YYUW UART
  // ----------------------------------------------------------

  if (!DEBUG_SKIP_ULTRASONIC) {
    pinMode(
      A02YYUW_RX_PIN,
      INPUT_PULLUP
    );

    ultrasonicSerial.begin(
      A02YYUW_BAUD,
      SERIAL_8N1,
      A02YYUW_RX_PIN,
      -1
    );
    Serial.printf("[UART0] A02YYUW RX=IO%d baud=%lu san_sang\n",
                  A02YYUW_RX_PIN,
                  static_cast<unsigned long>(A02YYUW_BAUD));
  }


  // ----------------------------------------------------------
  // EC RS485 UART
  // ----------------------------------------------------------

  ecSerial.begin(
    EC_RS485_BAUD,
    SERIAL_8N1,
    EC_RS485_RX_PIN,
    EC_RS485_TX_PIN
  );
  Serial.printf("[UART2] EC RS485 RX=IO%d TX=IO%d baud=%lu san_sang\n",
                EC_RS485_RX_PIN, EC_RS485_TX_PIN,
                static_cast<unsigned long>(EC_RS485_BAUD));

  if (EC_RS485_DE_RE_PIN >= 0) {
    pinMode(
      EC_RS485_DE_RE_PIN,
      OUTPUT
    );

    setEcRs485Transmit(false);
  }

  scanEcModbus();


  // ----------------------------------------------------------
  // LoRa UART
  // ----------------------------------------------------------

  Serial.println(
    "[LORA] Dang khoi dong UART"
  );
  Serial.flush();

  if (DEBUG_DISABLE_LORA_UART) {
    loraReady = false;

    Serial.println(
      "[LORA] UART dang tat de giu man hinh Serial"
    );
  } else {
    loraSerial.begin(
      LORA_UART_BAUD,
      SERIAL_8N1,
      LORA_UART_RX_PIN,
      LORA_UART_TX_PIN
    );

    loraReady = true;
    Serial.printf("[UART1] LoRa RX=IO%d TX=IO%d baud=%lu san_sang\n",
                  LORA_UART_RX_PIN, LORA_UART_TX_PIN,
                  static_cast<unsigned long>(LORA_UART_BAUD));
  }


  // ----------------------------------------------------------
  // I2C + INA226 battery monitor
  // ----------------------------------------------------------

  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  Wire.setClock(I2C_CLOCK_HZ);
  ina226Ready = setupIna226();


  // ----------------------------------------------------------
  // ----------------------------------------------------------
  // Startup information
  // ----------------------------------------------------------

  Serial.println();

  Serial.println(
    "[HORIZON] Tram 1 do muc nuoc dang khoi dong"
  );


  Serial.printf(
    "[HORIZON] Tram: %s\n",
    STATION_ID
  );


  Serial.printf(
    "[HORIZON] Phien ban: %s\n",
    FIRMWARE_VERSION
  );


  Serial.printf(
    "[SIEU AM] Chi dung chan RX IO%d\n",
    A02YYUW_RX_PIN
  );

  Serial.println(
    "[SIEU AM] Da bat keo len cho chan RX"
  );

  Serial.printf(
    "[SIEU AM] trang_thai=%s\n",
    DEBUG_SKIP_ULTRASONIC
      ? "tat_de_debug_pin"
      : "bat"
  );

  Serial.printf(
    "[SIEU AM] Loc mau: trung_vi +/- %.1f cm, bo cuc tri roi lay trung binh\n",
    A02YYUW_MAX_MEDIAN_DEVIATION_CM
  );


  Serial.printf(
    "[SIEU AM] Chieu cao cam bien: %.1f cm\n",
    SENSOR_HEIGHT_CM
  );


  Serial.printf(
    "[EC NUOC] dia_chi=%u baud=%lu\n",
    activeEcSlaveId,
    static_cast<unsigned long>(
      activeEcRs485Baud
    )
  );


  Serial.printf(
    "[EC NUOC] TX=%d RX=%d\n",
    EC_RS485_TX_PIN,
    EC_RS485_RX_PIN
  );

  Serial.printf(
    "[EC NUOC] trang_thai=%s\n",
    DEBUG_SKIP_EC
      ? "tat_de_debug_pin"
      : "bat"
  );

  if (EC_RS485_DE_RE_PIN >= 0) {
    Serial.printf(
      "[EC NUOC] DE/RE=IO%d\n",
      EC_RS485_DE_RE_PIN
    );
  } else {
    Serial.println(
      "[EC NUOC] RS485 tu dong doi chieu"
    );
  }

  Serial.printf(
    "[EC NUOC] in khung Modbus=%s\n",
    DEBUG_MODBUS_FRAMES ? "bat" : "tat"
  );

  Serial.printf(
    "[I2C] SDA=%d SCL=%d INA226=0x%02X pin=%s\n",
    I2C_SDA_PIN,
    I2C_SCL_PIN,
    INA226_ADDRESS,
    ina226Ready ? "san_sang" : "khong_co"
  );

  Serial.printf(
    "[PIN] dien_tro_shunt=%.3f ohm in_kiem_thu=%s\n",
    INA226_SHUNT_OHMS,
    DEBUG_BATTERY_READING ? "bat" : "tat"
  );

  Serial.println("[LORA] SIMPLE QoS1: goi ngan + retry vo han den khi ACK");

  Serial.printf(
    "[LORA] RX=%d TX=%d baud=%lu trang_thai=%s\n",
    LORA_UART_RX_PIN,
    LORA_UART_TX_PIN,
    static_cast<unsigned long>(
      LORA_UART_BAUD
    ),
    loraReady ? "san_sang" : "dang_tat"
  );


  Serial.println("[LOG] Luu du lieu flash: tat");


  Serial.printf(
    "[RTC] so_thu_tu=%lu so_ban_ghi=%u goi_cho_xac_nhan=%lu\n",

    static_cast<unsigned long>(
      sequenceNumber
    ),

    aggregateCount,

    static_cast<unsigned long>(
      pendingSequence
    )
  );

  Serial.printf(
    "[CAU HINH] che_do=%s mau_moi_phut=%u mau_hop_le_toi_thieu=%u tong_hop=%u chu_ky_do=%lu giay\n",
    LORA_TEST_FAST_SEND ? "kiem_thu_nhanh" : "chay_that",
    RAW_SAMPLES_PER_MINUTE,
    MIN_VALID_RAW_SAMPLES,
    MINUTE_RECORDS_PER_PACKET,
    static_cast<unsigned long>(
      SAMPLE_INTERVAL_MS / 1000UL
    )
  );

  Serial.println(
    "[HORIZON] Khoi dong xong, san sang do va gui du lieu"
  );
}


// ============================================================
// LOOP
// ============================================================

void loop() {

  // Watchdog disabled for debugging; no manual reset required.

  // ----------------------------------------------------------
  // Check incoming LoRa commands
  // ----------------------------------------------------------

  readLoRaCommandsSimple();

  // If a poll just arrived and an aggregate is ready, transmit immediately.
  sendAggregateIfReadySimple();

  // When a packet is waiting for ACK, keep the station in a short
  // LoRa retry loop. Starting another sensor cycle here can block long enough
  // to miss ACK/retry windows and can also overwrite the aggregate buffer.
  if (pendingSequence != 0) {
    delay(20);
    return;
  }


  // ----------------------------------------------------------
  // Sampling interval
  // ----------------------------------------------------------

  const uint32_t now =
    millis();


  if (
    lastSampleMs != 0 &&

    now - lastSampleMs <
    SAMPLE_INTERVAL_MS
  ) {

    delay(20);

    return;
  }


  // ----------------------------------------------------------
  // Collect one minute record
  // ----------------------------------------------------------

  if (DEBUG_PRINT_SENSOR_CYCLE) {
    Serial.println(
      "[CAM BIEN] Dang lay mau..."
    );
  }


  const MinuteReading minute =
    collectMinuteReading();


  // Important:
  // start the next 1-minute interval AFTER
  // this measurement cycle has completed.
  lastSampleMs =
    millis();


  // ----------------------------------------------------------
  // Log minute record
  // ----------------------------------------------------------

  const String minutePayload =
    buildMinutePayload(
      minute
    );


  Serial.printf("[LOG-MINUTE] %s\n", minutePayload.c_str());


  // ----------------------------------------------------------
  // Add to aggregate
  // ----------------------------------------------------------

  pushAggregateMinute(
    minute
  );


  if (DEBUG_PRINT_AGGREGATE_STATUS) {
    Serial.printf(
      "[TONG HOP] %u/%u phut\n",

      aggregateCount,

      MINUTE_RECORDS_PER_PACKET
    );
  }


  // ----------------------------------------------------------
  // Send every 1 minute
  // ----------------------------------------------------------

  sendAggregateIfReadySimple();
}
