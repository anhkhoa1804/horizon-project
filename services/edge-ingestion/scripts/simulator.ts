import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ingestTelemetry, signPayload, MockDb } from '../src/index.js';
import type { IngestConfig } from '../src/ingest.js';
import type { TelemetryPayloadV1 } from '../src/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const webMockDir = path.join(repoRoot, 'apps', 'web', 'mock');

const stations = [
  { id: 'STATION_01', name: 'Con Ho North', lat: 10.245, lng: 105.82, status: 'active' as const, secret: 'station-secret-01' },
  { id: 'STATION_02', name: 'Con Ho South', lat: 10.2385, lng: 105.826, status: 'active' as const, secret: 'station-secret-02' },
  { id: 'STATION_03', name: 'Canal Gate West', lat: 10.2421, lng: 105.832, status: 'active' as const, secret: 'station-secret-03' },
];

const deviceSecrets = Object.fromEntries(stations.map((station) => [station.id, station.secret]));
const otaCatalog = {
  STATION_01: { update_available: true, target_version: '1.0.3', binary_url: 'https://example.com/ota/station-01.bin', sha256: 'mock', size_bytes: 1432200 },
  STATION_02: { update_available: false },
  STATION_03: { update_available: false },
};

const config: IngestConfig = {
  allowedContractVersion: 'v1',
  maxTimestampDriftSeconds: 300,
};

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function generatePayload(stationIndex: number, now: number): TelemetryPayloadV1 {
  const station = stations[stationIndex];
  const drift = Math.sin((stationIndex + now / 5000) * 0.9);
  const salinity = round(1.02 + stationIndex * 0.18 + drift * 0.08, 2);
  const waterLevel = round(54 - stationIndex * 1.8 + drift * 2.2, 1);
  const battery = round(3.98 - stationIndex * 0.09, 2);
  const signal = -82 - stationIndex * 4;

  return {
    contract_version: 'v1',
    device_id: station.id,
    message_id: `${station.id}-${now}`,
    timestamp: now,
    salinity,
    water_level: waterLevel,
    fault_flags: station.id === 'STATION_02' ? 1 : 0,
    sensor_status: station.id === 'STATION_02' ? { ec_probe: 'warn', ultrasonic: 'ok' } : { ec_probe: 'ok', ultrasonic: 'ok' },
    battery_voltage: battery,
    signal_strength_dbm: signal,
    firmware_version: '1.0.2',
    temperature_c: 29 + stationIndex * 0.5,
  };
}

async function writeMockFiles(db: MockDb) {
  await mkdir(webMockDir, { recursive: true });
  const snapshot = db.getSnapshot();

  const latestReadings = snapshot.environmentalReadings.map((reading) => ({
    station_id: reading.station_id,
    timestamp: new Date(reading.timestamp * 1000).toISOString(),
    salinity: reading.salinity,
    water_level: reading.water_level,
    fault_flags: reading.fault_flags,
    sensor_status: {
      ec_probe: reading.ec_probe_status,
      ultrasonic: reading.ultrasonic_status,
    },
    battery_voltage: snapshot.healthLogs.find((health) => health.station_id === reading.station_id)?.battery_voltage ?? 0,
    signal_strength_dbm: snapshot.healthLogs.find((health) => health.station_id === reading.station_id)?.signal_strength_dbm ?? 0,
  }));

  const alerts = snapshot.environmentalEvents.map((event) => ({
    station_id: event.station_id,
    severity: event.severity,
    title: event.event_type === 'HIGH_SALINITY' ? 'Salinity warning' : event.event_type === 'LOW_BATTERY' ? 'Battery warning' : 'Sensor fault',
    message: event.event_type === 'HIGH_SALINITY'
      ? `Salinity crossed the alert threshold at station ${event.station_id}.`
      : event.event_type === 'LOW_BATTERY'
        ? `Battery is below the safe operating window at station ${event.station_id}.`
        : `Sensor fault requires field inspection at station ${event.station_id}.`,
  }));

  await writeFile(path.join(webMockDir, 'stations.json'), JSON.stringify(stations.map(({ secret, ...station }) => station), null, 2));
  await writeFile(path.join(webMockDir, 'latest_readings.json'), JSON.stringify(latestReadings, null, 2));
  await writeFile(path.join(webMockDir, 'alerts.json'), JSON.stringify(alerts, null, 2));
}

async function runBatch() {
  const now = Math.floor(Date.now() / 1000);
  const db = new MockDb(deviceSecrets, otaCatalog);
  const responses = [] as unknown[];

  for (let index = 0; index < stations.length; index += 1) {
    const payload = generatePayload(index, now + index);
    const signature = await signPayload(payload, deviceSecrets[payload.device_id]);
    const response = await ingestTelemetry(
      {
        headers: {
          'x-device-id': payload.device_id,
          'x-timestamp': String(payload.timestamp),
          'x-signature': signature,
          'x-contract-version': payload.contract_version,
        },
        payload,
      },
      db,
      config,
      now + index,
    );
    responses.push({ station_id: payload.device_id, response });
  }

  await writeMockFiles(db);

  console.log(JSON.stringify({ generated_at: new Date().toISOString(), responses, snapshot: db.getSnapshot() }, null, 2));
}

async function main() {
  const continuous = process.env.SIMULATOR_CONTINUOUS === '1';
  const intervalMs = Number(process.env.SIMULATOR_INTERVAL_MS || '30000');

  do {
    await runBatch();
    if (!continuous) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  } while (continuous);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
