import Image from "next/image";
import Link from "next/link";
import { cache, Suspense } from "react";
import {
  ArrowRight,
  ClipboardList,
  Facebook,
  Globe,
  Instagram,
  LayoutDashboard,
  Mail,
  MessageCircle,
  Phone,
  Send,
  Shield,
  Sprout,
  Waves,
} from "lucide-react";
import { MapStation, StationNetworkMap } from "@/components/dashboard/station-network-map";
import { GalleryStrip } from "@/components/about/gallery-strip";
import { FieldNotesCarousel } from "@/components/home/field-notes-carousel";
import { Hero } from "@/components/home/hero";
import { HeroBackdrop } from "@/components/home/hero-backdrop";
import { Reveal } from "@/components/ui/reveal";
import { PublicShell } from "@/components/layout/public-shell";
import { TranslationNotice } from "@/components/layout/translation-notice";
import { Skeleton } from "@/components/ui/skeleton";
import { freshnessStatus, StatusIndicator } from "@/components/ui/status-indicator";
import { getGalleryItems } from "@/lib/content/gallery";
import { getRecentPosts } from "@/lib/content/posts";
import { getI18n } from "@/lib/i18n/server";
import type { Dictionary } from "@/lib/i18n/vi";
import { STATION_COORDS } from "@/lib/geo";
import { getPublicRepositories } from "@/lib/publicRead";
import { filterSnapshotsToPilotStations, OBSERVATORY_HREF, PILOT_STATION_IDS, type PilotStationId } from "@/lib/publicStations";
import { stationProfiles, stationText, type StationKind } from "@/lib/stationProfile";
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

/**
 * A direct contact address, once the project has one it wants published.
 *
 * Deliberately `null` rather than a plausible-looking address. A contact
 * action that silently goes nowhere is worse than none, and not printing
 * things the project cannot stand behind is the whole premise here.
 */
const CONTACT_CHANNELS = [
  { key: "channelEmail", icon: Mail, label: "magnusfrog.frogsleap@gmail.com", href: "mailto:magnusfrog.frogsleap@gmail.com" },
  { key: "channelPhone", icon: Phone, label: "0867 430 045", href: "tel:+84867430045" },
  { key: "channelZalo", icon: MessageCircle, label: "Zalo OA", href: "https://zalo.me/2851935006706412776" },
  { key: "channelFacebook", icon: Facebook, label: "facebook.com/frogsleapvn", href: "https://www.facebook.com/frogsleapvn" },
  { key: "channelInstagram", icon: Instagram, label: "@frogsleap_vietnam", href: "https://www.instagram.com/frogsleap_vietnam/" },
  { key: "channelWebsite", icon: Globe, label: "frogsleap.com.vn", href: "https://frogsleap.com.vn" },
] as const satisfies readonly { key: keyof Dictionary["contact"]; icon: typeof Mail; label: string; href: string }[];

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

/**
 * STATION_02 has no environmental_readings row — its real timestamp lives on
 * soil_readings instead. Kind-aware so soil freshness is never silently read
 * as "unavailable" just because the water-shaped fields are empty.
 */
function latestTimestampFor(stationId: PilotStationId, data: ObservatoryData | null): string | null {
  if (stationProfiles[stationId].kind === "soil") {
    return data?.soilReading?.timestamp ?? null;
  }
  const snapshot = data?.snapshots.find((s) => s.station.id === stationId);
  return snapshot?.reading?.timestamp ?? snapshot?.health?.timestamp ?? null;
}

// ---------------------------------------------------------------------------
// Shared blocks
// ---------------------------------------------------------------------------

