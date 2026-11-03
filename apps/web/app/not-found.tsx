import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { PublicShell } from "@/components/layout/public-shell";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default async function NotFound() {
  const { dict } = await getI18n();
  return (
    <PublicShell>
      <EmptyState
        title={dict.errors.notFoundTitle}
        description={dict.errors.notFoundBody}
        cta={
          <Button asChild>
            <Link href="/dashboard">{dict.station.backToMonitoring}</Link>
          </Button>
        }
      />
    </PublicShell>
  );
}
