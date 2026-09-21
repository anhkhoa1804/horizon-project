import { TERMINOLOGY } from "./terminology";
import type { Dictionary } from "./vi";

/**
 * English.
 *
 * Typed as `Dictionary` (the shape of `vi`), so a missing or misspelled key
 * is a compile error rather than a blank string in production. Adding a
 * Vietnamese key without its English counterpart will not build.
 *
 * On register: this is written the way the HORIZON team would explain their
 * own project to a researcher or funder who reads English — plain, specific,
 * and willing to say what is not working. It is deliberately not marketing
 * copy, and it does not soften the pilot's limitations: "equipment not yet
 * installed in the field" says the same thing in both languages.
 *
 * Measurement labels come from lib/i18n/terminology.ts rather than being
 * retyped here, because that is where the ECw / ECe / soil EC / salinity
 * distinctions are documented and enforced.
 */
export const en: Dictionary = {
  meta: {
    siteName: "HORIZON",
    titleDefault: "HORIZON - Frogsleap Vietnam",
    description:
      "A small-scale environmental monitoring pilot at Cồn Hô, Vĩnh Long — water level, salinity and soil condition, published openly and honestly.",
  },

  nav: {
    home: "Home",
    about: "About",
    monitoring: "Monitoring",
    report: "Report",
    admin: "Admin",
    primaryLabel: "Main navigation",
    mobileLabel: "Mobile navigation",
    footerLabel: "Footer navigation",
  },

  controls: {
    toDark: "Switch to dark theme",
    toLight: "Switch to light theme",
    languageLabel: "Language",
    switchToVietnamese: "Switch to Vietnamese",
    switchToEnglish: "Switch to English",
  },

  footer: {
    place: "Cồn Hô · Vĩnh Long",
    copyright: "© Magnus",
  },

  common: {
    noData: "No data yet",
    noMeasurement: "No measurement yet",
    notMeasured: "Not measured",
    loading: "Loading…",
    viewStation: "View station",
    viewDetail: "Details",
    stationPage: "Station page",
    back: "Back",
    continue: "Continue",
    updated: "Updated",
    source: "Source",
    translationPending:
      "The long-form content on this page is currently Vietnamese only. An English edition is being written — this project does not machine-translate technical writing.",
  },

  freshness: {
    live: "Reporting",
    recent: "Recent",
    stale: "Stale",
    offline: "Offline",
    neverConnected: "Never connected",
    unavailable: "No data yet",
  },

  reportCategories: {
    erosion: "Riverbank erosion",
    flooding: "Flooding / tidal",
    pollution: "Pollution",
    infrastructure: "Infrastructure damage",
    sensor: "Monitoring station fault",
    other: "Other",
  },

  alerts: {
    critical: "Critical",
    warning: "Warning",
    info: "Information",
    normal: "Normal",
    highSalinity: "Salinity alert",
    sensorFault: "Sensor fault",
    lowBattery: "Low battery",
    offline: "Weak signal",
    noDetail: "No further detail",
    salinityDetail: "Salinity {value}‰ (threshold {threshold}‰)",
    batteryDetail: "Battery {value} V",
    signalDetail: "Signal {value} dBm",
  },

  quality: {
    valid: "Measured directly",
    estimated: "Estimated value",
    error: "Sensor fault",
  },

  provenance: {
    telemetry: "Direct measurement",
    historical: "Earlier measurement",
    reference: "Reference source",
    demo: "Demo data",
    unavailable: "No data yet",
    external: "Outside the HORIZON network",
    lastObserved: "Last observed",
    unverifiedSource: "No verified reference source yet.",
    lastChecked: "Last checked",
  },

  monitoring: {
    eyebrow: "Live monitoring",
    title: "Observatory",
    subtitle: "Every reading in the network on one canvas — each marked with where it came from.",
    sendReport: "Submit a field report",

    demoBannerTitle: "DEMO DATA",
    demoBannerBody:
      "the station figures on this page are synthetic, shown to demonstrate the interface — they are not real observations from Cồn Hô. Values marked * are real data from an external source.",
    demoBannerLink: "View real data →",

    networkEyebrow: "Network",
    stationsCounted: "monitoring stations",
    sendingData: "reporting",
    noneSending: "no station is reporting yet",
    lastObservation: "Last observation",
    neverObserved: "The system has not received any observation from the network.",
    noDataCount: "with no data",
    offlineCount: "offline",
    allOperational: "Whole network operational",
    needsAttention: "Need attention",

    groupWater: "Water",
    groupSoil: "Soil",
    groupAir: "Air",
    groupInfrastructure: "Infrastructure",
    groupContext: "Regional context",

    markerExternalLegend: "From outside the HORIZON network — regional figures, not a measurement at a station.",
    markerDemoLegend: "Demo data, not a real observation.",
    originHorizon: "HORIZON",
    originExternal: "External",

    signalsEyebrow: "Environmental signals",
    signalsTitle: "What the network measures",
    primarySignals: "Primary signals",
    secondarySignals: "Supporting signals",

    notInFirmware: "Not measured by current firmware",
    capabilityOnly: "The system can measure this; no reading yet",

    alertsEyebrow: "Events",
    alertsActive: "active",
    noAlerts: "No alerts",
    noAlertsDetail: "the network has not recorded any event needing attention",

    spaceEyebrow: "Space",
    spaceTitle: "Station locations",

    referenceEyebrow: "Reference",
    referenceTitle: "REFERENCES & THRESHOLDS",
    statusBasis: {
      configured: "Active",
      device: "Device",
      reference: "Reference",
      pilot: "Pilot",
      quality: "Measurement quality",
      demo: "Demo",
    },
    standingExternal: "International source",
    standingInternal: "Project configuration",
    standingUnverified: "Unverified",
  },

  external: {
    eyebrow: "Environmental context · external source",
    title: "Regional weather",
    temperature: "Temperature",
    humidity: "Humidity",
    wind: "Wind",
    precipitation: "Precipitation",
    disclaimerBefore: "Regional grid forecast from",
    disclaimerAfter: ", not a measurement from HORIZON equipment at Cồn Hô.",
    modelTime: "Model time",
    unavailable:
      "Could not reach the external weather source. This section will return when the connection succeeds — no substitute value is filled in here.",
  },

  chart: {
    eyebrow: "Observation log",
    boxLabel: "Log",
    metricControl: "Metric",
    rangeControl: "Time range",
    title: "Change over time",
    range24h: "24 hours",
    range7d: "7 days",
    range30d: "30 days",
    axisShows: "Axis shows",
    observations: "observations",
    thisRange: "this range",
    noObservationsIn: "No observations in the last {range}",
    noObservationsBody:
      "When a station reports within this period the chart will appear here. No line is drawn in its place.",
    metrics: {
      waterEc: "Water EC",
      waterTemp: "Water temperature",
      salinity: "Salinity",
      waterLevel: "Water level",
      soilMoisture: "Soil moisture",
      soilEc: "Soil EC",
      soilPh: "pH",
      soilTemp: "Soil temperature",
      airTemp: "Air temperature",
      airHumidity: "Air humidity",
      weatherTemp: "Open-Meteo temperature",
      weatherHumidity: "Open-Meteo humidity",
      weatherWind: "Open-Meteo wind",
      weatherPrecipitation: "Open-Meteo rainfall",
    },
  },

  home: {
    eyebrow: "HORIZON · Cồn Hô, Vĩnh Long",
    /* Not a literal rendering of the Vietnamese — same thesis, same visual
       weight, idiomatic English. Both languages are two lines on desktop and
       within a few characters of each other, so the hero does not change
       height when a reader switches. */
    title: "This is Cồn Hô.\nThis is HORIZON.",
    subtitle:
      "Three field points record water, soil, and the data link at Cồn Hô.",
    ctaPrimary: "View the monitoring network",
    pilotNote: "Field infrastructure is being completed and verified at Cồn Hô.",
  },

  about: {
    eyebrow: "About",
    title: "HORIZON, and how it was built.",
    subtitle: "What the project does, how the system works, and what is still unfinished.",
  },

  station: {
    operationalStatus: "Operational status",
    primaryMetric: "Primary reading",
    otherStations: "Other stations",
    networkEyebrow: "Network",
    locationEyebrow: "Location",
    locationTitle: "Geographic context",
    backToMonitoring: "Back to the observatory",
    reportNearby: "Report near this station",

    outsideNetwork: "Outside the network",
    measurementQuality: "Measurement quality",
    noMeasurementToAssess: "No measurement to assess yet",
    contextTitle: "Context",
    evalLive: "Assessment",
    evalStatic: "Static reference",
    roleEyebrow: "Role",
    gatewayTitle: "Infrastructure node",
    gatewayBody:
      "The gateway does not measure the environment — it collects data from the water and soil stations and relays it to the system. The signal above is the gateway's own link, not an environmental reading.",
    chartWaterOnly: "Trend charts are currently only available for the water station — {station} has no time-series source yet.",

    mSoilMoisture: "Soil moisture",
    mSoilEc: "Soil EC",
    mSoilPh: "Soil pH",
    mSoilTemp: "Soil temperature",
    mAirTemp: "Air temperature",
    mAirHumidity: "Air humidity",
    mBattery: "Station battery",
    mGatewaySignal: "Gateway signal",
    mSalinity: "Salinity",
    mWaterLevel: "Water level",
    mStationSignal: "Station signal",
    mEcProbe: "EC / salinity probe",

    thresholdNotConfigured:
      "No alert threshold has been configured for this station. The basis for interpreting salinity — international guidance and internal notes — is set out under Reference on the Monitoring page.",
    soilInterpretationPending:
      "Turning soil moisture, EC and pH into farming advice depends on the crop, the soil and the season. The project has not established a sourced reference threshold for Cồn Hô, so it publishes no figure.",
    salinityNoData: "No recent salinity reading is available to assess against the configured threshold.",
    salinityHigh: "Salinity is high; avoid drawing water directly for salt-sensitive crops.",
    salinityRising: "Salinity is rising; watch it before irrigating or drawing water.",
    salinitySafe: "Readings are currently within the safe range configured for the system.",
  },

  report: {
    eyebrow: "Field record",
    title: "Record a change on the island.",
    lead: "Pick the station nearest you, describe what you saw, then send it.",
    step1: "Location",
    step2: "Observation",
    step4: "Review",
    progressLabel: "Report progress",
    record: "Record",

    form: {
      q1: "Which station are you near?",
      q2: "What did you see?",
      q4: "Check it over before sending.",

      station: "Station",
      condition: "Condition",
      location: "Location",
      description: "Description",
      time: "Time",
      refCode: "Reference code",
      none: "None",

      descPlaceholder: "What did you see, where, and when?",
      locating: "Finding you…",
      updateLocation: "Update location",
      useCurrentLocation: "Use my current location",
      myLocation: "My location",
      myLocationLead: "Use this device's GPS",
      locationReady: "Location received",
      willUseGps: "The report will use this GPS position.",
      optionalGps: "Optional. If you skip it, the report is placed at the station you picked.",
      gpsDevice: "Device GPS",
      byStation: "From the station you picked",
      sending: "Sending…",
      submit: "Send report",
      evidence: "Evidence",
      evidenceLead: "A field photo, video, or audio note.",
      evidenceLimit: "Up to 3 files. Images up to 8 MB, audio 10 MB, video 20 MB.",
      addPhoto: "Add photo",
      addVideo: "Add video",
      addAudio: "Add audio",
      recordAudio: "Record",
      stopAudio: "Stop",
      removeEvidence: "Remove attachment",

      savedToDb: "Your report has been saved to the monitoring database.",
      savedLocally:
        "The system could not reach the main database, so your report is being held on this server. What you sent is real, but it may not be kept permanently.",

      errRateLimit: "You have sent a lot of reports in the past hour. Please try again later.",
      errTooShort: "The description needs at least {min} characters.",
      errTooLong: "The description can be at most {max} characters.",
      errInvalidKind: "That condition type is not valid. Please choose again.",
      errSendFailed: "Could not send the report. Check your connection and try again.",
      errGeoUnsupported: "This device cannot report its location. The report will use the station you picked.",
      errGeoFailed: "Could not get your location. You can still send the report using the station you picked.",
      errAudioFailed: "Audio recording is not available on this device. You can still attach an audio file.",

      charsNeeded: "At least {min} characters needed — {n} so far.",
      charsOf: "{n} / {max} characters.",
      charCount: "{n} characters",
      successEyebrow: "Field record received",
      successTitle: "Thank you for recording this.",
      tempRecord: "Held temporarily",
      another: "Record another observation",
      toObservatory: "Back to the observatory",
      legendStation: "Choose the nearest station",
      moreExact: "A more exact position",
      conditionType: "Condition type",
      edit: "Edit",
      fieldNote: "This is an observation from the field, not a measurement from a monitoring station.",
      needStation: "Choose a station to continue.",
      needCondition: "Choose a condition type and write a description to continue.",
    },
  },

  pwa: {
    installTitle: "Install the HORIZON app",
    installBody: "Add the observatory to your home screen for faster access.",
    install: "Install",
    later: "Not now",
  },

  map: {
    eyebrow: "Station map",
    noCoordsTitle: "No station coordinates to show yet",
    noCoordsBody:
      "The map will show real stations once it can reach location data from the system. No placeholder position is displayed.",
    basemapOnlyLabel: "Map of Cồn Hô, Vĩnh Long — station locations not shown",
    ariaLabel: "Map showing the location of {count} monitoring stations",
  },

  auth: {
    title: "Administrator sign-in",
    description: "Enter an authorised email and the project's internal password. No email link is sent.",
    email: "Email address",
    password: "Administrator password",
    passwordPlaceholder: "Enter password",
    signIn: "Sign in",
  },

  posts: {
    notFound: "Post not found",
    eyebrow: "Field notes",
    otherNotes: "Other notes",
    draft: "Draft — a working note written during development, not a published document.",
    demo: "Illustrative content, used to demonstrate the interface.",
    placeholder: "Placeholder content.",
  },

  errors: {
    notFoundTitle: "This page was not found",
    notFoundBody:
      "The address does not exist, or a station's code has changed. Go back to the observatory to see the current list of stations.",
    dashboardTitle: "The observatory could not be loaded",
    dashboardBody: "Something went wrong while loading the data. Please try again shortly.",
    retry: "Reload",
    genericTitle: "Something went wrong",
    genericBody: "This page could not be loaded. Please try again — if it keeps failing, come back in a few minutes.",
    offlineTitle: "You are offline",
    offlineBody: "Pages you already loaded can still be read. Reconnect to receive new data.",
    signOut: "Sign out",
    noRecentData: "No recent data yet.",
    loginNotAllowed: "This email is not on the administrator allowlist.",
    loginBadPassword: "That administrator password is not correct.",
    loginRateLimited: "Too many failed attempts. Please wait a few minutes and try again.",
    loginNotConfigured: "Administrator sign-in is currently unavailable. Please contact the project administrator.",
  },

  gallery: {
    empty: "There are no images in the gallery yet.",
    prev: "Previous image",
    next: "Next image",
    placeholder: "Illustration · placeholder",
    illustrative: "Illustration",
  },

  notes: {
    empty: "No field notes have been published yet.",
    emptyLong: "No field notes have been published yet. Posts will appear here as they are added.",
    prev: "Previous note",
    next: "Next note",
    draft: "Draft",
    demo: "Illustrative content",
    placeholder: "Placeholder content",
  },

  /**
   * Names are ROLE-based ("Water Station"), not ordinal ("Station 1"). See
   * the matching comment in vi.ts — the station is not "the first one," it
   * is the water station; STATION_01 is its ID, not its identity.
   */
  stationProfiles: {
    STATION_01: {
      name: "Water Station",
      location: "Riverbank area, Cồn Hô",
      intro:
        "Tracks water level, salinity and signs of tidal surge so residents can see changes in the river sooner.",
      chartTitle: "Water over 24 hours",
      chartNote: "Water level against salinity at the riverside site.",
    },
    STATION_02: {
      name: "Soil Station",
      location: "Cultivated area, mid-island",
      intro:
        "Measures soil EC and relative moisture to help growers judge when to irrigate, tend and plant.",
      chartTitle: "Soil over 24 hours",
      chartNote: "Soil EC alongside estimated moisture in the growing area.",
    },
    STATION_03: {
      name: "Gateway",
      location: "Data relay point, far end of the island",
      intro:
        "Collects data from the stations and relays it back to residents through the channels they already use.",
      chartTitle: "Delivery status over 24 hours",
      chartNote: "Delivery rate and connection signal for the gateway.",
    },
    seriesDeliveryRate: "Delivery rate",
    seriesSignal: "Signal",
    statusActive: "Active",
    statusMaintenance: "Maintenance",
    statusOffline: "Offline",
  },

  reference: {
    faoTitle: "Irrigation-water salinity — international guidance",
    faoNoRestriction: "No restriction on use",
    faoSlight: "Slight to moderate restriction",
    faoSevere: "Severe restriction",
    faoDetail:
      "FAO's thresholds are expressed as the electrical conductivity of irrigation water (dS/m). HORIZON reports salinity in ‰ — converting between the two depends on the ionic composition of each water source, so this table is reference context, not a threshold applied directly to the station's readings.",
    configuredTitle: "Alert threshold in use",
    configuredWatch: "Needs attention",
    configuredRisk: "High risk",
    configuredDetail:
      "A value the project configured to raise alerts. This is HORIZON's own operational choice; it has not been checked against an independent scientific source.",
    configuredSource: "HORIZON system configuration",
    unconfiguredTitle: "Salinity alert threshold",
    unconfiguredDetail:
      "No alert threshold has been configured in the system. Figures that once appeared in internal engineering notes are not well-founded enough to publish as a recommendation, so none is given here.",
    soilTitle: "Soil and nutrients",
    soilDetail:
      "HORIZON can measure soil moisture, EC, pH and temperature. Turning those values into farming advice depends on the crop, the soil and the season — the project has not established a sourced reference threshold for Cồn Hô, so it publishes no figure.",
    gatewayCapability:
      "The gateway collects data from the two measuring stations and relays it to the system. Its own condition — battery, signal, uptime — is not measured by the current firmware, so there is no figure to show.",
  },

  demo: {
    waterStation: "Water station (demo)",
    soilStation: "Soil station (demo)",
    gatewayStation: "Gateway (demo)",
    unplacedLocation: "Demo station — not tied to a real location",
    alertSalinityTitle: "Salinity approaching the attention threshold",
    alertSalinityMessage: "Demo value rising quickly during the tidal window.",
    alertSignalTitle: "Temporarily weak signal",
    alertSignalMessage: "Demo value — signal below -85 dBm for one reporting cycle.",
  },

  admin: {
    title: "Control panel",
    description: "Network status, field reports and device configuration.",
    navigation: {
      overview: "Overview",
      devices: "Devices",
      thresholds: "Thresholds",
      applications: "Applications",
      calibration: "Calibration",
      maintenance: "Maintenance",
      reports: "Reports",
      data: "Data",
      audit: "Audit",
      configuration: "Configuration",
    },
  },


  context: {
    wind: {
      calm: "Calm",
      light: "Light breeze",
      moderate: "Moderate breeze",
      fresh: "Fresh breeze",
      strong: "Strong wind",
    },
    rain: {
      none: "No rain",
      light: "Light rain",
      moderate: "Moderate rain",
      heavy: "Heavy rain",
      violent: "Violent rain",
    },
    signal: {
      ok: "Strong signal",
      watch: "Fair signal",
      warn: "Weak signal",
      critical: "Very weak signal",
    },
    battery: {
      ok: "Battery good",
      watch: "Battery fair",
      warn: "Battery low",
      critical: "Battery critical",
    },
  },

  contact: {
    eyebrow: "Contact",
    title: "Contact & collaborate.",
    lead: "About collaboration, research, or any question that is not a field observation — reach the project directly through the channels below.",
    channelEmail: "Email",
    channelPhone: "Phone",
    channelZalo: "Zalo",
    channelFacebook: "Facebook",
    channelInstagram: "Instagram",
    channelWebsite: "Website",
    reportEyebrow: "Field observation",
    reportTitle: "Seen something on the islet?",
    reportLead:
      "Unusual water levels, plants behaving oddly, or equipment that looks wrong. Every note is stored with its time and place.",
  },


  thresholds: {
    active: "In use",
    referenceOnly: "Reference — creates no alert",
    source: "Source",
    scope: "Scope",
    soilTitle: "Irrigation threshold from soil moisture",
    soilDerived: "Derived from on-site soil",
    soilMissing: "No Cồn Hô soil data yet",
    soilExplain:
      "There is no single percentage that works everywhere. The irrigation trigger is a function of the soil itself: threshold = FC − MAD × (FC − PWP), where FC is field capacity, PWP the permanent wilting point and MAD the management-allowed depletion. Until FC and PWP are measured for Cồn Hô the system sets no threshold, rather than borrowing a number from somewhere else.",
    soilSource:
      "Source: USDA/NRCS — field capacity, permanent wilting point and available water. A 50% MAD is a starting management assumption where local data is absent, not a physiological constant.",
    irrigateAt: "irrigate at",
    severity: {
      normal: "Normal",
      watch: "Watch",
      warning: "Warning",
      critical: "Critical",
      low_confidence: "Low confidence",
    },
    basis: {
      FAO_REFERENCE: "FAO",
      CITRUS_REFERENCE: "Citrus reference",
      POMELO_MEKONG_REFERENCE: "Mekong pomelo study",
      SENSOR_QUALITY: "Measurement quality",
      DEVICE_HEALTH: "Device engineering",
      SITE_CALIBRATED: "Site calibrated",
      LEGACY_UNVALIDATED: "Unvalidated",
    },
    validation: {
      REFERENCE: "Reference",
      PILOT: "Pilot",
      OPERATIONAL: "In use",
      SITE_VALIDATED: "Site validated",
    },
    quantity: {
      water_ec: "Irrigation water EC (ECw)",
      water_ph: "Water pH",
      water_salinity: "Water salinity (‰)",
      water_level: "Water level",
      soil_ec_bulk: "Bulk in-situ soil EC",
      soil_ec_saturated_extract: "Soil EC, saturated extract (ECe)",
      soil_ph: "Soil pH",
      soil_moisture: "Soil moisture",
      soil_temp: "Soil temperature",
      air_temp: "Air temperature",
      air_humidity: "Air humidity",
      battery_voltage: "Battery voltage",
      signal_dbm: "Signal strength",
    },
  },

  metricLabels: {
    waterEc: "Water EC",
    waterTemp: "Water temperature",
    salinity: "Salinity",
    waterLevel: "Water level",
    moisture: "Moisture",
    ec: "EC",
    ph: "pH",
    temperature: "Temperature",
    humidity: "Humidity",
    signal: "Signal",
    battery: "Battery",
    wind: "Wind",
    precipitation: "Rainfall",
  },

  terms: {
    water: "Water",
    soil: "Soil",
    salinity: TERMINOLOGY.salinity.en,
    waterLevel: TERMINOLOGY.waterLevel.en,
    soilEc: TERMINOLOGY.soilEc.en,
    soilMoisture: TERMINOLOGY.soilMoisture.en,
    soilPh: TERMINOLOGY.soilPh.en,
    soilTemp: TERMINOLOGY.soilTemp.en,
    airTemp: TERMINOLOGY.airTemp.en,
    airHumidity: TERMINOLOGY.airHumidity.en,
    battery: TERMINOLOGY.battery.en,
    signal: TERMINOLOGY.signal.en,
    gateway: TERMINOLOGY.gateway.en,
  },
};
