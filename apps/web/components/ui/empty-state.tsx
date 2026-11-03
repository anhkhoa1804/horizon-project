import type * as React from "react";
import { Card } from "@/components/ui/card";
import { IconTile } from "@/components/ui/icon-tile";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description: string;
  cta?: React.ReactNode;
  className?: string;
}

/** Composes Card rather than a bespoke treatment — REDESIGN_SPECIFICATION.md §6. */
export function EmptyState({ title, description, cta, className }: EmptyStateProps) {
  return (
    <Card className={cn("p-6 text-center sm:p-8", className)}>
      <IconTile size="md" tone="muted" className="mx-auto mb-4">
        <span className="text-xl" aria-hidden>
          •
        </span>
      </IconTile>
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted">{description}</p>
      {cta && <div className="mt-6 flex justify-center">{cta}</div>}
    </Card>
  );
}
