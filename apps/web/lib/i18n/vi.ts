import { TERMINOLOGY } from "./terminology";

/**
 * Vietnamese — the source dictionary.
 *
 * This object's SHAPE is the contract: `en.ts` is typed as `Dictionary`, so
 * TypeScript refuses to compile an English dictionary that is missing a key
 * or has an extra one. Translation completeness is a build error, not
 * something to discover in the browser.
 *
 * Scope note: this covers product chrome — navigation, controls, titles,
 * measurement labels, status vocabulary, the Monitoring canvas, the report
 * flow. It deliberately does NOT contain the long editorial prose on /about
 * or the field-note posts. Those are essays, not interface strings; running
 * them through a dictionary would make them look translated when they are
 * not, and machine-translating scientific writing is exactly what this
 * project's honesty rules prohibit. Those surfaces stay Vietnamese and say so
 * (see `common.translationPending`).
 */
export const vi = {
  meta: {
    siteName: "HORIZON",
    titleDefault: "HORIZON - Frogsleap Vietnam",
    description:
      "Mạng lưới quan trắc môi trường quy mô thí điểm tại Cồn Hô, Vĩnh Long — mực nước, độ mặn và tình trạng đất, trình bày công khai và trung thực.",
  },

  nav: {
    home: "Trang chủ",
    about: "Giới thiệu",
    monitoring: "Quan trắc",
    report: "Báo cáo",
    admin: "Quản trị",
    primaryLabel: "Điều hướng chính",
    mobileLabel: "Điều hướng di động",
    footerLabel: "Điều hướng chân trang",
  },

  controls: {
    toDark: "Chuyển sang giao diện tối",
    toLight: "Chuyển sang giao diện sáng",
    languageLabel: "Ngôn ngữ",
    switchToVietnamese: "Chuyển sang tiếng Việt",
    switchToEnglish: "Chuyển sang tiếng Anh",
  },

  footer: {
    place: "Cồn Hô · Vĩnh Long",
    mapAttribution: "Nền bản đồ © Esri · Dữ liệu © OpenStreetMap contributors.",
    copyright: "© Magnus",
  },

  common: {
    noData: "Chưa có dữ liệu",
    noMeasurement: "Chưa có phép đo",
    notMeasured: "Chưa được đo",
    loading: "Đang tải…",
    viewStation: "Xem trạm",
    viewDetail: "Chi tiết",
    stationPage: "Trang trạm",
    back: "Quay lại",
    continue: "Tiếp tục",
    updated: "Cập nhật",
    source: "Nguồn",
    translationPending:
      "Phần nội dung dài trên trang này hiện chỉ có tiếng Việt. Bản tiếng Anh đang được biên tập — dự án không dùng bản dịch máy cho nội dung kỹ thuật.",
  },

  freshness: {
    live: "Đang gửi",
    recent: "Gần đây",
    stale: "Dữ liệu cũ",
    offline: "Mất kết nối",
    neverConnected: "Chưa kết nối",
    unavailable: "Chưa có dữ liệu",
  },

  /** Field-report condition types. The wire value is the key; only the label translates. */
  reportCategories: {
    erosion: "Xói lở bờ sông",
    flooding: "Ngập lụt / thủy triều",
    pollution: "Ô nhiễm",
    infrastructure: "Hư hại hạ tầng",
    sensor: "Lỗi trạm quan trắc",
    other: "Khác",
  },

  /** Alert vocabulary — severity words and event titles shown on Monitoring. */
  alerts: {
    critical: "Nghiêm trọng",
    warning: "Cảnh báo",
    info: "Thông tin",
    normal: "Bình thường",
    highSalinity: "Cảnh báo độ mặn",
    sensorFault: "Lỗi cảm biến",
    lowBattery: "Pin yếu",
    offline: "Tín hiệu yếu",
    noDetail: "Không có chi tiết bổ sung",
    salinityDetail: "Độ mặn {value}‰ (ngưỡng {threshold}‰)",
    batteryDetail: "Pin {value} V",
    signalDetail: "Tín hiệu {value} dBm",
  },

  quality: {
    valid: "Đo trực tiếp",
    estimated: "Giá trị ước tính",
    error: "Cảm biến lỗi",
  },

  provenance: {
    telemetry: "Dữ liệu quan trắc trực tiếp",
    historical: "Dữ liệu quan trắc trước đó",
    reference: "Nguồn tham chiếu",
    demo: "Dữ liệu minh họa",
    unavailable: "Chưa có dữ liệu",
    external: "Nguồn ngoài mạng lưới",
    lastObserved: "Quan trắc lần cuối",
    unverifiedSource: "Chưa có nguồn tham chiếu được xác minh.",
    lastChecked: "Kiểm tra lần cuối",
  },

  monitoring: {
    eyebrow: "Quan trắc trực tiếp",
    title: "Đài quan trắc",
    subtitle: "Toàn bộ chỉ số của mạng lưới trên một mặt canvas — kèm nguồn của từng con số.",
    sendReport: "Gửi báo cáo hiện trường",

    demoBannerTitle: "DỮ LIỆU MINH HỌA",
    demoBannerBody:
      "số liệu trạm trên trang này là tổng hợp để trình bày giao diện, không phải quan trắc thật từ Cồn Hô. Các giá trị đánh dấu * là dữ liệu thật từ nguồn ngoài.",
    demoBannerLink: "Xem dữ liệu thật →",

    networkEyebrow: "Mạng lưới",
    stationsCounted: "trạm quan trắc",
    sendingData: "đang gửi dữ liệu",
    noneSending: "chưa trạm nào gửi dữ liệu",
    lastObservation: "Quan trắc gần nhất",
    neverObserved: "Hệ thống chưa nhận được quan trắc nào từ mạng lưới.",
    noDataCount: "chưa có dữ liệu",
    offlineCount: "mất kết nối",
    allOperational: "Toàn mạng đang hoạt động",
    needsAttention: "Cần chú ý",

    groupWater: "Nước",
    groupSoil: "Đất",
    groupAir: "Không khí",
    groupInfrastructure: "Hạ tầng",
    groupContext: "Bối cảnh khu vực",

    /* The marker legend. Printed once, under the canvas — so the asterisk on
       an individual value can stay small enough not to shout. */
    markerExternalLegend: "Nguồn ngoài mạng lưới HORIZON — số liệu khu vực, không phải phép đo tại trạm.",
    markerDemoLegend: "Dữ liệu minh họa, không phải quan trắc thật.",
    originHorizon: "HORIZON",
    originExternal: "Nguồn ngoài",

    signalsEyebrow: "Chỉ số môi trường",
    signalsTitle: "Các phép đo của mạng lưới",
    primarySignals: "Chỉ số chính",
    secondarySignals: "Chỉ số phụ trợ",

    notInFirmware: "Chưa được đo trong firmware",
    capabilityOnly: "Hệ thống có khả năng đo, chưa có số liệu",

    alertsEyebrow: "Sự kiện",
    alertsActive: "đang hoạt động",
    noAlerts: "Không có cảnh báo",
    noAlertsDetail: "mạng lưới không ghi nhận sự kiện nào cần chú ý",

    spaceEyebrow: "Không gian",
    spaceTitle: "Vị trí các trạm",

    referenceEyebrow: "Tham chiếu",
    referenceTitle: "THAM CHIẾU & NGƯỠNG",
    standingExternal: "Nguồn quốc tế",
    standingInternal: "Cấu hình dự án",
    standingUnverified: "Chưa xác minh",
  },

  external: {
    eyebrow: "Bối cảnh môi trường · nguồn ngoài",
    title: "Thời tiết khu vực",
    temperature: "Nhiệt độ",
    humidity: "Độ ẩm",
    wind: "Gió",
    precipitation: "Lượng mưa",
    disclaimerBefore: "Số liệu dự báo theo lưới khu vực từ",
    disclaimerAfter: ", không phải số đo từ thiết bị của HORIZON tại Cồn Hô.",
    modelTime: "Thời điểm mô hình",
    unavailable:
      "Chưa lấy được dữ liệu thời tiết từ nguồn ngoài. Phần này sẽ hiển thị lại khi kết nối được — không có giá trị thay thế nào được điền vào đây.",
  },

  chart: {
    eyebrow: "Nhật ký quan trắc",
    /* The chart box's own header label, in the short uppercase form every
       other Bento box header uses ("QUAN TRẮC", "HẠ TẦNG"). `eyebrow` is the
       long name, kept for the accessible description — at 17 characters it
       wraps inside a cell header, which is why the header needs its own. */
    boxLabel: "Nhật ký",
    metricControl: "Thông số",
    rangeControl: "Khoảng thời gian",
    title: "Diễn biến theo thời gian",
    range24h: "24 giờ",
    range7d: "7 ngày",
    range30d: "30 ngày",
    axisShows: "Trục hiển thị",
    observations: "quan trắc",
    thisRange: "khoảng này",
    noObservationsIn: "Chưa có quan trắc trong {range} gần nhất",
    noObservationsBody:
      "Khi trạm gửi được số liệu trong khoảng thời gian này, biểu đồ sẽ xuất hiện ở đây. Không có đường nào được vẽ thay thế.",
    metrics: {
      waterEc: "EC nước",
      waterTemp: "Nhiệt độ nước",
      salinity: "Độ mặn",
      waterLevel: "Mực nước",
      soilMoisture: "Độ ẩm đất",
      soilEc: "EC đất",
      soilPh: "Độ pH",
      soilTemp: "Nhiệt độ đất",
      airTemp: "Nhiệt độ không khí",
      airHumidity: "Độ ẩm không khí",
      weatherTemp: "Nhiệt độ Open-Meteo",
      weatherHumidity: "Độ ẩm Open-Meteo",
      weatherWind: "Gió Open-Meteo",
      weatherPrecipitation: "Mưa Open-Meteo",
    },
  },

  home: {
    eyebrow: "HORIZON · Cồn Hô, Vĩnh Long",
    /* The title carries the thesis: a place, and the change happening to it.
       It was "Một cù lao giữa sông." — accurate but inert, naming a location
       and stopping there. The clause about salt is what gives the reader a
       reason to keep reading, and it is a claim the project can stand
       behind. */
    /* Identity statement: Cồn Hô is the first field context; HORIZON is the
       reusable platform being built from it. */
    title: "Đây là Cồn Hô.\nĐây là HORIZON.",
    /* A product statement, not a description of the website. The previous
       subtitle ended "...một trang công khai nói rõ mỗi con số đến từ đâu",
       which talks about the page the reader is already on. This talks about
       the network. */
    subtitle:
      "Một hạ tầng quan trắc đặt ngay trên cù lao — kết nối nước, đất, không khí và dữ liệu thành một cách nhìn có nguồn gốc.",
    ctaPrimary: "Xem mạng lưới quan trắc",
    pilotNote: "Hạ tầng hiện trường đang được hoàn thiện và kiểm chứng tại Cồn Hô.",
  },

  about: {
    eyebrow: "Giới thiệu",
    title: "HORIZON và cách dự án được xây dựng.",
    subtitle: "Dự án đang làm gì, hệ thống hoạt động ra sao, và phần nào vẫn còn dang dở.",
  },

  station: {
    operationalStatus: "Trạng thái vận hành",
    primaryMetric: "Chỉ số chính",
    otherStations: "Trạm khác",
    networkEyebrow: "Mạng lưới",
    locationEyebrow: "Vị trí",
    locationTitle: "Bối cảnh địa lý",
    backToMonitoring: "Về bảng quan trắc",
    reportNearby: "Báo cáo gần trạm này",

    outsideNetwork: "Ngoài mạng lưới",
    measurementQuality: "Chất lượng đo",
    noMeasurementToAssess: "Chưa có phép đo để đánh giá",
    contextTitle: "Bối cảnh",
    evalLive: "Đánh giá",
    evalStatic: "Tham chiếu tĩnh",
    roleEyebrow: "Vai trò",
    gatewayTitle: "Thiết bị hạ tầng",
    gatewayBody:
      "Gateway không đo môi trường — thiết bị này tổng hợp dữ liệu từ trạm nước và trạm đất rồi chuyển tiếp về hệ thống. Tín hiệu ở trên là kết nối của chính gateway, không phải một chỉ số môi trường.",
    chartWaterOnly: "Biểu đồ xu hướng hiện chỉ khả dụng cho trạm đo nước — {station} chưa có nguồn dữ liệu theo chuỗi thời gian.",

    /* Fully-qualified reading labels. Unlike the canvas's contextual
       `metricLabels`, these render without a domain heading above them, so
       "Nhiệt độ" alone would be ambiguous between soil and air. */
    mSoilMoisture: "Độ ẩm đất",
    mSoilEc: "EC đất",
    mSoilPh: "Độ pH đất",
    mSoilTemp: "Nhiệt độ đất",
    mAirTemp: "Nhiệt độ không khí",
    mAirHumidity: "Độ ẩm không khí",
    mBattery: "Pin trạm",
    mGatewaySignal: "Tín hiệu gateway",
    mSalinity: "Độ mặn",
    mWaterLevel: "Mực nước",
    mStationSignal: "Tín hiệu trạm",
    mEcProbe: "Cảm biến EC/độ mặn",

    /* Interpretation. Never a number the project has not justified. */
    thresholdNotConfigured:
      "Hệ thống chưa cấu hình ngưỡng cảnh báo cho trạm này. Cơ sở diễn giải độ mặn — gồm hướng dẫn quốc tế và ghi chú nội bộ — được trình bày trong mục Tham chiếu ở trang Quan trắc.",
    soilInterpretationPending:
      "Việc diễn giải độ ẩm, EC và pH đất thành khuyến nghị canh tác phụ thuộc loại cây, loại đất và mùa vụ. Dự án chưa xác lập được ngưỡng tham chiếu có nguồn cho bối cảnh Cồn Hô, nên chưa công bố con số nào.",
    salinityNoData: "Chưa có số liệu độ mặn mới nhất để đánh giá theo ngưỡng đã cấu hình.",
    salinityHigh: "Độ mặn đang cao, bà con nên hạn chế lấy nước trực tiếp cho cây nhạy mặn.",
    salinityRising: "Độ mặn có dấu hiệu tăng, nên theo dõi thêm trước khi tưới hoặc lấy nước.",
    salinitySafe: "Số liệu hiện đang trong ngưỡng an toàn đã cấu hình cho hệ thống.",
  },

  report: {
    eyebrow: "Ghi nhận hiện trường",
    title: "Ghi nhận một thay đổi trên đảo.",
    lead: "Chọn trạm gần bạn nhất, mô tả điều bạn thấy, rồi gửi.",
    step1: "Địa điểm",
    step2: "Quan sát",
    /** step3 ("Bằng chứng") was the photo-evidence step, removed along with
     * the picker — its control never persisted anything. step4 is kept as a
     * key name (rather than renumbered to step3) so it still reads as "the
     * last step" if evidence capture is ever rebuilt with real storage. */
    step4: "Xem lại",
    progressLabel: "Tiến trình báo cáo",
    record: "Bản ghi",

    /**
     * The report form. Every string here is interface, not editorial — an
     * English reporter meeting "Mô tả cần ít nhất 40 ký tự." after failing
     * validation has been handed an error they cannot read, which is the
     * clearest case of mixed-language UI in the product.
     *
     * `{min}` / `{max}` / `{n}` are substituted at the call site rather than
     * interpolated here, so the numbers stay owned by the component that
     * knows them and the sentence order can differ between languages.
     */
    form: {
      q1: "Bạn đang ở gần trạm nào?",
      q2: "Bạn thấy gì?",
      q4: "Kiểm tra lại trước khi gửi.",

      station: "Trạm",
      condition: "Hiện trạng",
      location: "Vị trí",
      description: "Mô tả",
      time: "Thời điểm",
      refCode: "Mã tham chiếu",
      none: "Không có",

      descPlaceholder: "Bạn nhìn thấy gì, ở đâu, và khi nào?",
      locating: "Đang định vị…",
      updateLocation: "Cập nhật lại vị trí",
      useCurrentLocation: "Dùng vị trí hiện tại",
      myLocation: "Vị trí của tôi",
      myLocationLead: "Dùng GPS của thiết bị",
      locationReady: "Đã lấy vị trí",
      willUseGps: "Báo cáo sẽ dùng vị trí GPS này.",
      optionalGps: "Không bắt buộc. Nếu bỏ qua, báo cáo được gắn theo vị trí trạm bạn chọn.",
      gpsDevice: "GPS thiết bị",
      byStation: "Theo vị trí trạm đã chọn",
      sending: "Đang gửi…",
      submit: "Gửi báo cáo",
      evidence: "Bằng chứng",
      evidenceLead: "Ảnh, video hoặc ghi âm từ hiện trường.",
      evidenceLimit: "Tối đa 3 tệp. Ảnh tối đa 8 MB, âm thanh 10 MB, video 20 MB.",
      addPhoto: "Thêm ảnh",
      addVideo: "Thêm video",
      addAudio: "Thêm âm thanh",
      recordAudio: "Ghi âm",
      stopAudio: "Dừng",
      removeEvidence: "Xóa tệp đính kèm",

      savedToDb: "Báo cáo đã được lưu vào cơ sở dữ liệu quan trắc.",
      savedLocally:
        "Hệ thống chưa kết nối được tới cơ sở dữ liệu chính, nên báo cáo đang được giữ trên máy chủ này. Nội dung bạn gửi là thật, nhưng có thể không được giữ lâu dài.",

      errRateLimit: "Bạn đã gửi khá nhiều báo cáo trong một giờ qua. Vui lòng thử lại sau.",
      errTooShort: "Mô tả cần ít nhất {min} ký tự.",
      errTooLong: "Mô tả tối đa {max} ký tự.",
      errInvalidKind: "Loại hiện trạng không hợp lệ. Vui lòng chọn lại.",
      errSendFailed: "Không gửi được báo cáo. Vui lòng kiểm tra kết nối và thử lại.",
      errGeoUnsupported: "Thiết bị không hỗ trợ định vị. Báo cáo sẽ dùng vị trí trạm bạn chọn.",
      errGeoFailed: "Chưa lấy được vị trí. Báo cáo vẫn gửi được bằng vị trí trạm bạn chọn.",
      errAudioFailed: "Chưa thể ghi âm trên thiết bị này. Bạn vẫn có thể đính kèm tệp âm thanh.",

      charsNeeded: "Cần ít nhất {min} ký tự — hiện có {n}.",
      charsOf: "{n} / {max} ký tự.",
      charCount: "{n} ký tự",
      successEyebrow: "Đã ghi nhận hiện trường",
      successTitle: "Cảm ơn bạn đã ghi lại điều này.",
      tempRecord: "Bản ghi tạm",
      another: "Ghi nhận quan sát khác",
      toObservatory: "Về đài quan trắc",
      legendStation: "Chọn trạm gần nhất",
      moreExact: "Vị trí chính xác hơn",
      conditionType: "Loại hiện trạng",
      edit: "Sửa",
      fieldNote: "Đây là một quan sát từ hiện trường, không phải số đo của trạm quan trắc.",
      needStation: "Chọn một trạm để tiếp tục.",
      needCondition: "Chọn loại hiện trạng và viết mô tả để tiếp tục.",
    },
  },

  pwa: {
    installTitle: "Cài ứng dụng HORIZON",
    installBody: "Thêm bảng quan trắc vào màn hình chính để truy cập nhanh hơn.",
    install: "Cài đặt",
    later: "Để sau",
  },

  map: {
    eyebrow: "Bản đồ trạm",
    noCoordsTitle: "Chưa có tọa độ trạm để hiển thị",
    noCoordsBody:
      "Bản đồ sẽ hiện các trạm thực khi kết nối được với dữ liệu vị trí từ hệ thống. Không có vị trí giả nào được hiển thị.",
    basemapOnlyLabel: "Bản đồ Cồn Hô, Vĩnh Long — chưa hiển thị vị trí trạm",
    ariaLabel: "Bản đồ vị trí {count} trạm quan trắc",
  },

  auth: {
    title: "Đăng nhập quản trị",
    description: "Nhập email được cấp quyền và mật khẩu nội bộ của dự án. Không cần gửi liên kết email.",
    email: "Địa chỉ email",
    password: "Mật khẩu quản trị",
    passwordPlaceholder: "Nhập mật khẩu",
    signIn: "Đăng nhập",
  },

  posts: {
    notFound: "Không tìm thấy bài viết",
    eyebrow: "Ghi chép",
    otherNotes: "Ghi chép khác",
    draft: "Bản nháp — ghi chép trong quá trình phát triển dự án, chưa phải tài liệu công bố.",
    demo: "Nội dung minh họa, dùng để trình bày giao diện.",
    placeholder: "Nội dung giữ chỗ.",
  },

  errors: {
    notFoundTitle: "Không tìm thấy trang này",
    notFoundBody:
      "Đường dẫn không tồn tại hoặc trạm quan trắc đã được đổi mã. Quay lại bảng quan trắc để xem danh sách trạm hiện có.",
    dashboardTitle: "Không thể tải bảng quan trắc",
    dashboardBody: "Đã xảy ra lỗi khi tải dữ liệu. Vui lòng thử lại sau.",
    retry: "Tải lại",
    genericTitle: "Đã xảy ra lỗi",
    genericBody: "Trang này không tải được. Vui lòng thử lại — nếu vẫn lỗi, hãy quay lại sau ít phút.",
    offlineTitle: "Bạn đang ngoại tuyến",
    offlineBody: "Các trang đã tải trước vẫn có thể xem. Hãy kết nối lại để nhận dữ liệu mới.",
    signOut: "Đăng xuất",
    noRecentData: "Chưa có dữ liệu gần nhất.",
    loginNotAllowed: "Email này chưa nằm trong danh sách được phép quản trị.",
    loginBadPassword: "Mật khẩu quản trị chưa đúng.",
    loginRateLimited: "Đã thử sai quá nhiều lần. Vui lòng chờ ít phút rồi thử lại.",
    /* Deliberately says nothing about WHY.
       This message renders on a public page to anyone who visits
       /admin/login, and the version it replaces named the two environment
       variables that gate the admin console — a configuration diagnostic
       aimed at an operator, printed for anonymous visitors. The operator
       needs that detail, so it moved to the server log where only they can
       read it; the visitor gets a plain statement that sign-in is
       unavailable, which is all the information they can act on. */
    loginNotConfigured: "Đăng nhập quản trị hiện chưa khả dụng. Vui lòng liên hệ quản trị viên dự án.",
  },

  gallery: {
    empty: "Chưa có hình ảnh nào trong thư viện.",
    prev: "Xem hình trước",
    next: "Xem hình tiếp theo",
    placeholder: "Minh họa · giữ chỗ",
    illustrative: "Hình minh họa",
  },

  notes: {
    empty: "Chưa có ghi chép nào được đăng.",
    emptyLong: "Chưa có ghi chép nào được đăng. Các bài viết sẽ xuất hiện ở đây khi được thêm vào.",
    prev: "Xem ghi chép trước",
    next: "Xem ghi chép tiếp theo",
    draft: "Bản nháp",
    demo: "Nội dung minh họa",
    placeholder: "Nội dung giữ chỗ",
  },

  /**
   * Station display text, keyed by station id.
   *
   * Names are ROLE-based ("Trạm Nước"), not ordinal ("Trạm 1"). The station
   * is not "the first one" — it is the water station; STATION_01 is its ID,
   * not its identity. "Khu ven sông Cồn Hô" etc. stay in `location`, because
   * that is a real geographic fact, not a position in a sequence.
   *
   * Leaving these in stationProfile.ts meant an English reader picking a
   * station in the report form met three Vietnamese options in the middle of
   * an otherwise-English page. The profile keeps everything structural — id,
   * kind, series keys, colours, units, coordinates. Only the words live here.
   */
  stationProfiles: {
    STATION_01: {
      name: "Trạm Nước",
      location: "Khu ven sông Cồn Hô",
      intro:
        "Theo dõi mực nước, độ mặn và dấu hiệu triều cường để bà con nhận biết biến động của dòng nước sớm hơn.",
      chartTitle: "Diễn biến nước 24 giờ",
      chartNote: "So sánh mực nước và độ mặn tại khu gần sông.",
    },
    STATION_02: {
      name: "Trạm Đất",
      location: "Khu canh tác giữa cồn",
      intro:
        "Đo EC đất và độ ẩm tương đối để hỗ trợ bà con chọn thời điểm tưới, chăm sóc và trồng trọt phù hợp.",
      chartTitle: "Diễn biến đất 24 giờ",
      chartNote: "Theo dõi EC đất cùng độ ẩm ước tính tại vùng canh tác.",
    },
    STATION_03: {
      name: "Gateway",
      location: "Điểm gửi dữ liệu cuối cồn",
      intro:
        "Tổng hợp dữ liệu từ các trạm và chuyển thông tin nhanh chóng về cho bà con qua các kênh liên lạc quen dùng.",
      chartTitle: "Trạng thái gửi dữ liệu 24 giờ",
      chartNote: "Theo dõi tỷ lệ gửi dữ liệu và tín hiệu kết nối của gateway.",
    },
    seriesDeliveryRate: "Tỷ lệ gửi",
    seriesSignal: "Tín hiệu",
    statusActive: "Đang hoạt động",
    statusMaintenance: "Bảo trì",
    statusOffline: "Ngoại tuyến",
  },

  /**
   * Reference-panel prose. Scientific content, but it is INTERFACE: an English
   * reader assessing whether this project is trustworthy needs to read the
   * provenance rules, not just see that they exist. The FAO units (dS/m, ‰)
   * and the citation itself are deliberately untranslated.
   */
  reference: {
    faoTitle: "Độ mặn nước tưới — hướng dẫn quốc tế",
    faoNoRestriction: "Không hạn chế sử dụng",
    faoSlight: "Hạn chế nhẹ đến trung bình",
    faoSevere: "Hạn chế nghiêm trọng",
    faoDetail:
      "Ngưỡng của FAO tính theo độ dẫn điện của nước tưới (dS/m). HORIZON hiển thị độ mặn theo ‰ — quy đổi giữa hai đơn vị phụ thuộc thành phần ion của từng nguồn nước, nên bảng này là ngữ cảnh tham chiếu, không phải ngưỡng áp trực tiếp lên số đo của trạm.",
    configuredTitle: "Ngưỡng cảnh báo đang dùng",
    configuredWatch: "Cần chú ý",
    configuredRisk: "Nguy cơ cao",
    configuredDetail:
      "Giá trị do dự án cấu hình để sinh cảnh báo. Đây là lựa chọn vận hành của HORIZON, chưa được đối chiếu với một nguồn khoa học độc lập.",
    configuredSource: "Cấu hình hệ thống HORIZON",
    unconfiguredTitle: "Ngưỡng cảnh báo độ mặn",
    unconfiguredDetail:
      "Chưa có ngưỡng cảnh báo nào được cấu hình trong hệ thống. Các con số từng xuất hiện trong ghi chú kỹ thuật nội bộ chưa đủ cơ sở để hiển thị như một khuyến nghị, nên không được nêu ở đây.",
    soilTitle: "Đất và dinh dưỡng",
    soilDetail:
      "HORIZON đo được độ ẩm, EC, pH và nhiệt độ đất. Việc diễn giải các giá trị này thành khuyến nghị canh tác phụ thuộc loại cây, loại đất và mùa vụ — dự án chưa xác lập được ngưỡng tham chiếu có nguồn cho bối cảnh Cồn Hô, nên chưa công bố con số nào.",
    gatewayCapability:
      "Gateway gom dữ liệu từ hai trạm đo và chuyển tiếp về hệ thống. Tình trạng của chính nó — pin, tín hiệu, thời gian hoạt động — chưa được đo trong firmware hiện tại, nên không có số liệu để hiển thị.",
  },

  /**
   * Demo-mode fixture text. Demo mode is a real, reachable route
   * (?mode=demo) that reviewers use to see the interface populated, so its
   * labels are interface too — an English reviewer should not meet
   * "Trạm nước (minh họa)" while every heading around it is English.
   *
   * "(minh họa)" / "(demo)" stays inside the label deliberately: the marker
   * and the banner already say the data is synthetic, and the name repeating
   * it is one more place the claim cannot be missed.
   */
  demo: {
    waterStation: "Trạm nước (minh họa)",
    soilStation: "Trạm đất (minh họa)",
    gatewayStation: "Gateway (minh họa)",
    unplacedLocation: "Trạm minh họa — không gắn với vị trí thật",
    alertSalinityTitle: "Độ mặn tiến gần ngưỡng cần chú ý",
    alertSalinityMessage: "Giá trị minh họa tăng nhanh trong khung giờ triều cường.",
    alertSignalTitle: "Tín hiệu yếu tạm thời",
    alertSignalMessage: "Giá trị minh họa — tín hiệu dưới -85 dBm trong một chu kỳ gửi.",
  },

  admin: {
    title: "Bảng điều khiển",
    description: "Trạng thái mạng lưới, báo cáo hiện trường và cấu hình thiết bị.",
  },


  /**
   * Contextual metric labels. Short on purpose — the domain heading above
   * them ("Đất", "Không khí") supplies the qualifier, so repeating it on
   * every reading would be noise. Fully-qualified names live in
   * lib/i18n/terminology.ts for use outside a group.
   */
  /**
   * One-line interpretations. Only for quantities with a published
   * single-variable classification — see lib/monitoring/context.ts for why
   * temperature and humidity deliberately have none.
   */
  context: {
    /** Beaufort scale bands (WMO), km/h at 10 m. */
    wind: {
      calm: "Lặng gió",
      light: "Gió nhẹ",
      moderate: "Gió vừa",
      fresh: "Gió khá mạnh",
      strong: "Gió mạnh",
    },
    /** Rainfall intensity classes, mm/h. */
    rain: {
      none: "Không mưa",
      light: "Mưa nhỏ",
      moderate: "Mưa vừa",
      heavy: "Mưa to",
      violent: "Mưa rất to",
    },
    /** Derived from the same device bands statusFor() uses — never a second opinion. */
    signal: {
      ok: "Tín hiệu mạnh",
      watch: "Tín hiệu khá",
      warn: "Tín hiệu yếu",
      critical: "Tín hiệu rất yếu",
    },
    battery: {
      ok: "Pin tốt",
      watch: "Pin khá",
      warn: "Pin thấp",
      critical: "Pin cạn",
    },
  },

  /** The Home contact section — direct channels, not a form that posts anywhere. */
  contact: {
    eyebrow: "Liên hệ",
    title: "Liên hệ & hợp tác.",
    lead: "Về hợp tác, nghiên cứu, hoặc bất cứ câu hỏi nào không phải là một quan sát hiện trường — liên hệ trực tiếp qua các kênh dưới đây.",
    channelEmail: "Email",
    channelPhone: "Điện thoại",
    channelZalo: "Zalo",
    channelFacebook: "Facebook",
    channelInstagram: "Instagram",
    channelWebsite: "Website",
    reportEyebrow: "Ghi nhận hiện trường",
    reportTitle: "Bạn quan sát thấy điều gì trên cồn?",
    reportLead:
      "Nước lên bất thường, cây có dấu hiệu lạ, hay một thiết bị trông không ổn. Mỗi ghi nhận được lưu lại kèm thời điểm và vị trí.",
  },


  /** The public threshold registry table under "Cơ sở diễn giải số liệu". */
  thresholds: {
    active: "Đang áp dụng",
    referenceOnly: "Tham chiếu — không tạo cảnh báo",
    source: "Nguồn",
    scope: "Phạm vi",
    soilTitle: "Ngưỡng tưới theo độ ẩm đất",
    soilDerived: "Tính từ đất tại chỗ",
    soilMissing: "Chưa có số liệu đất Cồn Hô",
    soilExplain:
      "Không có một con số phần trăm dùng chung. Ngưỡng tưới là hàm của chính loại đất: ngưỡng = FC − MAD × (FC − PWP) — với FC là độ ẩm ở sức chứa đồng ruộng, PWP là điểm héo vĩnh viễn, MAD là mức cho phép rút nước. Khi chưa đo được FC và PWP của đất Cồn Hô thì hệ thống không đặt ngưỡng, thay vì mượn một con số của nơi khác.",
    soilSource:
      "Nguồn: USDA/NRCS — sức chứa đồng ruộng, điểm héo vĩnh viễn và lượng nước hữu dụng. Mức MAD 50% là giả định quản lý khởi đầu khi chưa có số liệu địa phương, không phải hằng số sinh lý.",
    irrigateAt: "tưới ở",
    severity: {
      normal: "Bình thường",
      watch: "Theo dõi",
      warning: "Cảnh báo",
      critical: "Nghiêm trọng",
      low_confidence: "Độ tin cậy thấp",
    },
    basis: {
      FAO_REFERENCE: "FAO",
      CITRUS_REFERENCE: "Tham chiếu cây có múi",
      POMELO_MEKONG_REFERENCE: "Nghiên cứu bưởi ĐBSCL",
      SENSOR_QUALITY: "Chất lượng phép đo",
      DEVICE_HEALTH: "Kỹ thuật thiết bị",
      SITE_CALIBRATED: "Hiệu chuẩn tại chỗ",
      LEGACY_UNVALIDATED: "Chưa kiểm chứng",
    },
    validation: {
      REFERENCE: "Tham chiếu",
      PILOT: "Thí điểm",
      OPERATIONAL: "Đang áp dụng",
      SITE_VALIDATED: "Đã kiểm chứng tại chỗ",
    },
    quantity: {
      water_ec: "EC nước tưới (ECw)",
      water_ph: "pH nước",
      water_salinity: "Độ mặn nước (‰)",
      water_level: "Mực nước",
      soil_ec_bulk: "EC đất tại chỗ (bulk)",
      soil_ec_saturated_extract: "EC đất chiết bão hòa (ECe)",
      soil_ph: "pH đất",
      soil_moisture: "Độ ẩm đất",
      soil_temp: "Nhiệt độ đất",
      air_temp: "Nhiệt độ không khí",
      air_humidity: "Độ ẩm không khí",
      battery_voltage: "Điện áp pin",
      signal_dbm: "Cường độ tín hiệu",
    },
  },

  metricLabels: {
    waterEc: "EC nước",
    waterTemp: "Nhiệt độ nước",
    salinity: "Độ mặn",
    waterLevel: "Mực nước",
    moisture: "Độ ẩm",
    ec: "EC",
    ph: "Độ pH",
    temperature: "Nhiệt độ",
    humidity: "Độ ẩm",
    signal: "Tín hiệu",
    battery: "Pin",
    wind: "Gió",
    precipitation: "Lượng mưa",
  },

  /** Measurement labels, sourced from the terminology contract so the two can never drift. */
  terms: {
    water: "Nước",
    soil: "Đất",
    salinity: TERMINOLOGY.salinity.vi,
    waterLevel: TERMINOLOGY.waterLevel.vi,
    soilEc: TERMINOLOGY.soilEc.vi,
    soilMoisture: TERMINOLOGY.soilMoisture.vi,
    soilPh: TERMINOLOGY.soilPh.vi,
    soilTemp: TERMINOLOGY.soilTemp.vi,
    airTemp: TERMINOLOGY.airTemp.vi,
    airHumidity: TERMINOLOGY.airHumidity.vi,
    battery: TERMINOLOGY.battery.vi,
    signal: TERMINOLOGY.signal.vi,
    gateway: TERMINOLOGY.gateway.vi,
  },
};

/**
 * Deliberately NOT `as const`.
 *
 * With `as const` every value narrows to its own string literal, which makes
 * `en: Dictionary` reject "Home" for not being "Trang chủ" — the type would
 * demand the English dictionary be identical to the Vietnamese one. Widening
 * to `string` keeps exactly the guarantee that matters (same keys, no
 * missing or extra entries) while letting the values differ, which is the
 * entire point of a translation.
 */
export type Dictionary = typeof vi;
