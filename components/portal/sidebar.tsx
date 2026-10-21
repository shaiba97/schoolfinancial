"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Receipt,
  Users,
  CreditCard,
  Percent,
  TrendingUp,
  Banknote,
  BarChart3,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/fees", label: "Fee Management", icon: Receipt },
  { href: "/students", label: "Student Accounts", icon: Users },
  { href: "/payments", label: "Payments & Collections", icon: CreditCard },
  { href: "/discounts", label: "Discounts & Scholarships", icon: Percent },
  { href: "/expenses", label: "Expenses", icon: TrendingUp },
  { href: "/payroll", label: "Payroll", icon: Banknote },
  { href: "/reports", label: "Financial Reports", icon: BarChart3 },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 border-r bg-sidebar">
      <div className="flex h-16 items-center border-b px-6">
        <h1 className="text-lg font-semibold">Finance Portal</h1>
      </div>
      <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
