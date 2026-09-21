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
        const surface = profile.kind === "water"
          ? "bg-[var(--h-domain-water)]"
          : profile.kind === "soil"
            ? "bg-[var(--h-domain-soil)]"
            : "bg-[var(--h-domain-infrastructure)]";

        return (
          <Link
            key={id}
            href={OBSERVATORY_HREF}
            className={`group flex flex-col gap-6 p-6 transition-[transform,box-shadow] duration-[var(--motion-base)] hover:-translate-y-0.5 hover:shadow-sm md:p-8 ${surface}`}
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
                  <li key={metric} className="border-b border-border/70 pb-0.5 text-[11px] text-foreground-subtle">
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
  { step: "Cellular", text: "Đưa dữ liệu rời cồn lên internet." },
  { step: "Supabase", text: "Lưu giá trị, thời điểm và nguồn dữ liệu." },
  { step: "Observatory", text: "Đọc chuỗi số liệu cùng ngưỡng và giới hạn." },
] as const;

function WorkflowChapter() {
  return (
    <ol className="grid gap-px overflow-hidden border-y border-border bg-border sm:grid-cols-2 lg:grid-cols-7">
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
  { index: "01", title: "Vườn cây giá trị cao", problem: "Giữ vùng rễ trong bối cảnh nước và thời tiết thay đổi.", available: ["Độ ẩm, EC, pH và nhiệt độ đất", "Nước, mực nước và bối cảnh không khí"], next: ["FC / PWP / MAD tại chỗ", "ET0, Kc và hiệu chuẩn theo mùa vụ"], surface: "bg-[var(--h-domain-soil)] lg:col-span-2" },
  { index: "02", title: "Lúa – Tôm", problem: "Theo dõi lúc nước, đất và mùa chuyển giữa mặn và ngọt.", available: ["Quan trắc nước và đất", "Chuỗi thời gian có thời điểm"], next: ["Mô hình mùa", "So sánh nguồn nước và phân vùng"], surface: "bg-[var(--h-domain-water)]" },
  { index: "03", title: "Lúa AWD + MRV", problem: "Giữ một hồ sơ mực nước có thể đối chiếu theo thời gian.", available: ["Mực nước siêu âm", "Telemetry và lịch sử tiếp nhận"], next: ["Hình học ống đo", "Phương pháp AWD và quy trình thẩm tra"], surface: "bg-[var(--h-domain-weather)]" },
] as const;

function ApplicationProfilesChapter() {
  return (
    <div className="mt-10 grid gap-px overflow-hidden rounded-lg border border-border bg-border lg:grid-cols-3">
      {APPLICATION_PROFILES.map((profile) => (
        <article key={profile.index} className={`flex flex-col p-6 md:p-8 ${profile.surface}`}>
          <p className="text-[11px] tracking-[0.16em] text-accent [font-family:var(--font-data)]">{profile.index}</p>
          <h3 className="mt-4 text-xl font-semibold tracking-tight">{profile.title}</h3>
          <p className="mt-2 min-h-12 text-sm leading-relaxed text-muted">{profile.problem}</p>
          <div className="mt-6 border-t border-border pt-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-safe">Dữ liệu hiện có</p>
            <ul className="mt-2 space-y-1 text-sm leading-relaxed text-muted">{profile.available.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
          <div className="mt-5 border-t border-border pt-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-watch">Lớp cần thêm</p>
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
            <ChapterHeading eyebrow="01 · Đây là Cồn Hô" title="Cồn Hô là nơi chúng tôi bắt đầu." lead="Một cù lao canh tác ở Vĩnh Long. Nước, đất và không khí thay đổi theo từng vị trí trong ngày — nên phép đo cần ở ngay gần vườn." />
          </Reveal>
          <Reveal as="section" className="full-bleed">
            <figure className="h-spatial relative overflow-hidden rounded-xl bg-wash-sunken">
              <Image src="/assets/1911.du-lich-con-ho1.jpg" alt="Cồn Hô nhìn từ trên cao" fill sizes="100vw" className="object-cover" />
              <figcaption className="absolute inset-x-0 bottom-0 flex flex-wrap gap-x-5 gap-y-1 bg-scrim px-5 py-3 text-sm text-white"><span>Cồn Hô · Vĩnh Long</span>{ISLAND_STATS.map((stat) => <span key={stat.label}>{stat.label} {stat.value}</span>)}</figcaption>
            </figure>
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
          <Reveal stagger as="section">
            <ChapterHeading eyebrow="02 · Ba điểm, ba vai trò" title="Ba thiết bị ở ba vị trí khác nhau." lead="Mỗi điểm trả lời một câu hỏi rõ ràng: nước đang đổi thế nào, vùng rễ đang giữ nước ra sao, và dữ liệu có đi được về hệ thống không." />
            <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-3">
              {HARDWARE_GROUPS.map((group) => <article key={group.station} className="bg-surface"><div className="relative aspect-[4/3]"><Image src={group.image} alt={group.imageAlt} fill sizes="(min-width:768px) 33vw,100vw" className="object-cover" /></div><div className="p-6"><p className="text-[11px] font-semibold tracking-[.14em] text-accent">{group.station}</p><h3 className="mt-2 text-2xl font-semibold">{group.domain}</h3><p className="mt-2 text-sm text-muted">{group.station === "STATION_01" ? "Nước ngoài vườn đang thay đổi thế nào?" : group.station === "STATION_02" ? "Vùng rễ đang giữ nước và thay đổi ra sao?" : "Dữ liệu có đi được từ cồn về hệ thống không?"}</p></div></article>)}
            </div>
          </Reveal>

          <section className="full-bleed">
            <Reveal className="h-spatial">
              <figure className="space-y-4" aria-label="Minh họa ba điểm quan trắc tại Cồn Hô">
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
                <figcaption className="text-sm text-muted">Minh họa dự án: ba điểm đo, không phải bản đồ vận hành. Bản đồ và trạng thái trạm nằm tại Quan trắc.</figcaption>
              </figure>
            </Reveal>
          </section>

          {/* 03 — The data path is a distinct story beat; the hardware roles
              above stay visual while this chapter explains the hand-off. */}
          <Reveal stagger as="section">
            <ChapterHeading
              eyebrow="03 · Một con đường dữ liệu"
              title="Một lần đo đi từ vườn tới màn hình như thế nào?"
              lead="Bảy chặng, từ đầu dò đặt tại Cồn Hô tới Observatory. Mỗi chặng giữ lại dấu vết cần thiết để đọc lại dữ liệu."
            />
            <p className="mt-6 text-sm leading-relaxed text-muted">
              EC nước, nhiệt độ nước, mực nước, TDS và độ mặn được lưu thành các đại lượng riêng. Không có phép đổi tắt từ độ mặn ‰ sang dS/m.{" "}
              <Link
                href="/posts/phan-cung-cua-mot-tram-do"
                className="text-accent underline-offset-2 hover:underline"
              >
                Vì sao chọn từng thiết bị →
              </Link>
            </p>
            <div className="mt-16 border-t border-border pt-10">
              <h3 className="text-xl font-semibold tracking-tight">Từ số đo đến ý nghĩa.</h3>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
                Một con số chỉ được đọc khi biết nó đến từ đâu, được đo lúc nào và dựa vào ngưỡng nào.
              </p>
              <div className="mt-8">
              <WorkflowChapter />
              </div>
            </div>
          </Reveal>

          {/* 04 — What a number does and does not mean */}
          <Reveal stagger as="section">
            <ChapterHeading eyebrow="04 · Từ số đo đến ý nghĩa" title="Một số đo cần bối cảnh trước khi thành kết luận." lead="Giá trị được đo, gắn thời điểm, lưu lại, đối chiếu nguồn tham chiếu rồi mới được diễn giải." />
            <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-border bg-border lg:grid-cols-[1.2fr_0.8fr]">
              <div className="grid gap-px bg-border sm:grid-cols-3">
                {["EC nước", "Độ ẩm đất", "pH đất"].map((metric, index) => <div key={metric} className={index === 0 ? "bg-[var(--h-domain-water)] p-6" : "bg-[var(--h-domain-soil)] p-6"}><p className="text-[11px] font-semibold uppercase tracking-[.14em] text-foreground-subtle">Đo tại trạm</p><p className="mt-8 text-2xl font-semibold tracking-tight">{metric}</p><p className="mt-2 text-sm text-muted">Giá trị thật được đọc tại Observatory.</p></div>)}
              </div>
              <div className="bg-surface p-6 md:p-8"><p className="text-[11px] font-semibold uppercase tracking-[.14em] text-accent">Cách đọc</p><ol className="mt-6 space-y-4 text-sm leading-relaxed text-muted"><li>01 · Đo tại cảm biến</li><li>02 · Gắn thời điểm và trạm</li><li>03 · Lưu thành chuỗi dữ liệu</li><li>04 · Đối chiếu cơ sở tham chiếu</li><li>05 · Hiển thị giới hạn của kết luận</li></ol><p className="mt-8 border-t border-border pt-4 text-sm text-foreground">EC nước không tự động là độ mặn ‰. EC đất tại chỗ cũng không phải ECe.</p></div>
            </div>
          </Reveal>

          {/* 05 — Reusable application profiles */}
          <Reveal stagger as="section">
            <ChapterHeading
              eyebrow="05 · Nhiều bài toán từ cùng dữ liệu"
              title="Ba câu hỏi có thể bắt đầu từ Cồn Hô."
              lead="Mỗi hướng cho thấy dữ liệu đang có, và những phép đo còn thiếu trước khi có thể ra quyết định tốt hơn."
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
