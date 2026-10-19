"use client";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useDict } from "@/lib/i18n/client";
import { isPublicNavActive, PRIMARY_NAV_LINKS } from "@/lib/publicNav";

export function MobileNavigation({ activePath }: { activePath?: string }) {
  const dict = useDict();
  return <nav aria-label={dict.nav.mobileLabel} className="mobile-dock md:hidden">
    <ul>{PRIMARY_NAV_LINKS.map(({ href, key, icon: Icon }) => {
      const active = isPublicNavActive(href, activePath);
      return <li key={href}><Link href={href} aria-current={active ? "page" : undefined} className={cn("mobile-dock__link", active && "mobile-dock__link--active")}>
        <Icon aria-hidden /><span>{dict.nav[key]}</span>
      </Link></li>;
    })}</ul>
  </nav>;
}
