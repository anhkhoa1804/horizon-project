import { CONTACT_CHANNELS } from "@/lib/contactChannels";
import { KeywordTitle } from "@/components/ui/keyword-title";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,

} from "lucide-react";
import { StoryQuote } from "@/components/home/story-band";
import { GalleryBento } from "@/components/home/gallery-bento";
import { NotesShowcase } from "@/components/home/notes-showcase";
import { AutoPlayVideo } from "@/components/home/auto-play-video";
import { Hero } from "@/components/home/hero";
import { HeroBackdrop } from "@/components/home/hero-backdrop";
import { Reveal } from "@/components/ui/reveal";
import { PublicShell } from "@/components/layout/public-shell";
import { getGalleryItems } from "@/lib/content/gallery";
import { getRecentPosts } from "@/lib/content/posts";
import { getI18n } from "@/lib/i18n/server";


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

// ---------------------------------------------------------------------------
// Shared blocks
// ---------------------------------------------------------------------------

const CHAPTER_EN: Record<string, string> = {
  "Ba điểm đo. Một mạng lưới.": "Three points. One network.",
  "Hai trạm đo môi trường và một gateway tạo thành lần triển khai đầu tiên ở Cồn Hô. Mỗi điểm trả lời một câu hỏi khác nhau; số liệu trực tiếp nằm ở trang Quan trắc.": "Two environmental stations and a gateway form the first deployment at Cồn Hô. Each point answers a different question; live readings are on the Observatory page.",
  "Đến Cồn Hô.": "Arriving at Cồn Hô.",
  "Chuyến đi đầu tiên: tìm hiểu nơi đây vận hành ra sao, người dân sinh sống và canh tác thế nào, và vị trí nào phù hợp để đặt trạm.": "The first trip: learning how the place works, how people live and farm, and where a station could stand.",
  "Từ những ngày đầu khảo sát đến buổi chào tạm biệt Cồn Hô: hai trạm cảm biến, một gateway và những người dân, những bạn trẻ đã cùng lắp đặt.": "From the first survey days to saying goodbye to Cồn Hô: two sensor stations, a gateway, and the residents and young people who installed them together.",
  "Cồn Hô giữa dòng sông.": "An islet in the river.",
  "Từ hiện trường.": "From the field.",
  "Ba nút. Ba vai trò.": "Three nodes. Three roles.",
  "Bản đồ Cồn Hô.": "Mapping Cồn Hô.",
  "Từ vườn tới màn hình.": "From the garden to the screen.",
  "Nhìn lại hành trình.": "Looking back.",
  "Ba hướng canh tác.": "Three growing systems.",
  "Mạng lưới hiện có.": "The current network.",
  "Nhật ký dự án.": "Field notes.",
  "Hình ảnh dự án.": "A field album.",
  "Cùng đọc Cồn Hô.": "Read Cồn Hô together.",
  "Hai trạm đo môi trường và một gateway. Mỗi nút trả lời một câu hỏi khác nhau — không phải ba trạm cảm biến.": "Two environmental stations and a gateway. Each node serves a different question.",
  "Bảy chặng, từ đầu dò đặt tại Cồn Hô tới trang Quan trắc. Mỗi chặng giữ lại dấu vết cần thiết để đọc lại dữ liệu. Đây là mô hình thí điểm cộng đồng: số liệu mang tính tham khảo, không thay thế quan trắc chính thức.": "Seven stages from the probes at Cồn Hô to the Observatory page, preserving the evidence needed to read the data. This is a community pilot: the figures are for reference and do not replace official monitoring.",
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
  "Cảm biến": "Sensors", "Bo mạch": "Board", "Sóng LoRa": "LoRa radio", "Gateway": "Gateway", "Mạng 4G": "4G network", "Lưu trữ": "Storage", "Trang Quan trắc": "Observatory page",
  "Bo mạch ở mỗi trạm đóng gói từng lần đo.": "The board in each station packs every measurement.",
  "Gửi từ trạm về gateway bằng sóng vô tuyến tầm xa.": "Sent from the station to the gateway over long-range radio.",
  "Gom gói tin từ hai trạm và kiểm tra đường truyền.": "Collects packets from both stations and checks the link.",
  "Ở Cồn Hô, biến đổi khí hậu là dòng nước, mảnh đất và khu vườn — những thay đổi người dân chạm vào mỗi ngày.": "At Cồn Hô, climate change is the water, the soil and the orchard — changes people touch every day.",
  "Báo cáo tổng kết HORIZON · Cồn Hô, 19.07.2026": "HORIZON closing report · Cồn Hô, 19 Jul 2026",
  "Người trẻ không chỉ nói về công nghệ cho môi trường, mà bắt tay xây dựng và kiểm chứng một giải pháp.": "Young people did not only talk about technology for the environment — they built a solution and tested it.",
  "Hai trạm cảm biến · một gateway · một nền tảng web": "Two sensor stations · one gateway · one web platform",
  "Một hệ thống còn được để ý để tiếp tục vận hành mới là một cam kết.": "A system that keeps being looked after so it keeps running is a commitment.",
  "Không dừng ở khoảnh khắc hoàn thành": "Beyond the moment of completion",
  "Ý nghĩa của một chân trời không nằm ở việc ta chạm tới nó, mà ở con đường ta đi.": "The meaning of a horizon is not in reaching it, but in the road we take.",
  "Tạm biệt Cồn Hô · 15.10.2026": "Farewell to Cồn Hô · 15 Oct 2026",
  "HORIZON bắt đầu từ một câu hỏi: liệu có thể giúp những thay đổi của dòng nước, mảnh đất và khu vườn trở nên dễ quan sát, dễ tiếp cận và có cơ sở hơn? Câu trả lời là giữ lại chúng theo thời điểm, vị trí và nguồn đo, để người làm vườn, nhà nghiên cứu và cộng đồng có thể cùng đọc lại.": "HORIZON began with a question: could the changes in the water, the soil and the orchard become easier to observe, easier to reach and better grounded? The answer is to keep them with their time, place and source, so growers, researchers and the community can read them back together.",
  "Cảm biến siêu âm A02YYUW của trạm nước": "A02YYUW ultrasonic sensor of the water station",
  "Đầu dò đo độ ẩm, EC và nhiệt độ đất": "Probe measuring soil moisture, EC and temperature",
  "Bo mạch gateway với ESP32-S3, module LoRa và module 4G": "Gateway board with an ESP32-S3, a LoRa module and a 4G module",
  "Đường đi của dữ liệu HORIZON": "How HORIZON data travels",
  "Đầu dò đọc nước và đất tại vị trí đặt trạm.": "The probes read the water and the soil where the station stands.",
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
  // A short topic label replaces the chapter number: same small accent eyebrow as the Observatory's
  // section labels, so the page reads as one story rather than a numbered document.
  const EYEBROW: Record<string, [string, string]> = {
    "Cồn Hô giữa dòng sông.": ["Nơi chốn", "The place"], "Đến Cồn Hô.": ["Hành trình", "The journey"],
    "Ba điểm đo. Một mạng lưới.": ["Thiết bị", "Equipment"], "Bản đồ Cồn Hô.": ["Bản đồ", "Map"],
    "Từ vườn tới màn hình.": ["Dữ liệu", "Data"], "Nhìn lại hành trình.": ["Nhìn lại", "Looking back"],
    "Ba hướng canh tác.": ["Ứng dụng", "Uses"], "Nhật ký dự án.": ["Ghi chép", "Notes"],
    "Hình ảnh dự án.": ["Hình ảnh", "Photos"], "Cùng đọc Cồn Hô.": ["Liên hệ", "Contact"],
  };
  const eyebrow = EYEBROW[title]?.[locale === "en" ? 1 : 0];
  // One highlighted keyword per chapter title (the subject of the chapter).
  const KEYWORD: Record<string, string> = {
    "Cồn Hô giữa dòng sông.": "Cồn Hô", "Đến Cồn Hô.": "Cồn Hô", "Ba điểm đo. Một mạng lưới.": "Một mạng lưới",
    "Bản đồ Cồn Hô.": "Cồn Hô", "Từ vườn tới màn hình.": "màn hình", "Nhìn lại hành trình.": "hành trình",
    "Ba hướng canh tác.": "canh tác", "Nhật ký dự án.": "Nhật ký", "Hình ảnh dự án.": "Hình ảnh", "Cùng đọc Cồn Hô.": "Cồn Hô",
    "An islet in the river.": "islet", "Arriving at Cồn Hô.": "Cồn Hô", "Three points. One network.": "One network",
    "Mapping Cồn Hô.": "Cồn Hô", "From the garden to the screen.": "screen", "Looking back.": "Looking back",
    "Three growing systems.": "growing systems", "Field notes.": "Field notes", "A field album.": "field album", "Read Cồn Hô together.": "Cồn Hô",
  };
  return (
    <div id={number ? `chapter-${number}` : undefined} className={`chapter-heading h-text ${className ?? ""}`}>
      {eyebrow ? <span className="chapter-eyebrow">{eyebrow}</span> : null}
      <h2 className="chapter-heading__title max-w-4xl text-3xl font-semibold leading-[1.08] tracking-tight md:text-5xl"><KeywordTitle text={heading} keyword={KEYWORD[heading] ?? heading} /></h2>
      {lead ? <p className="mt-4 max-w-[68ch] text-base leading-relaxed text-muted md:text-lg">{locale === "en" ? CHAPTER_EN[lead] ?? lead : lead}</p> : null}
    </div>
  );
}

