"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function PortalHeader() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/session/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="hidden lg:flex h-16 items-center justify-end border-b px-6 bg-sidebar">
      <Button variant="ghost" size="sm" onClick={handleLogout}>
        <LogOut className="h-4 w-4 mr-2" />
        Sign Out
      </Button>
    </header>
  );
}
