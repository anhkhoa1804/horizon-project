"use client";
import { useEffect, useMemo, useState } from "react";
import { StationNetworkMap, type MapStation } from "@/components/dashboard/station-network-map";
import { ObservationLog } from "./observation-log";
import { ThresholdTable } from "./threshold-table";
import { useLiveObservatory } from "./use-live-observatory";
import { QualityIndicator, StatusIndicator } from "@/components/ui/status-indicator";
import { useDict } from "@/lib/i18n/client";
import { STATION_COORDS } from "@/lib/geo";
import type { PilotStationId } from "@/lib/publicStations";
import { stationDeviceCode } from "@/lib/stationProfile";
import type { ExternalWeather } from "@/lib/external/weather";
import type { PublicRealtimeConfig } from "@/lib/monitoring/publicRealtime";
import type { ObservatoryMetric, ObservatoryViewModel } from "@/lib/monitoring/types";
import type { ThresholdRow, SoilWaterModel } from "@/lib/monitoring/thresholdTypes";
import { buildSignalGroups } from "@/lib/monitoring/signals";
import { statusFor } from "@/lib/monitoring/status";
import { stationTrendSeries } from "@/lib/monitoring/stationSeries";

export function ObservatoryCanvas({ model: initial, realtime = null, weather: initialWeather = null, thresholds = [], soilModels = [] }: {
  model: ObservatoryViewModel; realtime?: PublicRealtimeConfig | null; weather?: ExternalWeather | null; thresholds?: ThresholdRow[]; soilModels?: SoilWaterModel[];
}) {
  const dict = useDict();
  const { model, connected } = useLiveObservatory(initial, realtime);
  const [selected, setSelected] = useState("STATION_01");
  const [weather, setWeather] = useState(initialWeather);
  useEffect(() => {
    let active = true;
    const timer = window.setInterval(async () => {
      try { const res = await fetch("/api/public/weather", { cache: "no-store" }); if (res.ok && active) setWeather((await res.json()).latest ?? null); } catch { /* Retain timestamped external context. */ }
    }, 15 * 60 * 1000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  const mapStations = useMemo<MapStation[]>(() => model.mode === "real" ? model.stations.flatMap((s) => {
    const point = STATION_COORDS[s.id as PilotStationId];
    return point ? [{ id: s.id, name: stationDeviceCode(s.id), ...point, freshness: s.freshness }] : [];
  }) : [], [model.mode, model.stations]);
  const station = model.stations.find((s) => s.id === selected) ?? model.stations[0];
  const stationSeries = useMemo(() => stationTrendSeries(model.series, station?.kind ?? "water"), [model.series, station?.kind]);
  const context = buildSignalGroups(model, weather, null).find((g) => g.domain === "context");
  const timestamp = (iso: string) => new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "medium", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(iso));
  const reading = (metric: ObservatoryMetric, prominent = false) => {
    const status = metric.value !== null ? statusFor(metric.labelKey, Number(metric.value), { salinity: model.salinityThreshold, isDemo: model.mode === "demo" }) : null;
    return <div key={metric.labelKey ?? metric.label} className={`field-reading ${prominent ? "field-reading--primary" : ""}`}>
      <dt>{metric.labelKey ? dict.metricLabels[metric.labelKey] : metric.label}</dt>
      <dd><span>{metric.value ?? "—"}</span><small>{metric.unit}</small></dd>
      {metric.provenance.observedAt && metric.provenance.observedAt !== station?.timestamp ? <p>{timestamp(metric.provenance.observedAt)}</p> : null}
      {status ? <p className={`reading-basis reading-basis--${status.level}`}>{dict.monitoring.statusBasis[status.basis]}</p> : null}
    </div>;
  };
  const waterLevel = station?.environment.flatMap((g) => g.metrics).find((m) => m.labelKey === "waterLevel");
  const hasValues = station && [station.primary, ...station.environment.flatMap((g) => g.metrics)].some((m) => m.value !== null);
  return <div className="field-observatory">
    <section id="observatory" className="field-geography" aria-label={dict.monitoring.spaceTitle}>
      <div className="field-register"><span className="field-register-title">{dict.monitoring.networkEyebrow} · Cồn Hô</span><ol>{model.stations.map((s) => <li key={s.id}><button type="button" onClick={() => setSelected(s.id)} aria-pressed={selected === s.id}><span>{stationDeviceCode(s.id)}</span><StatusIndicator status={s.freshness} dict={dict} compact /></button></li>)}</ol>{connected ? <span className="telemetry-dot" role="img" aria-label={dict.monitoring.streamConnected} title={dict.monitoring.streamConnected} /> : null}</div>
      <StationNetworkMap stations={mapStations} variant="observatory" basemapOnly={model.mode === "demo"} selectedStationId={selected} onStationSelect={setSelected} />
    </section>
    {station ? <section className="field-instrument" aria-labelledby="instrument-title">
      <header><div><p className="instrument-code">{stationDeviceCode(station.id)}</p><h2 id="instrument-title">{station.name}</h2><p>{station.location}</p></div><div className="instrument-observed">{station.timestamp ? <time dateTime={station.timestamp}>{timestamp(station.timestamp)}</time> : null}{station.timestamp ? <StatusIndicator status={station.freshness} dict={dict} compact /> : null}{station.quality && station.timestamp ? <QualityIndicator status={station.quality} dict={dict} compact /> : null}</div></header>
      {station.kind === "gateway" ? <div className="gateway-register"><strong>LoRa → Gateway → 4G</strong>{station.capabilityNote ? <p>{station.capabilityNote}</p> : null}<dl className="field-secondary">{[station.primary, ...station.device].filter((m) => m.value !== null).map((m) => reading(m))}</dl></div> : hasValues ? <>
        <dl className="field-primary">{waterLevel ? reading(waterLevel, true) : null}{reading(station.primary, true)}</dl>
        {station.environment.map((group) => <div key={group.domain} className="instrument-domain"><h3>{group.domain === "air" ? dict.monitoring.groupAir : group.domain === "soil" ? dict.monitoring.groupSoil : dict.monitoring.groupWater}</h3><dl className="field-secondary">{group.metrics.filter((m) => m !== waterLevel).map((m) => reading(m))}</dl></div>)}
        <p className="instrument-source">HORIZON · {model.mode === "demo" ? dict.monitoring.demoBannerTitle : station.kind === "water" ? "environmental_readings" : "soil_readings"}</p>
      </> : <div className="field-empty"><h3>{dict.monitoring.noTelemetry}</h3><p>{dict.monitoring.noTelemetryBody}</p></div>}
    </section> : null}
    {station?.kind !== "gateway" ? <section className={`field-trend ${stationSeries["24h"].availableMetrics.length ? "" : "field-trend--empty"}`} aria-label={dict.chart.title}><ObservationLog key={selected} series={stationSeries} preferredMetric={station?.kind === "soil" ? "soilMoisture" : "salinity"} /></section> : null}
    {context ? <section className="field-context" aria-labelledby="weather-title"><header><h2 id="weather-title">{dict.external.title}</h2><p>{context.attribution} · {dict.monitoring.originExternal}</p></header><dl className="field-secondary">{[...(context.primary ? [context.primary] : []), ...context.secondary].map((m) => reading(m))}</dl><p className="text-xs text-muted">{dict.monitoring.markerExternalLegend}</p></section> : null}
    <details id="threshold-reference" className="field-reference"><summary>{dict.monitoring.referenceTitle}</summary><p className="my-5 max-w-prose text-sm text-muted">{dict.monitoring.gateAdviceBasis}</p>{thresholds.length ? <ThresholdTable rows={thresholds} soilModels={soilModels} /> : <p className="text-sm text-muted">{dict.monitoring.gateAdviceLink}</p>}</details>
    {model.alerts.length ? <section className="field-events"><h2>{dict.monitoring.alertsEyebrow}</h2><ul>{model.alerts.map((event) => <li key={event.id}><strong>{event.stationName} · {event.title}</strong><p>{event.message}</p><time dateTime={event.timestamp}>{timestamp(event.timestamp)}</time></li>)}</ul></section> : null}
  </div>;
}
