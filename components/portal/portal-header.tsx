"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LanguageToggle } from "@/components/portal/language-toggle";
import { useI18n } from "@/lib/i18n/locale-provider";
import { LogOut } from "lucide-react";

export function PortalHeader() {
  const router = useRouter();
  const { t } = useI18n();

  async function handleLogout() {
    await fetch("/api/session/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="hidden lg:flex h-16 items-center justify-end gap-3 border-b border-border bg-card px-6">
      <LanguageToggle />
      <Button variant="ghost" size="sm" onClick={handleLogout}>
        <LogOut className="h-4 w-4 mr-2" />
        {t("common.signOut")}
      </Button>
    </header>
  );
}
