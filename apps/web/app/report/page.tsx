import Image from "next/image";
import { ArrowDownRight } from "lucide-react";
import { Suspense } from "react";
import { PublicShell } from "@/components/layout/public-shell";
import { ToolPageHeading } from "@/components/layout/tool-page-heading";
import { ReportForm } from "@/components/report/report-form";
import { Skeleton } from "@/components/ui/skeleton";
import { getI18n } from "@/lib/i18n/server";

function ReportFallback() {
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,0.26fr)_minmax(0,0.74fr)] lg:gap-16">
      <Skeleton className="h-40 w-full" />
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}

export default async function ReportPage() {
  const { dict, locale } = await getI18n();
  const vi = locale === "vi";

  return (
    <PublicShell activePath="/report">
      <ToolPageHeading title={dict.report.title} description={dict.report.lead} />

      <section className="report-field-opening" aria-label={dict.report.title}>
        <div className="report-field-art"><Image src="/assets/hero/hero.png" alt="" fill sizes="(max-width: 767px) 100vw, 520px" className="object-cover" /><span className="field-place-label">Cồn Hô <span>HORIZON</span></span></div>
        <div className="report-field-invitation"><h2>{vi ? <><span>Nhìn thấy.</span><span><mark>Ghi lại.</mark></span><span>Gửi đi.</span></> : <><span>Notice.</span><span><mark>Record.</mark></span><span>Share.</span></>}</h2><a href="#report-location">{vi ? "Bắt đầu ghi nhận" : "Start your report"}<ArrowDownRight aria-hidden /></a></div>
      </section>
      <section>
        <Suspense fallback={<ReportFallback />}>
          <ReportForm />
        </Suspense>
      </section>
    </PublicShell>
  );
}
