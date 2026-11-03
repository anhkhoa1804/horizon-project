import type * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A neutral, non-status label — for things like allowlist source ("Gốc" /
 * "Database") or demo-mode markers, which have nothing to do with
 * environmental status and must not borrow Badge's status color vocabulary
 * (REDESIGN_SPECIFICATION.md §5/§10).
 */
export function Tag({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-xs border border-border bg-muted/10 px-2 py-0.5 text-xs font-medium text-muted",
        className,
      )}
      {...props}
    />
  );
}
