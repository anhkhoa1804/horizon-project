import * as React from "react";
import { cn } from "@/lib/utils";

export function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "flex h-11 w-full rounded-xl border border-border bg-muted/40 px-4 py-2 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50 appearance-none md:text-sm",
        className,
      )}
      {...props}
    />
  );
}
