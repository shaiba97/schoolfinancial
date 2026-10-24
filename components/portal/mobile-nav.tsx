"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LanguageToggle } from "@/components/portal/language-toggle";
import { useI18n } from "@/lib/i18n/locale-provider";
import type { MessageKey } from "@/lib/i18n/locale-provider";
import {
  LayoutDashboard,
  Receipt,
  CreditCard,
  BarChart3,
  UserRound,
} from "lucide-react";

const mobileNavItems: Array<{ href: string; label: MessageKey; icon: typeof LayoutDashboard }> = [
  { href: "/dashboard", label: "nav.dashboard", icon: LayoutDashboard },
  { href: "/fees", label: "nav.feesShort", icon: Receipt },
  { href: "/payments", label: "nav.paymentsShort", icon: CreditCard },
  { href: "/reports", label: "nav.reportsShort", icon: BarChart3 },
  { href: "/profile", label: "nav.profile", icon: UserRound },
];

export function MobileTopBar() {
  const { t } = useI18n();
  return (
    <div className="lg:hidden flex h-14 items-center justify-between border-b border-border bg-card px-4 sticky top-0 z-40">
      <h1 className="text-base font-semibold">{t("portal.name")}</h1>
      <LanguageToggle />
    </div>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 border-t border-sidebar-border bg-sidebar text-sidebar-foreground z-40" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="flex items-center justify-around py-2">
        {mobileNavItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex flex-col items-center gap-1 px-3 py-1 text-xs focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-sidebar-ring",
                isActive
                  ? "text-sidebar-primary font-medium"
                  : "text-sidebar-foreground/60 hover:text-sidebar-foreground"
              )}
            >
              {isActive && (
                <span aria-hidden className="absolute -top-2 inset-x-2 h-0.5 rounded-full bg-sidebar-primary" />
              )}
              <item.icon className="h-5 w-5" />
              {t(item.label)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
