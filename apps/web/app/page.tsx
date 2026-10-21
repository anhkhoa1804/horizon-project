import { CONTACT_CHANNELS } from "@/lib/contactChannels";
import { KeywordTitle } from "@/components/ui/keyword-title";
import Image from "next/image";
import Link from "next/link";
import { cache, Suspense } from "react";
import {
  ArrowRight,
  ClipboardList,
  Mail,
  Send,
  Sprout,
  Waves,
} from "lucide-react";
import { GalleryStrip } from "@/components/about/gallery-strip";
import { FieldNotesCarousel } from "@/components/home/field-notes-carousel";
import { AutoPlayVideo } from "@/components/home/auto-play-video";
import { Hero } from "@/components/home/hero";
import { HeroBackdrop } from "@/components/home/hero-backdrop";
import { Reveal } from "@/components/ui/reveal";
import { PublicShell } from "@/components/layout/public-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { getGalleryItems } from "@/lib/content/gallery";
import { getRecentPosts } from "@/lib/content/posts";
import { getI18n } from "@/lib/i18n/server";
import type { Dictionary } from "@/lib/i18n/vi";
import { getPublicRepositories } from "@/lib/publicRead";
import { filterSnapshotsToPilotStations, OBSERVATORY_HREF, PILOT_STATION_IDS, type PilotStationId } from "@/lib/publicStations";
import { stationDeviceCode, stationProfiles, stationText, type StationKind } from "@/lib/stationProfile";
import type { SoilReading, StationReadingSnapshot } from "@/types";

export const revalidate = 60;

/**
 * HOME — THE CANONICAL PROJECT PAGE.
 *
 * This page absorbed /about. The two had converged into near-duplicates: both
 * opened on the island, both introduced the same three stations, both
 * explained the same data flow, both closed with the same field notes. A
 * reader had no way to tell which one answered "what is this project", and
 * maintaining the overlap meant every honesty caveat had to be written twice.
 *
 * What came across is the material About genuinely owned — the place itself,
 * the hardware, how a number becomes information, the gallery, and who is
 * building it. What did not come across is anything Home already said.
 *
 * The chapter order is the argument the project makes, in order:
 *
 *   hero → what this is → where and why → the three points → real positions →
 *   what it measures → how a reading becomes information → what it means →
 *   what it looks like → notes → who → contact → where next
 *
 * Compositions vary deliberately: reading-measure prose, a full-bleed
 * illustration, a bordered card grid, image/text splits, a horizontal strip,
 * a panel. A page where every chapter is the same card is what this replaced.
 */

const KIND_ICON: Record<StationKind, typeof Waves> = { water: Waves, soil: Sprout, gateway: Send };



interface ObservatoryData {
  /** Already filtered to the curated 3-station pilot allowlist — never the raw 5-row DB response. */
  snapshots: StationReadingSnapshot[];
  soilReading: SoilReading | null;
}

/**
 * One fetch shared by the network chapter and the map chapter, wrapped in
 * React's cache() so two independent <Suspense> consumers don't double-query
 * for the same render.
 */
const getObservatoryData = cache(async (): Promise<ObservatoryData | null> => {
  const context = getPublicRepositories();
  if (!context) return null;

  try {
    const { repos, scope } = context;
    const allSnapshots = await repos.readings.getSnapshots(scope);
    const soilReading = await repos.readings.getLatestSoilReadingByStation("STATION_02", scope);
    return { snapshots: filterSnapshotsToPilotStations(allSnapshots), soilReading };
  } catch {
    return null;
  }
});

// ---------------------------------------------------------------------------
// Shared blocks
// ---------------------------------------------------------------------------

