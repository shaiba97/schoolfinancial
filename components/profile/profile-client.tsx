"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeCheck, ChevronRight, KeyRound, LogOut, Pencil, Phone, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n/locale-provider";
import { changeAuthPassword, getAuthMe, updateAuthMe } from "@/lib/api/profile";
import { ApiError } from "@/lib/api/client";
import type { AuthMe } from "@/lib/api/types";

/**
 * Self-service profile for the financial portal, mirroring
 * teacher/components/profile/profile-client.tsx but reduced to account data
 * only: /auth/me carries no employment record on this side, so there are no
 * department/assignments/attendance sections.
 */
function AvatarCircle({ name, photoUrl }: { name: string; photoUrl?: string | null }) {
  const [broken, setBroken] = React.useState(false);
  const src = photoUrl?.trim() ?? "";
  // Render a photo only for http(s) URLs: avatarUrl is free-text user input,
  // and next/image can't optimize arbitrary build-time-unknown URLs anyway.
  if (src && !broken && /^https?:\/\//i.test(src)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" onError={() => setBroken(true)} className="size-16 shrink-0 rounded-full object-cover ring-2 ring-border" />;
  }
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
  return (
    <span aria-hidden className="inline-flex size-16 shrink-0 items-center justify-center rounded-full bg-secondary text-xl font-semibold text-primary ring-2 ring-border">
      {initials || "?"}
    </span>
  );
}

