"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useDict } from "@/lib/i18n/client";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const dict = useDict();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!deferredPrompt || dismissed) {
    return null;
  }

  // A single quiet bar, not a Card with a heading and a description. As a
  // full card at the top of a page it advertised the app ahead of the
  // content the reader came for; the offer is the same, the volume is not.
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border px-4 py-2.5">
      <p className="min-w-0 flex-1 text-sm text-foreground-muted">
        <span className="font-medium text-foreground">{dict.pwa.installTitle}</span>
        <span className="hidden sm:inline"> · {dict.pwa.installBody}</span>
      </p>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={async () => {
            await deferredPrompt.prompt();
            setDeferredPrompt(null);
          }}
        >
          Cài đặt
        </Button>
        <Button size="sm" variant="ghost" className="text-foreground-subtle" onClick={() => setDismissed(true)}>
          Để sau
        </Button>
      </div>
    </div>
  );
}
