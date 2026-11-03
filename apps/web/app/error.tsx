"use client";

import { useDict } from "@/lib/i18n/client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PublicShell } from "@/components/layout/public-shell";

/**
 * The app-wide error boundary.
 *
 * Only /dashboard had one. Every other route — /report, /about, /s/[id],
 * /admin — fell through to Next's built-in error screen: unstyled, untranslated,
 * outside the site shell, and with no way back. This is the same treatment the
 * dashboard already had, applied to the whole segment; a route that wants
 * something more specific still wins by declaring its own error.tsx.
 *
 * `error.digest` is deliberately not rendered. In production Next replaces the
 * message with an opaque digest anyway, and printing it would only give a
 * reader a hash they cannot act on — the server log is where it is useful.
 */
export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const dict = useDict();

  return (
    <PublicShell>
      <Alert tone="critical">
        <h2 className="text-h1 font-semibold tracking-tight">{dict.errors.genericTitle}</h2>
        <p className="mt-2 text-muted">{dict.errors.genericBody}</p>
        <Button className="mt-4" onClick={reset}>
          {dict.errors.retry}
        </Button>
      </Alert>
    </PublicShell>
  );
}