export function ProfileClient() {
  const router = useRouter();
  const { t } = useI18n();
  const [me, setMe] = React.useState<AuthMe | null>(null);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [editOpen, setEditOpen] = React.useState(false);
  const [passwordOpen, setPasswordOpen] = React.useState(false);

  const load = React.useCallback(() => {
    getAuthMe()
      .then((me) => {
        setMe(me);
        setError("");
        setLoading(false);
      })
      .catch((e) => {
        setError(e instanceof ApiError ? e.message : t("profile.loadError"));
        setLoading(false);
      });
    // t is stable per locale; fetching once per mount is intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  function handleRetry() {
    setLoading(true);
    load();
  }

  async function handleSignOut() {
    await fetch("/api/session/logout", { method: "POST" }).catch(() => undefined);
    router.push("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error || !me) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold tracking-tight">{t("profile.title")}</h1>
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          <span>{error || t("profile.notFound")}</span>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handleRetry}>
              {t("common.retry")}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => void handleSignOut()}>
              {t("profile.signOut")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const displayName = me.fullName || t("profile.unnamed");

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-6">
          <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Link href="/dashboard">{t("profile.breadcrumbDashboard")}</Link>
            <ChevronRight size={14} aria-hidden className="shrink-0 rtl:rotate-180" />
            <span aria-current="page" className="truncate font-medium text-foreground">{t("profile.title")}</span>
          </nav>
          <div className="flex flex-col items-start gap-4 sm:flex-row">
            <AvatarCircle name={displayName} photoUrl={me.avatarUrl} />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-2xl font-semibold tracking-tight">{displayName}</h1>
              {me.phone && (
                <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Phone size={13} aria-hidden />
                  <span dir="ltr">{me.phone}</span>
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil size={14} aria-hidden /> {t("profile.editContact")}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setPasswordOpen(true)}>
                <KeyRound size={14} aria-hidden /> {t("profile.changePassword")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("profile.personalCard")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <span aria-hidden className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-secondary text-secondary-foreground">
                  <UserRound size={15} />
                </span>
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{t("profile.fullName")}</dt>
                  <dd className="mt-0.5 truncate font-medium">{displayName}</dd>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span aria-hidden className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-secondary text-secondary-foreground">
                  <Phone size={15} />
                </span>
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{t("profile.phone")}</dt>
                  <dd className="mt-0.5 truncate font-medium">
                    {me.phone ? <span dir="ltr">{me.phone}</span> : <span className="text-muted-foreground">{t("profile.notProvided")}</span>}
                  </dd>
                </div>
              </div>
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-6">
            <div>
              <p className="text-sm font-medium">{t("profile.signOutCard")}</p>
              <p className="text-xs text-muted-foreground">{t("profile.signOutHint")}</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => void handleSignOut()}>
              <LogOut size={14} aria-hidden /> {t("profile.signOut")}
            </Button>
          </CardContent>
        </Card>
      </div>

      {editOpen && (
        <EditContactDialog
          open
          me={me}
          onOpenChange={setEditOpen}
          onSaved={() => {
            setEditOpen(false);
            setLoading(true);
            load();
          }}
        />
      )}
      {passwordOpen && <PasswordDialog open onOpenChange={setPasswordOpen} />}
    </div>
  );
}

function EditContactDialog({
  open,
  me,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  me: AuthMe;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [fullName, setFullName] = React.useState(me.fullName ?? "");
  const [phone, setPhone] = React.useState(me.phone ?? "");
  const [avatarUrl, setAvatarUrl] = React.useState(me.avatarUrl ?? "");
  const [pending, setPending] = React.useState(false);
  const [formError, setFormError] = React.useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!fullName.trim()) {
      setFormError(t("profile.fullNameRequired"));
      return;
    }
    setPending(true);
    setFormError("");
    try {
      await updateAuthMe({
        fullName: fullName.trim(),
        phone: phone.trim(),
        avatarUrl: avatarUrl.trim(),
      });
      onSaved();
    } catch (cause) {
      setFormError(cause instanceof ApiError ? cause.message : t("profile.saveError"));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!pending) onOpenChange(o); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("profile.contactTitle")}</DialogTitle>
        </DialogHeader>
        <form className="space-y-4 p-6 pt-2" onSubmit={(event) => void handleSubmit(event)}>
          <div className="space-y-1.5">
            <Label htmlFor="profile-full">{t("profile.fullNameField")}</Label>
            <Input id="profile-full" value={fullName} onChange={(event) => setFullName(event.target.value)} required maxLength={200} autoComplete="name" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-phone">{t("profile.phoneField")}</Label>
            <Input id="profile-phone" value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={30} inputMode="tel" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-avatar">{t("profile.avatarField")}</Label>
            <Input id="profile-avatar" value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} maxLength={500} inputMode="url" placeholder="https://…" />
          </div>
          {formError && (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          )}
          <DialogFooter className="p-0 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? t("common.saving") : t("profile.saveChanges")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [formError, setFormError] = React.useState("");
  const [done, setDone] = React.useState(false);
  const { t } = useI18n();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (newPassword.length < 8) {
      setFormError(t("profile.passwordShort"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setFormError(t("profile.passwordMismatch"));
      return;
    }
    setPending(true);
    setFormError("");
    try {
      await changeAuthPassword({ currentPassword, newPassword });
      setDone(true);
    } catch (cause) {
      setFormError(cause instanceof ApiError ? cause.message : t("profile.passwordError"));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!pending) onOpenChange(o); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("profile.passwordTitle")}</DialogTitle>
        </DialogHeader>
        {done ? (
          <div className="space-y-4 p-6 pt-2">
            <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
              <BadgeCheck size={16} className="text-success" aria-hidden />
              {t("profile.passwordDone")}
            </p>
            <DialogFooter className="p-0">
              <Button type="button" onClick={() => onOpenChange(false)}>
                {t("common.close")}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form className="space-y-4 p-6 pt-2" onSubmit={(event) => void handleSubmit(event)}>
            <div className="space-y-1.5">
              <Label htmlFor="pw-current">{t("profile.currentPassword")}</Label>
              <Input
                id="pw-current"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw-new">{t("profile.newPassword")}</Label>
              <Input
                id="pw-new"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw-confirm">{t("profile.confirmPassword")}</Label>
              <Input
                id="pw-confirm"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            {formError && (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            )}
            <DialogFooter className="p-0 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? t("common.saving") : t("profile.changePassword")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
