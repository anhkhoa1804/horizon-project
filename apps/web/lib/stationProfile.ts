import type {
  StationLiveChartPoint,
  StationLiveChartSeries,
} from "@/components/stations/station-live-chart";
import type { QualityState } from "@/components/ui/status-indicator";
import type { EnvironmentalReading, SensorStatus, SoilReading, Station, TrendPoint } from "@/types";
import type { Dictionary } from "@/lib/i18n/vi";

/**
 * Pure station-profile/formatting logic, deliberately kept free of any
 * "server-only" import (unlike station-detail.tsx, which fetches data via
 * getPublicRepositories()) so it can be unit-tested directly with plain
 * `tsx --test`, not just exercised through the Server Component.
 */

export type StationKind = "water" | "soil" | "gateway";

export const NO_DATA_LABEL = "Chưa có dữ liệu";

export interface StationProfile {
  id: string;
  kind: StationKind;
  name: string;
  location: string;
  intro: string;
  chartTitle: string;
  chartNote: string;
  chartSeries: StationLiveChartSeries[];
}

export const stationProfiles: Record<string, StationProfile> = {
  STATION_01: {
    id: "STATION_01",
    kind: "water",
    name: "Trạm Nước",
    location: "Khu ven sông Cồn Hô",
    intro: "Theo dõi mực nước, độ mặn và dấu hiệu triều cường để bà con nhận biết biến động của dòng nước sớm hơn.",
    chartTitle: "Diễn biến nước 24 giờ",
    chartNote: "So sánh mực nước và độ mặn tại khu gần sông.",
    chartSeries: [
      { key: "waterLevel", name: "Mực nước", color: "#0f766e", unit: "cm" },
      { key: "salinity", name: "Độ mặn", color: "#b45309", unit: "‰" },
    ],
  },
  STATION_02: {
    id: "STATION_02",
    kind: "soil",
    name: "Trạm Đất",
    location: "Khu canh tác giữa cồn",
    intro: "Đo EC đất và độ ẩm tương đối để hỗ trợ bà con chọn thời điểm tưới, chăm sóc và trồng trọt phù hợp.",
    chartTitle: "Diễn biến đất 24 giờ",
    chartNote: "Theo dõi EC đất cùng độ ẩm ước tính tại vùng canh tác.",
    chartSeries: [
      { key: "soilEc", name: "EC đất", color: "#166534", unit: "mS/cm" },
      { key: "waterLevel", name: "Độ ẩm đất", color: "#0f766e", unit: "%" },
    ],
  },
  STATION_03: {
    id: "STATION_03",
    kind: "gateway",
    name: "Gateway",
    location: "Điểm gửi dữ liệu cuối cồn",
    intro: "Tổng hợp dữ liệu từ các trạm và chuyển thông tin nhanh chóng về cho bà con qua các kênh liên lạc quen dùng.",
    chartTitle: "Trạng thái gửi dữ liệu 24 giờ",
    chartNote: "Theo dõi tỷ lệ gửi dữ liệu và tín hiệu kết nối của gateway.",
    chartSeries: [
      { key: "deliveryRate", name: "Tỷ lệ gửi", color: "#166534", unit: "%" },
      { key: "waterLevel", name: "Tín hiệu", color: "#0f766e", unit: "%" },
    ],
  },
};

export function stationStatusLabel(status: string | undefined, dict: Dictionary): string {
  switch (status) {
    case "active":
      return dict.stationProfiles.statusActive;
    case "maintenance":
      return dict.stationProfiles.statusMaintenance;
    case "offline":
    case "inactive":
      return dict.stationProfiles.statusOffline;
    default:
      return "Không rõ trạng thái";
  }
}

export function formatSalinityValue(value: number | null): string {
  return value === null ? NO_DATA_LABEL : `${value.toFixed(2)}‰`;
}

export function formatWaterValue(value: number | null): string {
  return value === null ? NO_DATA_LABEL : `${Math.round(value)} cm`;
}

export function formatVoltage(value: number | null): string {
  return value === null ? NO_DATA_LABEL : `${value.toFixed(2)} V`;
}

export function formatSignal(value: number | null): string {
  return value === null ? NO_DATA_LABEL : `${value} dBm`;
}

export function formatSoilEc(value: number | null): string {
  return value === null ? NO_DATA_LABEL : `${value.toFixed(2)} mS/cm`;
}

export function formatPercent(value: number | null): string {
  return value === null ? NO_DATA_LABEL : `${value.toFixed(1)}%`;
}

export function formatCelsius(value: number | null): string {
  return value === null ? NO_DATA_LABEL : `${value.toFixed(1)}°C`;
}

export function formatPh(value: number | null): string {
  return value === null ? NO_DATA_LABEL : value.toFixed(1);
}

