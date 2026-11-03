"use client";

import { useDict } from "@/lib/i18n/client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PublicShell } from "@/components/layout/public-shell";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const dict = useDict();
  return (
    <PublicShell activePath="/dashboard">
      <Alert tone="critical">
        <h2 className="text-h1 font-semibold tracking-tight">{dict.errors.dashboardTitle}</h2>
        <p className="mt-2 text-muted">{dict.errors.dashboardBody}</p>
        <Button className="mt-4" onClick={reset}>
          {dict.errors.retry}
        </Button>
      </Alert>
    </PublicShell>
  );
}
