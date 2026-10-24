"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/locale-provider";
import type { MessageKey } from "@/lib/i18n/locale-provider";
import {
  LayoutDashboard,
  Receipt,
  Users,
  CreditCard,
  Percent,
  TrendingUp,
  Banknote,
  BarChart3,
  UserRound,
} from "lucide-react";

const navItems: Array<{ href: string; label: MessageKey; icon: typeof LayoutDashboard }> = [
  { href: "/dashboard", label: "nav.dashboard", icon: LayoutDashboard },
  { href: "/fees", label: "nav.fees", icon: Receipt },
  { href: "/students", label: "nav.students", icon: Users },
  { href: "/payments", label: "nav.payments", icon: CreditCard },
  { href: "/discounts", label: "nav.discounts", icon: Percent },
  { href: "/expenses", label: "nav.expenses", icon: TrendingUp },
  { href: "/payroll", label: "nav.payroll", icon: Banknote },
  { href: "/reports", label: "nav.reports", icon: BarChart3 },
  { href: "/profile", label: "nav.profile", icon: UserRound },
];

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center border-b border-sidebar-border px-6">
        <h1 className="text-lg font-semibold">{t("portal.name")}</h1>
      </div>
      <nav className="flex-1 space-y-1 p-3 overflow-y-auto" aria-label={t("nav.navLabel")}>
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md border-s-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring",
                isActive
                  ? "border-s-sidebar-primary bg-sidebar-accent text-sidebar-accent-foreground"
                  : "border-s-transparent text-sidebar-foreground hover:bg-sidebar-hover hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className={cn("h-4 w-4 shrink-0", isActive && "text-sidebar-primary")} />
              {t(item.label)}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
