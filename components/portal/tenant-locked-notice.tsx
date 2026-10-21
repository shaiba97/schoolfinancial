"use client";

import * as React from "react";
import { Lock } from "lucide-react";
import {
  currentTenantLock,
  TENANT_LOCK_EVENT,
  type TenantLockNotice,
} from "@/lib/tenant-lock";
import { Button } from "@/components/ui/button";

/**
 * The screen a school sees when the provider has locked it. The backend
 * refuses every request with a flat TENANT_LOCKED body; this component
 * picks that up and explains what happened instead of leaving the user
 * with a broken page.
 */
export function TenantLockedNotice() {
  const [notice, setNotice] = React.useState<TenantLockNotice | null>(
    currentTenantLock(),
  );

  React.useEffect(() => {
    function onLock(event: Event) {
      const detail = (event as CustomEvent<TenantLockNotice>).detail ?? null;
      setNotice(detail);
    }
    window.addEventListener(TENANT_LOCK_EVENT, onLock);
    setNotice(currentTenantLock());
    return () => window.removeEventListener(TENANT_LOCK_EVENT, onLock);
  }, []);

  if (!notice) return null;

  async function signOut() {
    try {
      await fetch("/api/session/logout", { method: "POST" });
    } catch {
      // The cookie may already be gone; land on the login page either way.
    } finally {
      try {
        window.sessionStorage.clear();
      } catch {
        // Storage unavailable — nothing to clear.
      }
      window.location.assign("/login");
    }
  }

  return (
    <div
      role="alertdialog"
      aria-labelledby="tenant-locked-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-4 backdrop-blur"
    >
      <div className="flex w-full max-w-md flex-col gap-4 rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-9 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <Lock size={18} aria-hidden />
          </span>
          <h2 id="tenant-locked-title" className="text-base font-semibold">
            Access suspended
          </h2>
        </div>

        <p className="text-sm text-muted-foreground">{notice.message}</p>

        <dl className="grid gap-1 border-t pt-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">School</dt>
            <dd>{notice.schoolName}</dd>
          </div>
          {notice.lockedAt ? (
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Locked on</dt>
              <dd className="font-mono text-xs">
                {new Date(notice.lockedAt).toISOString().slice(0, 10)}
              </dd>
            </div>
          ) : null}
        </dl>

        <div className="flex justify-end gap-2 border-t pt-3">
          <Button type="button" variant="outline" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
