import type * as React from "react";
import { cn } from "@/lib/utils";

interface IconTileProps {
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
  /** `solid` for decorative brand accents (marketing pages); `muted` for neutral/empty-state wells. */
  tone?: "solid" | "muted";
  className?: string;
}

const sizeClasses: Record<NonNullable<IconTileProps["size"]>, string> = {
  sm: "h-10 w-10",
  md: "h-12 w-12",
  lg: "h-14 w-14",
};

const toneClasses: Record<NonNullable<IconTileProps["tone"]>, string> = {
  solid: "bg-foreground text-background",
  muted: "border border-border bg-muted/10 text-accent",
};

/**
 * The icon-in-circle pattern, previously hand-typed at three sizes with two
 * different fill treatments and no shared source (REDESIGN_SPECIFICATION.md §11).
 */
export function IconTile({ children, size = "md", tone = "solid", className }: IconTileProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full",
        sizeClasses[size],
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </div>
  );
}