export function profileFor(stationId: string, station?: Station | null): StationProfile | null {
  if (stationProfiles[stationId]) return stationProfiles[stationId];
  if (!station) return null;

  return {
    id: station.id,
    kind: "water",
    name: station.name,
    location: "Điểm quan trắc Cồn Hô",
    intro: "Theo dõi dữ liệu môi trường tại trạm quan trắc.",
    chartTitle: "Diễn biến 24 giờ",
    chartNote: "Dữ liệu mới nhất được ghi nhận tại trạm.",
    chartSeries: [
      { key: "waterLevel", name: "Mực nước", color: "#0f766e", unit: "cm" },
      { key: "salinity", name: "Độ mặn", color: "#b45309", unit: "‰" },
    ],
  };
}

/**
 * Only "water" stations have real per-point trend data today
 * (environmental_readings carries salinity/water_level only). Soil and
 * gateway kinds have no backing columns yet — render the empty state
 * rather than inventing values for series the schema can't support.
 */
export function chartDataFrom(profile: StationProfile, trend: TrendPoint[]): StationLiveChartPoint[] {
  if (profile.kind !== "water") {
    return [];
  }

  return trend.map((point) => ({
    label: new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(new Date(point.timestamp)),
    salinity: Number(point.salinity.toFixed(2)),
    waterLevel: Number(point.water_level.toFixed(1)),
  }));
}

export function readingSummary(
  profile: StationProfile,
  reading: EnvironmentalReading | null | undefined,
  threshold?: { warningLevel: number; criticalLevel: number } | null,
  soilReading?: SoilReading | null,
) {
  const salinity = reading?.salinity ?? null;
  const waterLevel = reading?.water_level ?? null;

  if (profile.kind === "soil") {
    return {
      salinity,
      waterLevel,
      soilEc: soilReading?.soil_ec_ms_cm ?? null,
      recommendation: soilReading
        ? "Dữ liệu đất mới nhất đã được ghi nhận — tham khảo các chỉ số bên dưới trước khi tưới hoặc chăm sóc."
        : "Chưa có dữ liệu đất thực tế từ trạm này để đưa ra khuyến nghị.",
      riskLabel: null as string | null,
    };
  }

  if (profile.kind === "gateway") {
    return {
      salinity,
      waterLevel,
      soilEc: null as number | null,
      recommendation: "Gateway đang ưu tiên gửi dữ liệu mới nhất về hệ thống để thông tin đến bà con nhanh chóng.",
      riskLabel: null as string | null,
    };
  }

  const criticalLevel = threshold?.criticalLevel ?? 1.8;
  const warningLevel = threshold?.warningLevel ?? 1.2;
  const riskLabel =
    salinity === null ? null : salinity >= criticalLevel ? "Nguy cơ cao" : salinity >= warningLevel ? "Đang tăng" : "An toàn";
  const recommendation =
    salinity === null
      ? "Chưa có dữ liệu độ mặn mới nhất từ trạm này."
      : salinity >= criticalLevel
        ? "Độ mặn đang cao, bà con nên hạn chế lấy nước trực tiếp cho cây nhạy mặn."
        : salinity >= warningLevel
          ? "Độ mặn có dấu hiệu tăng, nên theo dõi thêm trước khi tưới hoặc lấy nước."
          : "Dữ liệu nước đang ở mức tương đối ổn định, tiếp tục quan sát theo từng con nước.";

  return { salinity, waterLevel, soilEc: null as number | null, recommendation, riskLabel };
}

export function sensorStatusLabel(status?: SensorStatus | null): string {
  switch (status) {
    case "ok":
      return "Hoạt động bình thường";
    case "warn":
      return "Cần chú ý";
    case "fault":
      return "Cần kiểm tra cảm biến";
    case "unknown":
      return "Không có trạng thái cảm biến";
    default:
      return "Chưa có dữ liệu";
  }
}

export function qualityFor(profile: StationProfile, reading: EnvironmentalReading | null): QualityState {
  if (profile.kind !== "water" || !reading) return "valid";
  const hasFault = reading.fault_flags > 0 || reading.ec_probe_status === "fault" || reading.ultrasonic_status === "fault";
  if (hasFault) return "error";
  return reading.ec_probe_status === "unknown" || reading.ultrasonic_status === "unknown"
    ? "estimated"
    : "valid";
}

/**
 * The reader-facing text for a station, in the reader's language.
 *
 * `stationProfiles` above stays the STRUCTURAL source — id, kind, series
 * keys, colours, units — and its Vietnamese strings remain only as the
 * fallback for an id the dictionary does not know. Display text comes from
 * here so that "Trạm Nước" becomes "Water Station" when the interface is
 * English. Only "Cồn Hô" stays put; it is a place name.
 */
export function stationText(
  id: string,
  dict: Dictionary,
): { name: string; location: string; intro: string; chartTitle: string; chartNote: string } {
  const localized = dict.stationProfiles[id as "STATION_01" | "STATION_02" | "STATION_03"];
  if (localized) return localized;

  const profile = stationProfiles[id];
  return {
    name: profile?.name ?? id,
    location: profile?.location ?? "",
    intro: profile?.intro ?? "",
    chartTitle: profile?.chartTitle ?? "",
    chartNote: profile?.chartNote ?? "",
  };
}
