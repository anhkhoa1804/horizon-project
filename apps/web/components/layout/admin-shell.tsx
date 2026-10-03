import type * as React from "react";
import { cn } from "@/lib/utils";
import { SiteHeader } from "@/components/layout/site-header";
import { ToolPageHeading } from "./tool-page-heading";

interface AdminShellProps {
  email?: string;
  actions?: React.ReactNode;
  navigation?: React.ReactNode;
  /**
   * The console's page heading. Renders the operational title register —
   * deliberately the quietest of the six, because an admin console is a
   * working surface, not a cover.
   *
   * Optional only so existing call sites keep compiling; every admin route
   * should pass one. Before this existed the admin surfaces had no <h1> at
   * all, which left assistive tech with no page heading to land on.
   */
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Admin's register of the one shared header system (SiteHeader) — same brand
 * shell and same five-item global navigation as public, with the operational
 * strip (email/actions) appended below it. No footer: a dense operational
 * console, not a marketing surface.
 */
export function AdminShell({ email, actions, navigation, title, description, children, className }: AdminShellProps) {
  return (
    // Transparent, like PublicShell — the drafting-grid canvas painted in
    // RootLayout runs behind admin too, so the whole product shares one
    // surface rather than admin being its own opaque panel.
    <div className="min-h-dvh text-foreground">
      <SiteHeader register="admin" adminEmail={email} adminActions={actions} />
      <main className={cn("h-wide admin-console-layout", navigation && "admin-console-layout--with-nav", className)}>
        {navigation}
        <div className="admin-console-workspace space-y-6 py-6">
          {title ? (
            <ToolPageHeading title={title} description={description} />
          ) : null}
          {children}
        </div>
      </main>
    </div>
  );
}