/** Reading-measure prose, so every essay chapter sits on one measure. */
function Prose({ children }: { children: React.ReactNode }) {
  return <div className="mt-8 space-y-6 text-lg leading-relaxed text-muted">{children}</div>;
}

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
  { step: "Cảm biến", text: "Đầu dò đọc nước và đất tại vị trí đặt trạm." },
  { step: "Bo mạch", text: "Bo mạch ở mỗi trạm đóng gói từng lần đo." },
  { step: "Sóng LoRa", text: "Gửi từ trạm về gateway bằng sóng vô tuyến tầm xa." },
  { step: "Gateway", text: "Gom gói tin từ hai trạm và kiểm tra đường truyền." },
  { step: "Mạng 4G", text: "Đưa dữ liệu rời cồn lên internet." },
  { step: "Lưu trữ", text: "Lưu giá trị, thời điểm và nguồn dữ liệu." },
  { step: "Trang Quan trắc", text: "Đọc chuỗi số liệu cùng ngưỡng và giới hạn." },
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
          <h3>{tx(locale, step)}</h3>
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
          <div className="atlas-use-case__body">
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
  id: "rksAkYJWK40",
  title: "[HORIZON] HÀNH TRÌNH KIẾN TẠO THÍCH ỨNG TỪ NHỊP THỞ CỒN HÔ",
} as const;

