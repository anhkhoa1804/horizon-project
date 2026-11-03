import type * as React from "react";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  eyebrow: string;
  title: string;
  trailing?: React.ReactNode;
  className?: string;
}

/**
 * The eyebrow+title pattern used at the top of nearly every page section —
 * previously hand-repeated with slightly different markup at each call
 * site (Phase D audit, item 13). One primitive, one place to change the
 * type scale.
 */
export function SectionHeader({ eyebrow, title, trailing, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div>
        <p className="text-eyebrow uppercase tracking-[0.18em] text-accent">{eyebrow}</p>
        <h2 className="mt-1 text-h2 font-semibold tracking-tight">{title}</h2>
      </div>
      {trailing ? <div className="text-sm text-muted">{trailing}</div> : null}
    </div>
  );
}