const CHAPTER_EN: Record<string, string> = {
  "Cồn Hô giữa dòng sông.": "An islet in the river.",
  "Từ hiện trường.": "From the field.",
  "Ba nút. Ba vai trò.": "Three nodes. Three roles.",
  "Bản đồ Cồn Hô.": "Mapping Cồn Hô.",
  "Từ vườn tới màn hình.": "From the garden to the screen.",
  "Ngày khởi đầu.": "The first day.",
  "Ba hướng canh tác.": "Three growing systems.",
  "Mạng lưới hiện có.": "The current network.",
  "Nhật ký dự án.": "Field notes.",
  "Hình ảnh dự án.": "A field album.",
  "Cùng đọc Cồn Hô.": "Read Cồn Hô together.",
  "Hai trạm đo môi trường và một gateway. Mỗi nút trả lời một câu hỏi khác nhau — không phải ba trạm cảm biến.": "Two environmental stations and a gateway. Each node serves a different question.",
  "Bảy chặng, từ đầu dò đặt tại Cồn Hô tới Observatory. Mỗi chặng giữ lại dấu vết cần thiết để đọc lại dữ liệu.": "Seven stages from the probes at Cồn Hô to the Observatory, preserving the evidence needed to read the data.",
  "Mỗi hướng cho thấy dữ liệu đang có, và những phép đo còn thiếu trước khi có thể ra quyết định tốt hơn.": "Each direction identifies the available data and the measurements still needed for better decisions.",
  "Hai trạm cảm biến và một gateway tạo thành lần triển khai đầu tiên. Trạng thái dưới đây đến từ dữ liệu hệ thống; nó không thay cho kiểm chứng lắp đặt hay hiệu chuẩn ngoài hiện trường.": "Two sensor stations and a gateway form the first deployment. These statuses come from system data; field installation and calibration require separate verification.",
  "Hiệu chuẩn, nghiên cứu ngưỡng, ghi chép hiện trường và các giả định dự án đang kiểm chứng.": "Calibration, threshold research, field notes, and the assumptions being investigated.",
  "Cù lao, dòng sông, con người và phần cứng của mạng lưới đặt trên đó.": "The islet, the river, the people, and the hardware placed among them.",
  "Theo dõi quan trắc, gửi ghi nhận hiện trường, hoặc liên hệ với nhóm dự án.": "Follow the observations, record a field finding, or contact the project team."
};


/**
 * English overlay for the Vietnamese copy that the home page renders as literals.
 * Source language is Vietnamese (the project's primary audience); under the EN locale each string is looked up
 * here and falls back to the Vietnamese original, so a missing entry degrades visibly rather than breaking.
 */
