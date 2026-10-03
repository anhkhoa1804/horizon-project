import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { ToolPageHeading } from "@/components/layout/tool-page-heading";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { LoginForm } from "@/components/auth/login-form";
import { SiteHeader } from "@/components/layout/site-header";
import { getI18n } from "@/lib/i18n/server";
import type { Dictionary } from "@/lib/i18n/vi";

function errorMessage(error: string | undefined, dict: Dictionary): string | null {
  switch (error) {
    case "unauthorized":
      return dict.errors.loginNotAllowed;
    case "bad-password":
      return dict.errors.loginBadPassword;
    case "rate-limited":
      return dict.errors.loginRateLimited;
    case "not-configured":
      return dict.errors.loginNotConfigured;
    default:
      return null;
  }
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; error?: string; email?: string }>;
}) {
  const params = await searchParams;
  const redirectTo = params.redirect ?? "/admin";
  const { dict } = await getI18n();
  const message = errorMessage(params.error, dict);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <SiteHeader register="admin" />
      {/* var(--header-h), not a hardcoded pixel figure: the header's resting
          height is fluid (--header-h scales 6.25rem/7rem/7.5rem across
          breakpoints and shrinks further once scrolled), so a fixed "88px"
          left over from the pre-rebrand header under- or over-shot the real
          offset depending on viewport. */}
      <main className="h-text admin-login-page">
        <ToolPageHeading title={dict.admin.title} description={dict.admin.description} />
        <div className="admin-login-composition">
          <div className="admin-login-place"><Image src="/assets/hero/hero.png" alt="" fill sizes="(max-width: 767px) 100vw, 550px" className="object-cover" /><div><span>Cồn Hô</span><strong>HORIZON</strong><Link href="/dashboard">{dict.monitoring.title}<ArrowUpRight aria-hidden /></Link></div></div>
          <div className="admin-login-entry space-y-4">
          <LoginForm redirectTo={redirectTo} />
          {message ? (
            <div className="login-submission-status space-y-3">
              <p className="text-sm text-critical" role="alert">
                {message}
              </p>
              {params.error === "unauthorized" ? <SignOutButton /> : null}
            </div>
          ) : null}

        </div>
        </div>
      </main>
    </div>
  );
}
