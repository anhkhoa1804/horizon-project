/**
 * Scientific terminology — the VI ↔ EN contract.
 *
 * This file exists because the dangerous translation errors in this product
 * are not grammatical, they are semantic. Four different quantities in
 * HORIZON can all be casually called "EC", and collapsing any two of them
 * would silently misrepresent a measurement:
 *
 *   ECw   electrical conductivity of irrigation WATER (dS/m)
 *         — what FAO's guideline tables are expressed in
 *   ECe   conductivity of a SOIL SATURATION EXTRACT (dS/m)
 *         — a laboratory soil measure; HORIZON does NOT measure this
 *   soil EC  bulk conductivity read in situ by the soil probe (mS/cm)
 *         — what STATION_02 actually reports; NOT interchangeable with ECe
 *   salinity  the water station's reported salt content (‰)
 *         — derived from water EC by an as-yet uncalibrated conversion
 *
 * The English strings below are therefore chosen to preserve those
 * distinctions, not to read smoothly. "Soil EC" must never become "salinity";
 * "salinity" must never become "EC". Where a term has no honest short English
 * equivalent, the longer phrase wins.
 *
 * Units are deliberately NOT translated — ‰, dS/m, mS/cm, °C, %, dBm, V, mm
 * and km/h are the same symbols in both languages, and "translating" them
 * would be an error.
 */

export interface Term {
  vi: string;
  en: string;
  /** Unit symbol, identical across locales. `null` where the term is not a measurement. */
  unit: string | null;
  /** Why this rendering — recorded where the choice is load-bearing. */
  note?: string;
}

export const TERMINOLOGY = {
  // ---------------------------------------------------------------- water
  salinity: {
    vi: "Độ mặn",
    en: "Salinity",
    unit: "‰",
    note: "Parts per thousand, derived from water EC. NOT the same quantity as ECw and must never be labelled 'EC' in either language.",
  },
  waterLevel: { vi: "Mực nước", en: "Water level", unit: "cm" },
  ecw: {
    vi: "EC nước tưới (ECw)",
    en: "Irrigation water EC (ECw)",
    unit: "dS/m",
    note: "FAO's unit of reference. Kept explicitly tagged 'ECw' in both languages so it can never be read as the soil probe's reading.",
  },
  ece: {
    vi: "EC dịch chiết bão hòa (ECe)",
    en: "Saturation extract EC (ECe)",
    unit: "dS/m",
    note: "A laboratory soil measure HORIZON does not perform. Present in the vocabulary only so it can be named and excluded, never displayed as a station value.",
  },

  // ----------------------------------------------------------------- soil
  soilEc: {
    vi: "EC đất",
    en: "Soil EC",
    unit: "mS/cm",
    note: "In-situ bulk conductivity from the soil probe. Distinct from ECe; the two are not convertible without soil-specific calibration.",
  },
  soilMoisture: { vi: "Độ ẩm đất", en: "Soil moisture", unit: "%" },
  soilPh: { vi: "Độ pH đất", en: "Soil pH", unit: null },
  soilTemp: { vi: "Nhiệt độ đất", en: "Soil temperature", unit: "°C" },

  // ------------------------------------------------------------------ air
  airTemp: { vi: "Nhiệt độ không khí", en: "Air temperature", unit: "°C" },
  airHumidity: { vi: "Độ ẩm không khí", en: "Air humidity", unit: "%" },

  // --------------------------------------------------------------- device
  battery: { vi: "Pin", en: "Battery", unit: "V" },
  signal: { vi: "Tín hiệu", en: "Signal", unit: "dBm" },

  // -------------------------------------------------------------- network
  station: { vi: "Trạm", en: "Station", unit: null },
  gateway: {
    vi: "Gateway",
    en: "Gateway",
    unit: null,
    note: "Left untranslated in Vietnamese too — it is the term the team uses, and 'cổng' would read as a door.",
  },
  observation: { vi: "Quan trắc", en: "Observation", unit: null },
  telemetry: {
    vi: "Dữ liệu quan trắc",
    en: "Telemetry",
    unit: null,
    note: "Vietnamese avoids a transliteration; 'dữ liệu quan trắc' is what the measurement stream is actually called here.",
  },
  alert: { vi: "Cảnh báo", en: "Alert", unit: null },

  // ------------------------------------------------------------ provenance
  externalContext: {
    vi: "Bối cảnh môi trường · nguồn ngoài",
    en: "Environmental context · external source",
    unit: null,
    note: "Both renderings must carry 'external' prominently — this is the label that keeps a weather model from being read as a HORIZON sensor.",
  },
  reference: { vi: "Tham chiếu", en: "Reference", unit: null },
  unverified: { vi: "Chưa xác minh", en: "Unverified", unit: null },
  demo: { vi: "Dữ liệu minh họa", en: "Demo data", unit: null },
  freshness: { vi: "Độ mới", en: "Freshness", unit: null },
  quality: { vi: "Chất lượng đo", en: "Measurement quality", unit: null },
} satisfies Record<string, Term>;

export type TermKey = keyof typeof TERMINOLOGY;

/** The label for a term in a locale. Units come from `TERMINOLOGY[key].unit`. */
export function term(key: TermKey, locale: "vi" | "en"): string {
  return TERMINOLOGY[key][locale];
}
