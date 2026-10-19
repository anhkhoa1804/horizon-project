import type * as React from "react";
import { cn } from "@/lib/utils";

const variants = {
  default: "border-border bg-background text-muted-foreground",
  healthy: "border-transparent bg-healthy-bg text-healthy",
  watch: "border-transparent bg-watch-bg text-watch",
  risk: "border-transparent bg-risk-bg text-risk",
  offline: "border-transparent bg-offline-bg text-offline",
  fault: "border-transparent bg-fault-bg text-fault",
};

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: keyof typeof variants }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-xs border px-2 py-0.5 text-xs font-medium",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