const HOME_EN: Record<string, string> = {
  "Cảm biến siêu âm A02YYUW của trạm nước": "A02YYUW ultrasonic sensor of the water station",
  "Đầu dò đo độ ẩm, EC và nhiệt độ đất": "Probe measuring soil moisture, EC and temperature",
  "Bo mạch gateway với ESP32-S3, module LoRa và module 4G": "Gateway board with an ESP32-S3, a LoRa module and a 4G module",
  "Đường đi của dữ liệu HORIZON": "How HORIZON data travels",
  "Đầu dò đọc nước và đất tại vị trí đặt trạm.": "The probes read the water and the soil where the station stands.",
  "Vi điều khiển đóng gói từng lần đo.": "The microcontroller packages each measurement.",
  "Gửi từ trạm về gateway bằng liên kết tầm xa.": "Sent from the station to the gateway over a long-range link.",
  "Gom gói tin và kiểm tra đường truyền.": "The gateway collects the packets and checks the link.",
  "Đưa dữ liệu rời cồn lên internet.": "Carries the data off the islet and onto the internet.",
  "Lưu giá trị, thời điểm và nguồn dữ liệu.": "Stores the value, the time and the source of the data.",
  "Đọc chuỗi số liệu cùng ngưỡng và giới hạn.": "Reads the series together with its thresholds and limits.",
  "Vườn cây giá trị cao": "High-value orchard",
  "Lúa AWD + MRV": "AWD rice + MRV",
  "Vườn cây giá trị cao tại vùng canh tác": "High-value orchard in the growing area",
  "Mô hình canh tác lúa tôm": "Rice–shrimp farming system",
  "Lúa – Tôm": "Rice – Shrimp",
  "Ruộng lúa cho thực hành AWD và MRV": "Rice field for AWD and MRV practice",
  "Đất": "Soil",
  "Nước": "Water",
  "Thời tiết": "Weather",
  "Tưới": "Irrigation",
  "Mùa": "Season",
  "Mặn ↔ ngọt": "Saline ↔ fresh",
  "Mực nước": "Water level",
  "Thời gian": "Time",
  "Khô / ướt": "Dry / wet",
  "Độ ẩm, EC, pH, nhiệt độ đất; nước và mực nước.": "Soil moisture, EC, pH and temperature; water and water level.",
  "FC / PWP / MAD, ET0, Kc và hiệu chuẩn tại chỗ.": "FC / PWP / MAD, ET0, Kc and on-site calibration.",
  "Quan trắc nước, đất và chuỗi thời gian có thời điểm.": "Water and soil observations and time-stamped series.",
  "Mô hình mùa, so sánh nguồn nước và phân vùng.": "Season models, water-source comparison and zoning.",
  "Mực nước siêu âm và lịch sử telemetry.": "Ultrasonic water level and telemetry history.",
  "Hình học ống đo, phương pháp AWD và quy trình thẩm tra.": "Gauge-tube geometry, the AWD method and a verification process.",
  "Hiện tại · ": "Now · ",
  "Tiếp theo · ": "Next · ",
  "Cồn Hô ở Vĩnh Long là một môi trường canh tác nhỏ, nơi nước, đất và không khí có thể đổi khác theo từng vị trí trong ngày.": "Cồn Hô in Vĩnh Long is a small growing environment where water, soil and air can change from one place to the next within a single day.",
  "Ở một cù lao, thay đổi không luôn đến cùng lúc. Nước ngoài vườn, vùng rễ và đường truyền dữ liệu có những nhịp riêng — và đó là lý do phép đo cần ở gần nơi sản xuất.": "On an islet, change does not arrive everywhere at once. The water outside the orchard, the root zone and the data link each keep their own rhythm — which is why measurement has to sit close to where the crop is grown.",
  "HORIZON bắt đầu bằng việc giữ lại những thay đổi đó theo thời điểm, vị trí và nguồn đo để người làm vườn, nhà nghiên cứu và cộng đồng có thể cùng đọc lại.": "HORIZON starts by keeping those changes with their time, place and source, so growers, researchers and the community can read them back together.",
  "Chiều dài": "Length",
  "Chiều ngang": "Width",
  "Diện tích": "Area",
  "Nước ngoài vườn đang thay đổi thế nào?": "How is the water outside the orchard changing?",
  "Vùng rễ đang giữ nước và thay đổi ra sao?": "How is the root zone holding water and changing?",
  "Dữ liệu có đi được từ cồn về hệ thống không?": "Can the data make it from the islet to the system?",
  "Minh họa Cồn Hô với ba điểm quan trắc: Nước (quan trắc nước), Đất (quan trắc đất) và Gateway (truyền dữ liệu)": "Illustration of Cồn Hô with its three observation points: Water (water monitoring), Soil (soil monitoring) and Gateway (data transmission)",
  "Minh họa ba điểm quan trắc tại Cồn Hô": "Illustration of the three observation points at Cồn Hô",
  "Minh họa dự án: ba điểm đo, không phải bản đồ vận hành. Bản đồ và trạng thái trạm nằm tại Quan trắc.": "Project illustration: three measuring points, not an operational map. The map and station status are on the Observatory page.",
};
function tx(locale: string, text: string): string {
  return locale === "en" ? HOME_EN[text] ?? text : text;
}

/** Shared eyebrow+title block. Widths vary per chapter — the heading rhythm does not. */
async function ChapterHeading({
  title,
  lead,
  number,
  className,
}: {
  title: string;
  number?: string;
  lead?: string;
  className?: string;
}) {
  const { locale } = await getI18n();
  const heading = locale === "en" ? CHAPTER_EN[title] ?? title : title;
  const subjects: Record<string,string> = {
    "Cồn Hô giữa dòng sông.": "Cồn Hô", "Từ hiện trường.": "hiện trường", "Ba nút. Ba vai trò.": "Ba vai trò", "Bản đồ Cồn Hô.": "Cồn Hô", "Từ vườn tới màn hình.": "màn hình", "Ngày khởi đầu.": "khởi đầu", "Ba hướng canh tác.": "canh tác", "Mạng lưới hiện có.": "Mạng lưới", "Nhật ký dự án.": "Nhật ký", "Hình ảnh dự án.": "Hình ảnh", "Cùng đọc Cồn Hô.": "Cồn Hô",
    "An islet in the river.": "islet", "From the field.": "field", "Three nodes. Three roles.": "Three roles", "Mapping Cồn Hô.": "Cồn Hô", "From the garden to the screen.": "screen", "The first day.": "first day", "Three growing systems.": "growing systems", "The current network.": "network", "Field notes.": "Field notes", "A field album.": "field album", "Read Cồn Hô together.": "Cồn Hô"
  };
  return (
    <div id={number ? `chapter-${number}` : undefined} className={`chapter-heading h-text ${className ?? ""}`}>
      {number ? <span className="chapter-number">{number}</span> : null}
      <h2 className="chapter-heading__title max-w-4xl text-3xl font-semibold leading-[1.08] tracking-tight md:text-5xl"><KeywordTitle text={heading} keyword={subjects[heading]} /></h2>
      {lead ? <p className="mt-4 max-w-[68ch] text-base leading-relaxed text-muted md:text-lg">{locale === "en" ? CHAPTER_EN[lead] ?? lead : lead}</p> : null}
    </div>
  );
}

