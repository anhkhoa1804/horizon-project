import { getI18n } from "@/lib/i18n/server";
import { PublicShell } from "@/components/layout/public-shell";
import { ToolPageHeading } from "@/components/layout/tool-page-heading";
import { ObservatoryLoading } from "@/components/monitoring/observatory-loading";

/** Route-level loading: the same page, header and canvas, with the figures still loading. */
export default async function DashboardLoading() {
  const { dict } = await getI18n();
  return (
    <PublicShell activePath="/dashboard">
      <ToolPageHeading title={dict.monitoring.title} description={dict.home.subtitle} className="h-text" />
      <ObservatoryLoading />
    </PublicShell>
  );
}
