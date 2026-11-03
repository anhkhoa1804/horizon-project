import type * as React from "react";
import { AlertTriangle, CircleAlert, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const toneStyles = {
  info: "border-border bg-muted/10 text-foreground",
  warning: "border-warning/30 bg-warning/10 text-warning",
  critical: "border-critical/30 bg-critical/10 text-critical",
};

const toneIcons = {
  info: Info,
  warning: AlertTriangle,
  critical: CircleAlert,
};

interface AlertProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  tone?: keyof typeof toneStyles;
  children: React.ReactNode;
}

/**
 * Single banner primitive for inline error/warning/info messages, replacing
 * three hand-typed near-duplicates (REDESIGN_SPECIFICATION.md §10).
 */
export function Alert({ tone = "info", children, className, role, ...props }: AlertProps) {
  const Icon = toneIcons[tone];
  return (
    <div
      role={role ?? (tone === "critical" ? "alert" : undefined)}
      className={cn(
        "flex items-start gap-3 rounded-lg border px-4 py-3 text-sm leading-relaxed",
        toneStyles[tone],
        className,
      )}
      {...props}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