/** Reading-measure prose, so every essay chapter sits on one measure. */
function Prose({ children }: { children: React.ReactNode }) {
  return <div className="mt-8 space-y-6 text-lg leading-relaxed text-muted">{children}</div>;
}

/** Printed on the station-map illustration — read off the asset, not estimated here. */
const ISLAND_STATS = [
  { label: "Chiều dài", value: "~1.000 m" },
  { label: "Chiều ngang", value: "~300 m" },
  { label: "Diện tích", value: "~18–20 ha" },
] as const;

// ---------------------------------------------------------------------------
// The three observation points
// ---------------------------------------------------------------------------

/**
 * What each node is built to measure — capability, not current readings.
 *
 * This, with each station's role and location, is the surviving half of the
 * per-station pages. Their other half was live telemetry, which the
 * observatory shows better, so `/s/:id` now redirects there.
 */
const STATION_METRICS: Record<PilotStationId, readonly string[]> = {
  // EC and salinity are separate firmware fields with different meanings
  // (docs/SENSOR_CAPABILITY_MATRIX.md); listing only "Độ mặn" implied the
  // conductivity probe measures salinity directly.
  STATION_01: ["Mực nước", "EC nước", "Nhiệt độ nước", "Độ mặn"],
  STATION_02: ["Độ ẩm đất", "EC đất", "Độ pH đất", "Nhiệt độ đất", "Nhiệt độ không khí", "Độ ẩm không khí"],
  STATION_03: [],
};

async function NetworkChapter() {
  const { dict, locale } = await getI18n();

  return (
    <ol className="atlas-status-list h-text">
      {PILOT_STATION_IDS.map((id) => {
        const profile = stationProfiles[id];
        const text = stationText(id, dict);
        const Icon = KIND_ICON[profile.kind];
        return (
          <li key={id} className="atlas-status-list__item">
          <Link href={OBSERVATORY_HREF} className="atlas-status-row group">
            <Icon className="atlas-status-icon" aria-hidden />
            <div className="atlas-status-copy"><p className="atlas-status-id">{stationDeviceCode(id)}</p><h3>{text.name}</h3></div>
            {true ? (
              <ul className={`atlas-status-metrics ${id === "STATION_02" ? "atlas-status-metrics--soil" : ""}`}>
                {(STATION_METRICS[id].length ? STATION_METRICS[id] : ["LoRa → 4G"]).map((metric) => (
                  <li key={metric} className={id === "STATION_02" ? "network-metric-full" : undefined}>
                    {locale === "en" ? ({ "Độ mặn": "Salinity", "Mực nước": "Water level", "EC nước": "Water EC", "Nhiệt độ nước": "Water temperature", "Độ ẩm đất": "Soil moisture", "EC đất": "Soil EC", "Độ pH đất": "Soil pH", "Nhiệt độ đất": "Soil temperature", "Nhiệt độ không khí": "Air temperature", "Độ ẩm không khí": "Air humidity" } as Record<string,string>)[metric] ?? metric : metric}
                  </li>
                ))}
              </ul>
            ) : null}

          </Link>
          </li>
        );
      })}
    </ol>
  );
}

