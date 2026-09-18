import { Suspense } from "react";
import { FlaskConical } from "lucide-react";
import { getObservatoryViewModel } from "@/lib/monitoring/buildObservatory";
import { getExternalWeather } from "@/lib/external/weather";
import { getI18n } from "@/lib/i18n/server";
import { ObservatoryCanvas } from "@/components/monitoring/observatory-canvas";
import { loadThresholdRegistry, loadSoilWaterModels } from "@/lib/monitoring/thresholds";
import { HashScroll } from "@/components/ui/hash-scroll";
import { PageHero } from "@/components/layout/page-hero";
import { PublicShell } from "@/components/layout/public-shell";
import DashboardLoading from "./loading";

export const revalidate = 60;

// Demo mode: ?mode=demo. Never activated silently — it takes an explicit,
// visible query param, defaults to real, makes no repository calls
// (buildDemoObservatory() is pure local data), and carries no persistent
// state. It exists for design review, presentations, and visual QA of what
// the observatory looks like with telemetry flowing; the canvas renders an
// unmissable banner whenever it is active.
function resolveMode(raw: string | string[] | undefined): "real" | "demo" {
  return raw === "demo" ? "demo" : "real";
}

async function MonitoringContent({ mode }: { mode: "real" | "demo" }) {
  const { dict } = await getI18n();
  // External context is fetched alongside the model. It shares the canvas but
  // never the provenance — see lib/monitoring/signals.ts. A failure here
  // resolves to null and costs the page nothing.
  //
  // The dictionary is threaded INTO the builder rather than applied at render
  // because the view model bakes station names, the gateway capability note
  // and the whole reference panel as strings. Building it language-blind is
  // what left "Trạm Nước" untranslated on the English observatory.
  const [model, weather] = await Promise.all([
    getObservatoryViewModel(mode, dict),
    getExternalWeather(),
  ]);
  // The registry is public: the basis for every interpretation is part of what
  // this page publishes, not operator-only configuration.
  const [thresholds, soilModels] = await Promise.all([
    loadThresholdRegistry(),
    loadSoilWaterModels(),
  ]);

  return (
    <ObservatoryCanvas
      model={model}
      weather={weather}
      thresholds={thresholds}
      soilModels={soilModels}
    />
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string | string[] }>;
}) {
  const params = await searchParams;
  const mode = resolveMode(params.mode);
  const { dict } = await getI18n();

  return (
    <PublicShell activePath="/dashboard">
      {/* The PWA install prompt used to open this page: a full Card, above
          the title, advertising the app before the reader had seen a single
          measurement. It now lives on Home — the page a first-time visitor
          actually arrives on — as a compact bar. Monitoring opens on its
          subject. */}

      {/* Same hero grammar as About and Report. This page previously used a
          smaller title tier and a tighter eyebrow than the other three, which
          is what made Monitoring read as a utility screen rather than a
          sibling of the pages that link to it.

          No `actions` at all now. "Gửi báo cáo hiện trường" was the last one
          standing, and it went for the same reason "Về dự án" did before it:
          Báo cáo is in the header on every viewport, so the button bought
          nothing and cost the observatory a screen. On a monitoring page the
          measurements should be the first thing a reader reaches, not the
          fourth. The demo flag stays — it changes how every number below
          should be read, which is the bar `aside` has to clear. */}
      {/* `/dashboard#observatory` is the QR deep-link target and where
          /s/:id redirects. The Bento streams in behind Suspense, so the
          browser's own one-shot hash resolution finds nothing — see
          HashScroll. */}
      <HashScroll />

      <PageHero
        scale="observatory"
        eyebrow={dict.monitoring.eyebrow}
        title={dict.monitoring.title}
        aside={
          mode === "demo" ? (
            <span className="inline-flex items-center gap-1.5 rounded-sm bg-watch-bg px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-watch">
              <FlaskConical className="h-3 w-3" aria-hidden />
              {dict.monitoring.demoBannerTitle}
            </span>
          ) : null
        }
      />

      <Suspense fallback={<DashboardLoading />}>
        <MonitoringContent mode={mode} />
      </Suspense>
    </PublicShell>
  );
}