/** Shared eyebrow+title block. Widths vary per chapter — the heading rhythm does not. */
function ChapterHeading({
  eyebrow,
  title,
  lead,
  className,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight md:text-4xl">{title}</h2>
      {lead ? <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">{lead}</p> : null}
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
  STATION_01: ["Độ mặn", "Mực nước"],
  STATION_02: ["Độ ẩm đất", "EC đất", "Độ pH đất", "Nhiệt độ đất", "Nhiệt độ không khí", "Độ ẩm không khí"],
  STATION_03: [],
};

async function NetworkChapter() {
  const data = await getObservatoryData();
  const { dict } = await getI18n();

  return (
    <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3">
      {PILOT_STATION_IDS.map((id, index) => {
        const profile = stationProfiles[id];
        const text = stationText(id, dict);
        const Icon = KIND_ICON[profile.kind];
        const timestamp = latestTimestampFor(id, data);

        return (
          <Link
            key={id}
            href={OBSERVATORY_HREF}
            className="group flex flex-col gap-6 bg-background p-6 transition-colors duration-[var(--motion-base)] hover:bg-muted/20 md:p-8"
          >
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-medium tracking-[0.16em] text-muted [font-family:var(--font-data)]">
                {String(index + 1).padStart(2, "0")}
              </span>
              <Icon className="h-5 w-5 text-accent" aria-hidden />
            </div>

            <div className="flex-1 space-y-2">
              <h3 className="text-xl font-semibold tracking-tight">{text.name}</h3>
              <p className="text-sm text-muted">{text.location}</p>
              <p className="pt-1 text-sm leading-relaxed text-muted">{text.intro}</p>
            </div>

            {STATION_METRICS[id].length > 0 ? (
              <ul className="flex flex-wrap gap-x-2 gap-y-1">
                {STATION_METRICS[id].map((metric) => (
                  <li
                    key={metric}
                    className="rounded-sm border border-border/70 px-1.5 py-0.5 text-[11px] text-foreground-subtle"
                  >
                    {metric}
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="flex items-center justify-between border-t border-border/60 pt-4">
              <StatusIndicator status={freshnessStatus(timestamp)} dict={dict} compact />
              <span className="inline-flex items-center gap-1 text-xs font-medium text-accent opacity-0 transition-opacity duration-[var(--motion-base)] group-hover:opacity-100">
                {dict.nav.monitoring}
                <ArrowRight className="h-3 w-3" aria-hidden />
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function NetworkFallback() {
  return (
    <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-6 bg-background p-6 md:p-8">
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-4 w-28" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Real positions
// ---------------------------------------------------------------------------

async function MapChapter() {
  const data = await getObservatoryData();
  const { dict } = await getI18n();

  // Positions come from lib/geo, not from the snapshot rows. A station's
  // surveyed coordinate is a fact about the installation; the database column
  // is operational state that can be seeded, edited, or left at a 0,0 default
  // — and 0,0 is a real place in the Gulf of Guinea.
  const mapStations: MapStation[] = (data?.snapshots ?? []).map((snapshot) => {
    const id = snapshot.station.id as PilotStationId;
    return {
      id,
      name: stationText(id, dict).name,
      lat: STATION_COORDS[id]?.lat ?? snapshot.station.lat,
      lng: STATION_COORDS[id]?.lng ?? snapshot.station.lng,
      freshness: freshnessStatus(latestTimestampFor(id, data)),
    };
  });

  return <StationNetworkMap stations={mapStations} variant="observatory" />;
}

function MapFallback() {
  return <Skeleton className="h-[420px] w-full rounded-lg sm:h-[480px] lg:h-[560px]" />;
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
  { step: "Đo", text: "Cảm biến tại trạm đọc giá trị theo chu kỳ, kèm trạng thái của chính cảm biến đó." },
  { step: "Truyền", text: "Trạm gửi số liệu thô qua LoRa về gateway — thiết bị duy nhất cần internet." },
  { step: "Lưu", text: "Gateway ký xác thực rồi gửi lên hệ thống; dữ liệu không hợp lệ bị từ chối thay vì lưu tạm." },
  { step: "Diễn giải", text: "Mỗi giá trị được gắn thời điểm đo, tình trạng thiết bị và nguồn gốc của nó." },
  { step: "Trình bày", text: "Kết quả hiển thị công khai, kể cả khi trạng thái đúng là “chưa có dữ liệu”." },
] as const;

function WorkflowChapter() {
  return (
    <ol className="grid gap-px overflow-hidden border-y border-border bg-border sm:grid-cols-2 lg:grid-cols-5">
      {WORKFLOW.map(({ step, text }, index) => (
        <li key={step} className="space-y-3 bg-background p-6">
          <span className="text-[11px] tracking-[0.16em] text-accent [font-family:var(--font-data)]">
            {String(index + 1).padStart(2, "0")}
          </span>
          <h3 className="text-lg font-semibold tracking-tight">{step}</h3>
          <p className="text-sm leading-relaxed text-muted">{text}</p>
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Where to go next
// ---------------------------------------------------------------------------

/**
 * The three places a reader can go next — and they are exactly the three
 * non-Home entries in the primary nav.
 *
 * Admin used to have its own "Vận hành" band directly above this list, which
 * meant the page ended with two consecutive navigation blocks pointing at the
 * same set of destinations. It is a row here instead: same rhythm, one block,
 * and the operator entrance is no longer presented as a separate chapter of
 * the story when it is really just another door.
 */
const EXPLORE = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Quan trắc", text: "Xem mạng lưới và dữ liệu hiện có." },
  { href: "/report", icon: ClipboardList, label: "Báo cáo", text: "Gửi một quan sát từ hiện trường." },
  {
    href: "/admin",
    icon: Shield,
    label: "Quản trị",
    text: "Khu vực vận hành: báo cáo hiện trường, tình trạng thiết bị, ngưỡng cảnh báo. Yêu cầu đăng nhập.",
  },
] as const;

const APPLICATION_PROFILES = [
  { index: "01", title: "Vườn cây giá trị cao", equation: "Đất × nước × thời tiết → hỗ trợ quyết định tưới", available: ["Độ ẩm, EC, pH và nhiệt độ đất", "EC, nhiệt độ và mực nước", "Bối cảnh không khí"], next: ["Đo đất nhiều tầng", "FC / PWP / MAD tại chỗ", "ET0, Kc và hiệu chuẩn theo mùa vụ"] },
  { index: "02", title: "Lúa – Tôm", equation: "Nước × đất × mùa → theo dõi chuyển dịch mặn/ngọt", available: ["Quan trắc nước và đất trên cùng hạ tầng", "Chuỗi thời gian có nguồn gốc"], next: ["Mô hình mùa khô / mùa mưa", "So sánh nguồn nước và phân vùng ruộng/ao"] },
  { index: "03", title: "Lúa AWD + MRV", equation: "Mực nước × thời gian → quản lý nước và hồ sơ có thể kiểm chứng", available: ["Mực nước siêu âm", "Telemetry có thời gian và lịch sử tiếp nhận"], next: ["Hình học ống đo tại ruộng", "Phương pháp AWD và quy trình thẩm tra MRV"] },
] as const;

function ApplicationProfilesChapter() {
  return (
    <div className="mt-10 grid gap-px overflow-hidden rounded-lg border border-border bg-border lg:grid-cols-3">
      {APPLICATION_PROFILES.map((profile) => (
        <article key={profile.index} className="flex flex-col bg-background p-6 md:p-8">
          <p className="text-[11px] tracking-[0.16em] text-accent [font-family:var(--font-data)]">{profile.index}</p>
          <h3 className="mt-4 text-xl font-semibold tracking-tight">{profile.title}</h3>
          <p className="mt-2 min-h-12 text-sm leading-relaxed text-muted">{profile.equation}</p>
          <div className="mt-6 border-t border-border pt-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-safe">Đang có</p>
            <ul className="mt-2 space-y-1 text-sm leading-relaxed text-muted">{profile.available.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
          <div className="mt-5 border-t border-border pt-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-watch">Có thể mở rộng</p>
            <ul className="mt-2 space-y-1 text-sm leading-relaxed text-muted">{profile.next.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
        </article>
      ))}
    </div>
  );
}

function ExploreChapter() {
  return (
    <div className="border-t border-border">
      {EXPLORE.map(({ href, icon: Icon, label, text }) => (
        <Link
          key={href}
          href={href}
          className="group flex items-center gap-5 border-b border-border py-7 transition-colors duration-[var(--motion-base)] hover:bg-muted/20 md:gap-8 md:py-9"
        >
          <Icon className="h-5 w-5 shrink-0 text-accent md:h-6 md:w-6" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-2xl font-semibold tracking-tight md:text-3xl">{label}</span>
            <span className="mt-1 block text-sm text-muted md:text-base">{text}</span>
          </span>
          <ArrowRight
            className="h-5 w-5 shrink-0 text-muted transition-transform duration-[var(--motion-base)] group-hover:translate-x-1 group-hover:text-accent"
            aria-hidden
          />
        </Link>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function HomePage() {
  const posts = getRecentPosts(5);
  const gallery = getGalleryItems();
  const { dict } = await getI18n();

  return (
    <PublicShell activePath="/" backdrop={<HeroBackdrop />}>
      <Hero />

      <div className="h-flow-large">
        <TranslationNotice />

        <div id="horizon" className="h-flow-chapter scroll-mt-28">
          {/* 01 — What HORIZON is.
              The hero's old pilot caption ("Giai đoạn thí điểm · thiết bị chưa
              lắp đặt ngoài thực địa") is gone from under the title: a hero
              should say what a project IS, not apologise for what it is not
              yet. The same fact is stated here, where there is room to explain
              it rather than merely disclaim it — and again on the hardware
              chapter, which is where it actually bites. */}
          <Reveal stagger as="section" className="mx-auto max-w-[var(--width-reading)]">
            <ChapterHeading eyebrow="01 · Đây là Cồn Hô" title="Một cù lao nông nghiệp giữa sông." />
            <Prose>
              <p>
                Cồn Hô là nơi HORIZON bắt đầu: một dải đất canh tác nhỏ giữa các nhánh sông ở Vĩnh Long, nơi điều kiện
                nước và đất thay đổi đủ gần để một bản tin cấp tỉnh không thể trả lời câu hỏi của từng khu vườn.
              </p>
              <p>
                Đây không phải địa điểm minh họa dùng một lần. Nó là bối cảnh hiện trường đầu tiên để hạ tầng được xây,
                kiểm tra và học cách trở nên hữu ích cho những bài toán khác.
              </p>
            </Prose>
          </Reveal>
          {/* MERGE NOTE (upstream 9d189a8): a `<LocalGatewayCard>` and an
              `<InstallPrompt>` were added here on origin/main. Neither is
              wired into production Home:
                - LocalGatewayCard is bench-test scaffolding for the gateway's
                  local ingest tunnel — hardcoded English/unaccented-Vietnamese
                  strings, no useDict(), no HORIZON chapter grammar — reading
                  from apps/web/.local-gateway-data.json, a fixture file, not
                  Supabase. Shipping it as visible Home chrome would regress
                  every i18n/visual-consistency guarantee this rebuild made.
                - InstallPrompt is the PWA install banner explicitly removed
                  from Home this same pass (no replacement banner wanted).
              The component and its API route are kept in the tree — this is
              someone else's in-progress bench-testing tool, not mine to
              delete — just not rendered on the production landing page. */}


          {/* 02 — Where, and why here */}
          <Reveal stagger as="section" className="mx-auto max-w-[var(--width-reading)]">
            <ChapterHeading eyebrow="02 · Đây là HORIZON" title="Một hạ tầng quan trắc bắt đầu từ hiện trường." />
            <Prose>
              <p>
                HORIZON kết nối cảm biến hiện trường, ESP32, LoRa, gateway, internet, Supabase và đài quan trắc công khai
                thành một đường dữ liệu có thể lần ngược tới nguồn.
              </p>
              <p>
                Ba vai trò, không phải ba bản sao: một trạm đọc nước, một trạm đọc đất, và một gateway gom dữ liệu rồi
                chuyển về. Cồn Hô là lần triển khai đầu tiên; kiến trúc được xây để tái sử dụng, không phải để giả vờ đã
                là một mạng lưới quy mô lớn.
              </p>
            </Prose>
          </Reveal>

          <section className="full-bleed">
            <Reveal className="h-spatial">
              <figure className="space-y-4">
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
                  alt="Minh họa Cồn Hô với ba điểm quan trắc: Nước (quan trắc nước), Đất (quan trắc đất) và Gateway (truyền dữ liệu)"
                  width={2000}
                  height={1414}
                  loading="lazy"
                  className="w-full rounded-lg"
                />
                <figcaption className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 text-sm text-muted">
                  <span>Bản đồ minh họa, không phải ảnh vệ tinh — thể hiện vị trí tương đối của ba điểm quan trắc.</span>
                  <span className="flex flex-wrap gap-x-5 [font-family:var(--font-data)]">
                    {ISLAND_STATS.map((stat) => (
                      <span key={stat.label}>
                        {stat.label} {stat.value}
                      </span>
                    ))}
                  </span>
                </figcaption>
              </figure>
            </Reveal>
          </section>

          <Reveal as="section">
            <div className="full-bleed">
              <div className="h-spatial">
                <Suspense fallback={<MapFallback />}>
                  <MapChapter />
                </Suspense>
              </div>
            </div>
          </Reveal>

          {/* 03 — From sensing hardware to a traceable row.
              This was a full hardware chapter: three image/text splits with a
              definition list of every part. That is a good field note and a
              bad homepage section — it tripled the page's length in the
              middle, and a reader who wanted the project's story had to
              scroll through a parts list to reach the rest of it. The detail
              moved to /posts/phan-cung-cua-mot-tram-do intact; what stays is
              the claim, the honest caveat, and one way in. */}
          <Reveal stagger as="section">
            <ChapterHeading
              eyebrow="03 · Từ cảm biến đến dữ liệu"
              title="Thiết bị được chọn theo câu hỏi cần trả lời."
              lead="Mỗi đầu dò trả lời một câu hỏi về nước, đất hoặc không khí; LoRa, gateway và Supabase giữ đường đi của phép đo có thể lần ngược."
            />
            {/* Photographs of the actual built hardware, not diagrams. The
                boards exist, are populated, and carry this project's own
                Vietnamese silkscreen; the sensors are the exact part numbers
                listed beneath each one. Until this pass the chapter rendered
                no imagery at all and the page claimed no device photography
                existed — which stopped being true the moment these were
                supplied. */}
            <div className="mt-10 grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3">
              {HARDWARE_GROUPS.map((group) => (
                <div key={group.domain} className="flex flex-col bg-background">
                  <div className="relative aspect-[4/3] overflow-hidden bg-wash-sunken">
                    <Image
                      src={group.image}
                      alt={group.imageAlt}
                      fill
                      sizes="(min-width: 768px) 33vw, 100vw"
                      className="object-cover"
                    />
                  </div>
                  <div className="space-y-4 p-6 md:p-7">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="text-lg font-semibold tracking-tight">{group.domain}</h3>
                      <span className="text-[11px] uppercase tracking-[0.14em] text-muted [font-family:var(--font-data)]">
                        {group.station}
                      </span>
                    </div>
                    <ul className="space-y-1">
                      {group.parts.map(({ part }) => (
                        <li key={part} className="text-sm text-muted [font-family:var(--font-data)]">
                          {part}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm leading-relaxed text-muted">
              Firmware hiện ghi EC nước và nhiệt độ nước cùng mực nước, TDS và độ mặn. Các đại lượng này được giữ riêng;
              HORIZON không dùng một hằng số tùy ý để đổi độ mặn ‰ thành dS/m.{" "}
              <Link
                href="/posts/phan-cung-cua-mot-tram-do"
                className="text-accent underline-offset-2 hover:underline"
              >
                Vì sao chọn từng thiết bị →
              </Link>
            </p>
            <div className="mt-16 border-t border-border pt-10">
              <h3 className="text-xl font-semibold tracking-tight">Từ một đầu dò đến một dòng trên màn hình.</h3>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
                Dữ liệu được đo, truyền, lưu và trình bày theo một chuỗi có nguồn gốc — không lấp chỗ trống bằng số giả.
              </p>
              <div className="mt-8">
              <WorkflowChapter />
              </div>
            </div>
          </Reveal>

          {/* 04 — What a number does and does not mean */}
          <Reveal stagger as="section" className="mx-auto max-w-[var(--width-reading)]">
            <ChapterHeading eyebrow="04 · Mỗi con số có một nguồn gốc" title="Một con số chưa phải là một kết luận." />
            <Prose>
              <p>
                Độ mặn 1,2‰ có thể là bình thường với cây này và đáng lo với cây khác. Cùng một giá trị, đọc ở hai thời
                điểm khác nhau trong con nước, cũng mang ý nghĩa khác nhau.
              </p>
              <p>
                Vì vậy mọi giá trị trong HORIZON đi kèm nguồn gốc của nó: đây là số đo trực tiếp, số liệu cũ, ngưỡng
                tham chiếu, hay dữ liệu minh họa. Người đọc cần phân biệt được “hệ thống đo và thấy ổn” với “hệ thống
                chưa đo được”.
              </p>
            </Prose>
          </Reveal>

          {/* 05 — Reusable application profiles */}
          <Reveal stagger as="section">
            <ChapterHeading
              eyebrow="05 · Một hạ tầng. Nhiều bài toán."
              title="Từ Cồn Hô tới ba hướng ứng dụng có ranh giới rõ ràng."
              lead="Mỗi mô hình nói riêng phần HORIZON đã có và phần còn phải đo, hiệu chuẩn hoặc kiểm chứng. Không mô hình nào được trình bày như một sản phẩm đã hoàn thiện."
            />
            <ApplicationProfilesChapter />
          </Reveal>

          {/* 06 — Current deployment truth */}
          <Reveal stagger as="section">
            <ChapterHeading
              eyebrow="06 · Cồn Hô hôm nay"
              title="Mạng lưới hiện có, cùng những giới hạn hiện có."
              lead="Hai trạm cảm biến và một gateway tạo thành lần triển khai đầu tiên. Trạng thái dưới đây đến từ dữ liệu hệ thống; nó không thay cho kiểm chứng lắp đặt hay hiệu chuẩn ngoài hiện trường."
            />
            <div className="mt-10">
              <Suspense fallback={<NetworkFallback />}>
                <NetworkChapter />
              </Suspense>
            </div>
          </Reveal>

          {/* 07 — Field notes and learning */}
          <Reveal stagger as="section" id="ghi-chep" className="scroll-mt-28">
            <ChapterHeading
              eyebrow="07 · Những gì chúng tôi đang học"
              title="Ghi chép trong quá trình xây dựng."
              lead="Hiệu chuẩn, nghiên cứu ngưỡng, ghi chép hiện trường và các giả định dự án đang kiểm chứng."
            />
            <div className="mt-10">
              <FieldNotesCarousel posts={posts} />
            </div>
          </Reveal>

          {/* 08 — Visual material and people */}
          <Reveal as="section">
            <ChapterHeading
              eyebrow="08 · Hình ảnh / con người"
              title="Hình ảnh dự án."
              lead="Cù lao, dòng sông, con người và phần cứng của mạng lưới đặt trên đó."
            />
            <div className="full-bleed mt-10">
              <div className="h-spatial">
                <GalleryStrip items={gallery} />
              </div>
            </div>
          </Reveal>

          {/* 09 — Go further and contact.
              CONTACT AND REPORT ARE DIFFERENT THINGS. A report is an
              environmental observation that becomes a durable row in
              Supabase; a contact is a person wanting to reach the project.
              Left states the report channel and links to it. Right lists the
              project's real, owner-provided channels as direct links —
              mailto/tel/https, nothing posted through this site — since no
              server-side email provider exists to back a submission form. */}
          <Reveal stagger as="section" id="lien-he" className="scroll-mt-28">
            <ChapterHeading eyebrow="09 · Đi xa hơn" title="Đi sâu hơn, hoặc cùng xây tiếp." />
            <div className="mt-10 grid gap-px overflow-hidden rounded-lg border border-border bg-border lg:grid-cols-[0.85fr_1.15fr]">
              <div className="flex flex-col gap-4 bg-background p-8 md:p-10">
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

              <div className="space-y-5 bg-background p-8 md:p-10">
                <div className="flex items-center gap-2 text-foreground-muted">
                  <Mail className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">
                    {dict.contact.eyebrow}
                  </span>
                </div>
                <p className="max-w-xl text-sm leading-relaxed text-muted">{dict.contact.lead}</p>
                <ul className="grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2">
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
            <div className="mt-16 border-t border-border pt-10">
              <h3 className="mb-8 text-xl font-semibold tracking-tight">Đi sâu hơn.</h3>
              <ExploreChapter />
            </div>
          </Reveal>
        </div>
      </div>
    </PublicShell>
  );
}