function NetworkFallback() {
  return (
    <div className="atlas-status-list">
      {[0, 1, 2].map((i) => (
        <div key={i} className="atlas-status-row bg-background p-6">
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-4 w-28" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// What the system observes
// ---------------------------------------------------------------------------

/**
 * Sensor models come from docs/SENSOR_CAPABILITY_MATRIX.md, which traces each
 * metric from physical sensor → firmware → wire contract → DB column →
 * repository → UI.
 *
 * Home renders only the part numbers, as a compact three-column index. The
 * `role` and `note` text — including the implemented Station 01 EC path — is the substance of
 * /posts/phan-cung-cua-mot-tram-do, and is kept here so the two cannot
 * describe different hardware.
 */
const HARDWARE_GROUPS = [
  {
    domain: "Nước",
    station: "STATION_01",
    image: "/assets/hardware/sensor-ultrasonic.jpg",
    imageAlt: "Cảm biến siêu âm A02YYUW của trạm nước",
    parts: [
      { part: "A02YYUW", role: "Cảm biến siêu âm đo khoảng cách tới mặt nước, từ đó suy ra mực nước.", note: null },
      {
        part: "ES-EC-WT-01",
        role: "Đầu dò độ dẫn điện và nhiệt độ nước; firmware ghi EC, TDS và độ mặn thành các trường riêng.",
        note: null,
      },
    ],
  },
  {
    domain: "Đất và không khí",
    station: "STATION_02",
    image: "/assets/hardware/sensor-soil-ec.jpg",
    imageAlt: "Đầu dò đo độ ẩm, EC và nhiệt độ đất",
    parts: [
      { part: "ES-SM-THEC-01", role: "Đầu dò cắm trong đất, đo cùng lúc độ ẩm, độ dẫn điện và nhiệt độ của đất.", note: null },
      { part: "ES-PH-SOIL-01", role: "Đầu dò đo độ pH của đất.", note: null },
      { part: "SHT30", role: "Cảm biến nhiệt độ và độ ẩm không khí ngay tại vườn.", note: null },
    ],
  },
  {
    domain: "Truyền dữ liệu",
    station: "STATION_03",
    image: "/assets/hardware/board-gateway.jpg",
    imageAlt: "Bo mạch gateway với ESP32-S3, module LoRa và module 4G",
    parts: [
      {
        part: "SX1278 (LoRa)",
        role: "Đường truyền tầm xa, điện năng thấp giữa hai trạm đo và gateway — không cần phủ sóng di động tại chỗ đặt trạm.",
        note: null,
      },
      {
        part: "Mô-đun di động",
        role: "Gateway là điểm duy nhất cần kết nối internet; nó gom dữ liệu, ký xác thực rồi gửi về hệ thống.",
        note: null,
      },
      { part: "ESP32", role: "Vi điều khiển chạy trên cả ba thiết bị, đọc cảm biến và quản lý chu kỳ gửi dữ liệu.", note: null },
    ],
  },
] as const;

// ---------------------------------------------------------------------------
// How a reading becomes information
// ---------------------------------------------------------------------------

const WORKFLOW = [
  { step: "Sensor", text: "Đầu dò đọc nước và đất tại vị trí đặt trạm." },
  { step: "ESP32", text: "Vi điều khiển đóng gói từng lần đo." },
  { step: "LoRa", text: "Gửi từ trạm về gateway bằng liên kết tầm xa." },
  { step: "Gateway", text: "Gom gói tin và kiểm tra đường truyền." },
  { step: "4G", text: "Đưa dữ liệu rời cồn lên internet." },
  { step: "Supabase", text: "Lưu giá trị, thời điểm và nguồn dữ liệu." },
  { step: "Observatory", text: "Đọc chuỗi số liệu cùng ngưỡng và giới hạn." },
] as const;

async function WorkflowChapter() {
  const { locale } = await getI18n();
  return (
    <ol className="atlas-data-path" aria-label={tx(locale, "Đường đi của dữ liệu HORIZON")}>
      {WORKFLOW.map(({ step, text }, index) => (
        <li key={step} className="atlas-data-node">
          <span className="atlas-data-index">
            {String(index + 1).padStart(2, "0")}
          </span>
          <h3>{step}</h3>
          <p>{tx(locale, text)}</p>
          {index < WORKFLOW.length - 1 ? <ArrowRight className="atlas-data-arrow" aria-hidden /> : null}
        </li>
      ))}
    </ol>
  );
}

const APPLICATION_PROFILES = [
  { index: "01", title: "Vườn cây giá trị cao", image: "/assets/vuon-cay-gia-tri-cao.webp", alt: "Vườn cây giá trị cao tại vùng canh tác", flow: ["Đất", "Nước", "Thời tiết", "Tưới"], current: "Độ ẩm, EC, pH, nhiệt độ đất; nước và mực nước.", next: "FC / PWP / MAD, ET0, Kc và hiệu chuẩn tại chỗ." },
  { index: "02", title: "Lúa – Tôm", image: "/assets/lua-tom.jpg", alt: "Mô hình canh tác lúa tôm", flow: ["Nước", "Đất", "Mùa", "Mặn ↔ ngọt"], current: "Quan trắc nước, đất và chuỗi thời gian có thời điểm.", next: "Mô hình mùa, so sánh nguồn nước và phân vùng." },
  { index: "03", title: "Lúa AWD + MRV", image: "/assets/awd.webp", alt: "Ruộng lúa cho thực hành AWD và MRV", flow: ["Mực nước", "Thời gian", "Khô / ướt"], current: "Mực nước siêu âm và lịch sử telemetry.", next: "Hình học ống đo, phương pháp AWD và quy trình thẩm tra." },
] as const;

async function ApplicationProfilesChapter() {
  const { locale } = await getI18n();
  return (
    <div className="atlas-use-cases h-media">
      {APPLICATION_PROFILES.map((profile) => (
        <article key={profile.index} className="atlas-use-case">
          <div className="atlas-use-case__image">
            <Image src={profile.image} alt={tx(locale, profile.alt)} fill sizes="(min-width:1024px) 31vw, 100vw" className="object-cover" />
          </div>
          <div className="atlas-use-case__body"><span className="chapter-number">{profile.index}</span>
            <h3>{tx(locale, profile.title)}</h3>
            <div className="atlas-use-case__flow">
            {profile.flow.map((item, flowIndex) => <span key={item} className="contents"><span>{tx(locale, item)}</span>{flowIndex < profile.flow.length - 1 ? <ArrowRight className="h-3 w-3 text-accent" aria-hidden /> : null}</span>)}
            </div>
            <p><span>{tx(locale, "Hiện tại · ")}</span>{tx(locale, profile.current)}</p>
            <p><span>{tx(locale, "Tiếp theo · ")}</span>{tx(locale, profile.next)}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

const PROJECT_START_VIDEO = {
  id: "SCH_xDue6xg",
  title: "[HORIZON] NGÀY DỰ ÁN KHỞI ĐẦU",
} as const;

const FIELD_STORY_VIDEO = {
  id: "nxzUXsiGGFU",
  title: "[HORIZON] HÀNH TRÌNH ĐẾN CỒN HÔ 2026",
} as const;

async function FieldStoryVideo() {
  const { locale } = await getI18n();
  const captionId = `field-video-${FIELD_STORY_VIDEO.id}`;

  return (
    <section aria-label={locale === "en" ? "From the field" : "Từ hiện trường"} className="atlas-field-story">
      <ChapterHeading number="02" title="Từ hiện trường." />
      <figure className="h-media mt-8 space-y-3">
        <AutoPlayVideo {...FIELD_STORY_VIDEO} captionId={captionId} />
        <figcaption id={captionId} lang="vi" className="text-sm text-muted">
          {FIELD_STORY_VIDEO.title}
        </figcaption>
      </figure>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function HomePage() {
  // All notes, not a slice: the standalone journal list was retired with /about,
  // so the carousel is the only index and a sliced list left older posts
  // with no entry point except the related rail.
  const posts = getRecentPosts(24);
  const gallery = getGalleryItems();
  const { dict, locale } = await getI18n();

  return (
    <PublicShell activePath="/" backdrop={<HeroBackdrop />}>
      <Hero />

      <div className="field-atlas-flow">

        <div id="horizon" className="home-chapters scroll-mt-28">
          {/* 01 — What HORIZON is.
              The hero's old pilot caption ("Giai đoạn thí điểm · thiết bị chưa
              lắp đặt ngoài thực địa") is gone from under the title: a hero
              should say what a project IS, not apologise for what it is not
              yet. The same fact is stated here, where there is room to explain
              it rather than merely disclaim it — and again on the hardware
              chapter, which is where it actually bites. */}
          <Reveal stagger as="section">
            <div className="atlas-introduction">
              <ChapterHeading number="01" title="Cồn Hô giữa dòng sông." />
              <Prose>
                <p>{tx(locale, "Cồn Hô ở Vĩnh Long là một môi trường canh tác nhỏ, nơi nước, đất và không khí có thể đổi khác theo từng vị trí trong ngày.")}</p>
                <p>{tx(locale, "Ở một cù lao, thay đổi không luôn đến cùng lúc. Nước ngoài vườn, vùng rễ và đường truyền dữ liệu có những nhịp riêng — và đó là lý do phép đo cần ở gần nơi sản xuất.")}</p>
                <p>{tx(locale, "HORIZON bắt đầu bằng việc giữ lại những thay đổi đó theo thời điểm, vị trí và nguồn đo để người làm vườn, nhà nghiên cứu và cộng đồng có thể cùng đọc lại.")}</p>
              </Prose>
              <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-4 text-xs text-foreground-subtle">
                <span>Vĩnh Long</span>{ISLAND_STATS.map((stat) => <span key={stat.label}>{tx(locale, stat.label)} {stat.value}</span>)}
              </div>
            </div>
          </Reveal>
          <Reveal>
            <FieldStoryVideo />
          </Reveal>
          <Reveal stagger as="section" id="field-system" className="atlas-system scroll-mt-28">
            <ChapterHeading number="03" title="Ba nút. Ba vai trò." lead="Hai trạm đo môi trường và một gateway. Mỗi nút trả lời một câu hỏi khác nhau — không phải ba trạm cảm biến." />
            <div className="atlas-node-grid h-media">
              {HARDWARE_GROUPS.map((group, index) => <article key={group.station} className={`atlas-node atlas-node--${group.station.toLowerCase()}`}><div className="atlas-node__image"><Image src={group.image} alt={tx(locale, group.imageAlt)} fill sizes="(min-width:900px) 40vw,100vw" className="object-cover" /></div><div className="atlas-node__text"><p><span>{String(index + 1).padStart(2, "0")}</span> {stationDeviceCode(group.station)}</p><h3>{locale === "vi" ? group.domain : group.station === "STATION_01" ? "Water" : group.station === "STATION_02" ? "Soil & air" : "Data transmission"}</h3><span>{tx(locale, group.station === "STATION_01" ? "Nước ngoài vườn đang thay đổi thế nào?" : group.station === "STATION_02" ? "Vùng rễ đang giữ nước và thay đổi ra sao?" : "Dữ liệu có đi được từ cồn về hệ thống không?")}</span></div></article>)}
            </div>
          </Reveal>

          <Reveal as="section" aria-labelledby="chapter-04">
            <div className="atlas-introduction">
              <ChapterHeading number="04" title="Bản đồ Cồn Hô." />
            </div>
            <div className="full-bleed mt-8">
              <div className="h-spatial">
                <figure className="space-y-4" aria-label={tx(locale, "Minh họa ba điểm quan trắc tại Cồn Hô")}>
                  {/* THE BRANDED NETWORK ILLUSTRATION.
                      Replaces con-ho-station-map.png, which had "TRẠM 1 / TRẠM 2
                      / TRẠM 3" baked into its pixels — obsolete station-number
                      semantics that contradicted the role model everywhere else
                      in the product, and unfixable in code because it was raster
                      text. This is the owner's own HORIZON/FrogsLeap illustration
                      and labels the three nodes correctly: Nước, Đất, Gateway.

                      No border. A bordered full-bleed image draws a hard rule the
                      width of the viewport, which is one of the "horizontal line"
                      reports; the illustration has its own soft edges and needs
                      no frame. */}
                  {/* eslint-disable-next-line @next/next/no-img-element -- local static asset with known aspect ratio; next/image has previously failed to resolve in this project (see wordmark.tsx) */}
                  <img
                    src="/assets/map/con-ho-network-illustration.png"
                    alt={tx(locale, "Minh họa Cồn Hô với ba điểm quan trắc: Nước (quan trắc nước), Đất (quan trắc đất) và Gateway (truyền dữ liệu)")}
                    width={2000}
                    height={1414}
                    loading="lazy"
                    className="w-full"
                  />
                  <figcaption className="text-sm text-muted">{tx(locale, "Minh họa dự án: ba điểm đo, không phải bản đồ vận hành. Bản đồ và trạng thái trạm nằm tại Quan trắc.")}</figcaption>
                </figure>
              </div>
            </div>
          </Reveal>

          {/* 05 — The data path is a distinct story beat; the hardware roles
              above stay visual while this chapter explains the hand-off. */}
          <div className="full-bleed mt-10">
            <Reveal stagger as="section" className="atlas-data-section">
              <ChapterHeading
                number="05" title="Từ vườn tới màn hình."
                lead="Bảy chặng, từ đầu dò đặt tại Cồn Hô tới Observatory. Mỗi chặng giữ lại dấu vết cần thiết để đọc lại dữ liệu."
              />
              <div className="mt-10 atlas-data-diagram">
                <WorkflowChapter />
              </div>
            </Reveal>
          </div>

          <Reveal as="figure" className="atlas-documentary h-media">
            <ChapterHeading number="06" title="Ngày khởi đầu." />
            <AutoPlayVideo {...PROJECT_START_VIDEO} captionId="project-start-video-caption" />
            <figcaption id="project-start-video-caption">{PROJECT_START_VIDEO.title}</figcaption>
          </Reveal>

          {/* 06 — Reusable application profiles */}
          <Reveal stagger as="section">
            <ChapterHeading
              number="07" title="Ba hướng canh tác."
              lead="Mỗi hướng cho thấy dữ liệu đang có, và những phép đo còn thiếu trước khi có thể ra quyết định tốt hơn."
            />
            <ApplicationProfilesChapter />
          </Reveal>

          {/* 07 — Current deployment truth */}
          <Reveal stagger as="section">
            <ChapterHeading
              number="08" title="Mạng lưới hiện có."
              lead="Hai trạm cảm biến và một gateway tạo thành lần triển khai đầu tiên. Trạng thái dưới đây đến từ dữ liệu hệ thống; nó không thay cho kiểm chứng lắp đặt hay hiệu chuẩn ngoài hiện trường."
            />
            <div className="mt-10">
              <Suspense fallback={<NetworkFallback />}>
                <NetworkChapter />
              </Suspense>
            </div>
          </Reveal>

          {/* 08 — Field notes and learning */}
          <Reveal stagger as="section" id="ghi-chep" className="scroll-mt-28">
            <ChapterHeading
              number="09" title="Nhật ký dự án."
              lead="Hiệu chuẩn, nghiên cứu ngưỡng, ghi chép hiện trường và các giả định dự án đang kiểm chứng."
            />
            <div className="h-text mt-10">
              <FieldNotesCarousel posts={posts} />
            </div>
          </Reveal>

          {/* 09 — Visual material and people */}
          <Reveal as="section">
            <ChapterHeading
              number="10" title="Hình ảnh dự án."
              lead="Cù lao, dòng sông, con người và phần cứng của mạng lưới đặt trên đó."
            />
            <div className="full-bleed mt-10">
              <div className="h-spatial">
                <GalleryStrip items={gallery} />
              </div>
            </div>
          </Reveal>

          {/* 10 — Report and contact.
              CONTACT AND REPORT ARE DIFFERENT THINGS. A report is an
              environmental observation that becomes a durable row in
              Supabase; a contact is a person wanting to reach the project.
              Left states the report channel and links to it. Right lists the
              project's real, owner-provided channels as direct links —
              mailto/tel/https, nothing posted through this site — since no
              server-side email provider exists to back a submission form. */}
          <Reveal stagger as="section" id="lien-he" className="scroll-mt-28">
            <ChapterHeading number="11" title="Cùng đọc Cồn Hô." lead="Theo dõi quan trắc, gửi ghi nhận hiện trường, hoặc liên hệ với nhóm dự án." />
            <div className="atlas-contact h-text mt-10 grid gap-10 lg:grid-cols-2">
              <div className="flex flex-col gap-4 py-8">
                <div className="flex items-center gap-2 text-foreground-muted">
                  <ClipboardList className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">
                    {dict.contact.reportEyebrow}
                  </span>
                </div>
                <h3 className="text-xl font-semibold tracking-tight">{dict.contact.reportTitle}</h3>
                <p className="text-sm leading-relaxed text-muted">{dict.contact.reportLead}</p>
                <Link
                  href="/report"
                  className="mt-auto inline-flex items-center gap-2 pt-4 text-sm font-medium text-accent underline-offset-4 hover:underline"
                >
                  {dict.monitoring.sendReport}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>

              <div className="space-y-5 py-8">
                <div className="flex items-center gap-2 text-foreground-muted">
                  <Mail className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">
                    {dict.contact.eyebrow}
                  </span>
                </div>
                <p className="max-w-xl text-sm leading-relaxed text-muted">{dict.contact.lead}</p>
                <ul className="grid divide-y divide-border sm:grid-cols-2">
                  {CONTACT_CHANNELS.map(({ key, icon: Icon, label, href }) => (
                    <li key={key} className="bg-background">
                      <a
                        href={href}
                        target={href.startsWith("http") ? "_blank" : undefined}
                        rel={href.startsWith("http") ? "noreferrer" : undefined}
                        className="flex items-center gap-3 px-4 py-3.5 transition-colors duration-[var(--motion-base)] hover:bg-wash-hover"
                      >
                        <Icon className="h-4 w-4 shrink-0 text-foreground-subtle" aria-hidden />
                        <span className="min-w-0">
                          <span className="block text-[11px] font-medium uppercase tracking-[0.1em] text-foreground-subtle">
                            {dict.contact[key]}
                          </span>
                          <span className="block truncate text-sm text-foreground">{label}</span>
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </PublicShell>
  );
}