const FIELD_STORY_VIDEO = {
  id: "nxzUXsiGGFU",
  title: "[HORIZON] HÀNH TRÌNH ĐẾN CỒN HÔ 2026",
} as const;

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
                <p>{tx(locale, "HORIZON bắt đầu từ một câu hỏi: liệu có thể giúp những thay đổi của dòng nước, mảnh đất và khu vườn trở nên dễ quan sát, dễ tiếp cận và có cơ sở hơn? Câu trả lời là giữ lại chúng theo thời điểm, vị trí và nguồn đo, để người làm vườn, nhà nghiên cứu và cộng đồng có thể cùng đọc lại.")}</p>
              </Prose>
            </div>
          </Reveal>
          <Reveal className="h-text">
            <StoryQuote variant={0} text={tx(locale, "Ở Cồn Hô, biến đổi khí hậu là dòng nước, mảnh đất và khu vườn — những thay đổi người dân chạm vào mỗi ngày.")} />
          </Reveal>
          <Reveal as="section" className="atlas-documentary">
            <ChapterHeading number="02" title="Đến Cồn Hô." lead="Chuyến đi đầu tiên: tìm hiểu nơi đây vận hành ra sao, người dân sinh sống và canh tác thế nào, và vị trí nào phù hợp để đặt trạm." />
            <div className="atlas-film h-media">
              <AutoPlayVideo {...FIELD_STORY_VIDEO} captionId={`film-${FIELD_STORY_VIDEO.id}`} />
            </div>
          </Reveal>
          <Reveal stagger as="section" id="field-system" className="atlas-system scroll-mt-28">
            <ChapterHeading number="03" title="Ba điểm đo. Một mạng lưới." lead="Hai trạm đo môi trường và một gateway tạo thành lần triển khai đầu tiên ở Cồn Hô. Mỗi điểm trả lời một câu hỏi khác nhau; số liệu trực tiếp nằm ở trang Quan trắc." />
            <div className="atlas-node-grid h-media">
              {HARDWARE_GROUPS.map((group, index) => <article key={group.station} className={`atlas-node atlas-node--${group.station.toLowerCase()}`}><div className="atlas-node__image"><Image src={group.image} alt={tx(locale, group.imageAlt)} fill sizes="(min-width:900px) 40vw,100vw" className="object-cover" /></div><div className="atlas-node__text"><h3>{locale === "vi" ? group.domain : group.station === "STATION_01" ? "Water" : group.station === "STATION_02" ? "Soil & air" : "Data transmission"}</h3><span>{tx(locale, group.station === "STATION_01" ? "Nước ngoài vườn đang thay đổi thế nào?" : group.station === "STATION_02" ? "Vùng rễ đang giữ nước và thay đổi ra sao?" : "Dữ liệu có đi được từ cồn về hệ thống không?")}</span></div></article>)}</div>
          </Reveal>
          <Reveal className="h-text">
            <StoryQuote variant={1} text={tx(locale, "Người trẻ không chỉ nói về công nghệ cho môi trường, mà bắt tay xây dựng và kiểm chứng một giải pháp.")} />
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
                lead="Bảy chặng, từ đầu dò đặt tại Cồn Hô tới trang Quan trắc. Mỗi chặng giữ lại dấu vết cần thiết để đọc lại dữ liệu. Đây là mô hình thí điểm cộng đồng: số liệu mang tính tham khảo, không thay thế quan trắc chính thức."
              />
              <div className="mt-10 atlas-data-diagram">
                <WorkflowChapter />
              </div>
            </Reveal>
          </div>

                    <Reveal as="section" className="atlas-documentary">
            <ChapterHeading
              number="06" title="Nhìn lại hành trình."
              lead="Từ những ngày đầu khảo sát đến buổi chào tạm biệt Cồn Hô: hai trạm cảm biến, một gateway và những người dân, những bạn trẻ đã cùng lắp đặt."
            />
            <div className="atlas-film h-media">
              <AutoPlayVideo {...PROJECT_START_VIDEO} captionId={`film-${PROJECT_START_VIDEO.id}`} />
            </div>
          </Reveal>

          {/* 06 — Reusable application profiles */}
          <Reveal stagger as="section">
            <ChapterHeading
              number="07" title="Ba hướng canh tác."
              lead="Mỗi hướng cho thấy dữ liệu đang có, và những phép đo còn thiếu trước khi có thể ra quyết định tốt hơn."
            />
            <ApplicationProfilesChapter />
          </Reveal>

          <Reveal className="h-text">
            <StoryQuote variant={2} text={tx(locale, "Một hệ thống còn được để ý để tiếp tục vận hành mới là một cam kết.")} />
          </Reveal>

          {/* 08 — Field notes and learning */}
          <Reveal stagger as="section" id="ghi-chep" className="scroll-mt-28">
            <ChapterHeading
              number="08" title="Nhật ký dự án."
              lead="Hiệu chuẩn, nghiên cứu ngưỡng, ghi chép hiện trường và các giả định dự án đang kiểm chứng."
            />
            <div className="h-text mt-10">
              <NotesShowcase posts={posts} dict={dict} locale={locale} />
            </div>
          </Reveal>

          {/* 09 — Visual material and people */}
          <Reveal as="section">
            <ChapterHeading
              number="09" title="Hình ảnh dự án."
              lead="Cù lao, dòng sông, con người và phần cứng của mạng lưới đặt trên đó."
            />
            <div className="h-media mt-10">
              <GalleryBento items={gallery} dict={dict} />
            </div>
          </Reveal>
          <Reveal className="h-text">
            <StoryQuote variant={3} text={tx(locale, "Ý nghĩa của một chân trời không nằm ở việc ta chạm tới nó, mà ở con đường ta đi.")} />
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
            <ChapterHeading number="10" title="Cùng đọc Cồn Hô." lead="Theo dõi quan trắc, gửi ghi nhận hiện trường, hoặc liên hệ với nhóm dự án." />
            <div className="h-media mt-10">
              <div className="contact-box">
                <div className="contact-box__art">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local static asset */}
                  <img src="/assets/hero/hero.png" alt="" loading="lazy" />
                  <span className="field-place-label">Cồn Hô <span>HORIZON</span></span>
                </div>
                <div className="contact-box__invite">
                  <h3><KeywordTitle text={dict.contact.reportTitle} keyword={dict.contact.reportKeyword} /></h3>
                  <ul className="contact-box__list" aria-label={dict.contact.eyebrow}>
                    {CONTACT_CHANNELS.map(({ key, icon: Icon, label, href }) => (
                      <li key={key}>
                        <a
                          href={href}
                          target={href.startsWith("http") ? "_blank" : undefined}
                          rel={href.startsWith("http") ? "noreferrer" : undefined}
                          aria-label={`${dict.contact[key]}: ${label}`}
                        >
                          <Icon aria-hidden />
                          <span>{label}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                  <Link href="/report" className="contact-box__cta">
                    {dict.monitoring.sendReport}
                    <ArrowRight aria-hidden />
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </PublicShell>
  );
}
