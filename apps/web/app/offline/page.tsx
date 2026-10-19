import { Card } from "@/components/ui/card";
import { en } from "@/lib/i18n/en";
import { vi } from "@/lib/i18n/vi";

/**
 * The service-worker offline fallback — bilingual on one card, deliberately.
 *
 * This page is PRECACHED AT BUILD TIME (see next-pwa's fallback config: it is
 * the document served when both the network and the runtime cache miss). By
 * the time a reader sees it there is no request, so there is no cookie to
 * read and no server to resolve a locale — whatever HTML was frozen into the
 * cache at build is what they get, in whatever language it was built with.
 *
 * An earlier version of this file called `getI18n()`. That silently made the
 * page dynamic, which is worse than untranslated: a dynamic route cannot be
 * precached, so the offline fallback would have stopped working offline. It
 * also still rendered Vietnamese under an English cookie, because the build
 * had no cookie either.
 *
 * Two short lines in both languages is the honest resolution. It stays fully
 * static, and neither audience meets a language they cannot read.
 */
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <Card className="max-w-md space-y-6 text-center">
        <div lang="vi">
          <h1 className="text-h1 font-semibold tracking-tight">{vi.errors.offlineTitle}</h1>
          <p className="mt-2 text-muted">{vi.errors.offlineBody}</p>
        </div>
        <div lang="en" className="border-t border-border/60 pt-6">
          <h2 className="text-h1 font-semibold tracking-tight">{en.errors.offlineTitle}</h2>
          <p className="mt-2 text-muted">{en.errors.offlineBody}</p>
        </div>
      </Card>
    </div>
  );
}
