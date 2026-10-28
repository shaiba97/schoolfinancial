"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { financialApiFetch, ApiError } from "@/lib/api/client";
import { useCurrency } from "@/components/portal/currency-provider";
import { useI18n } from "@/lib/i18n/locale-provider";
import type { Position } from "@/lib/api/types";

export interface StaffOption {
  userId: string;
  name: string;
  staffNumber: string;
  group: "academic" | "admin";
  roleLabel: string;
}

interface StaffOptions {
  academic: StaffOption[];
  admin: StaffOption[];
}

const BLOCKED_TITLES = ["admin", "super_admin", "system_admin"];

interface AssignPositionSalaryModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
  positions: Position[];
  initial: Position | null;
}

export function AssignPositionSalaryModal({ open, onOpenChange, onSaved, positions, initial }: AssignPositionSalaryModalProps) {
  const { currency } = useCurrency();
  const { t } = useI18n();
  const [positionId, setPositionId] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [staff, setStaff] = React.useState<StaffOptions>({ academic: [], admin: [] });
  const [amount, setAmount] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [staffError, setStaffError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    if (initial) {
      setPositionId(initial.id);
      setTitle(initial.title);
      setAmount(String(initial.baseSalary));
    } else {
      setPositionId("");
      setTitle("");
      setAmount("");
    }
    setSaving(false);
    setError(null);
    setStaffError(null);
    financialApiFetch<StaffOptions>("/finance/payroll/staff-options")
      .then((s) => setStaff({ academic: s.academic ?? [], admin: s.admin ?? [] }))
      .catch((e) => {
        setStaff({ academic: [], admin: [] });
        setStaffError(e instanceof ApiError ? e.message : t("posSal.staffLoadError"));
      });
  }, [open, initial]);

  const parsed = Number(amount);
  const canSave =
    Number.isFinite(parsed) && parsed >= 0 && !saving &&
    (initial !== null || positionId !== "" || title.trim() !== "");

  async function submit() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      if (initial) {
        await financialApiFetch(`/finance/positions/${initial.id}`, {
          method: "PUT",
          body: JSON.stringify({ baseSalary: parsed }),
        });
      } else {
        // Single contract for every non-edit save: { positionKey, baseSalary }.
        // The backend upserts case-insensitively, so tab, register, and DB
        // can never disagree on the position's identity.
        const selected = positions.find((x) => x.id === positionId);
        const positionKey =
          (selected ? selected.title : "") ||
          (positionId.startsWith("new:") ? positionId.slice(4) : "") ||
          title.trim();
        await financialApiFetch("/finance/payroll/positions", {
          method: "POST",
          body: JSON.stringify({ positionKey, baseSalary: parsed }),
        });
      }
      onSaved();
      onOpenChange(false);
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError(t("posSal.saveError"));
    } finally {
      setSaving(false);
    }
  }

  // Dropdown source — staff members' POSITIONS only, never people:
  // - Academic Affairs contributes ONLY the Teacher position.
  // - Admin contributes every unique staff role (custom titles included).
  // - ADMIN / SUPER_ADMIN / SYSTEM_ADMIN never appear.
  // - Each title appears exactly ONCE, persisted rows first.
  const prettyRole = (slug: string) =>
    slug.charAt(0) + slug.slice(1).toLowerCase();
  const activePositions = React.useMemo(() => {
    const seen = new Set<string>();
    return positions.filter((p) => {
      if (!p.isActive) return false;
      const key = p.title.toLowerCase();
      if (BLOCKED_TITLES.includes(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [positions]);
  const rosterRoles = React.useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of [...staff.academic, ...staff.admin]) {
      const raw = s.group === "academic" ? "Teacher" : (s.roleLabel === "Teacher" ? "Teacher" : prettyRole(s.roleLabel));
      const key = raw.toLowerCase();
      if (BLOCKED_TITLES.includes(key)) continue;
      if (!activePositions.some((p) => p.title.toLowerCase() === key)) {
        seen.set(key, raw);
      }
    }
    return [...seen.values()].sort();
  }, [staff, activePositions]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? t("posSal.editTitle") : t("posSal.createTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}
          {initial ? (
            <div className="rounded-md bg-muted p-3">
              <p className="text-sm text-muted-foreground">{t("posSal.positionRole")}</p>
              <p className="font-medium">{initial.title}</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>{t("posSal.positionRole")}</Label>
              {staffError && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{staffError}</div>
              )}
              <Select value={positionId} onValueChange={(v) => {
                if (!v) return;
                setPositionId(v);
                setTitle("");
                const p = positions.find((x) => x.id === v);
                if (p) setAmount(String(p.baseSalary));
              }}>
                <SelectTrigger><SelectValue placeholder={t("posSal.selectPosition")} /></SelectTrigger>
                <SelectContent>
                  {activePositions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                  ))}
                  {rosterRoles.map((r) => (
                    <SelectItem key={`new:${r}`} value={`new:${r}`}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {rosterRoles.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {t("posSal.rosterNote", { roles: rosterRoles.join(", ") })}
                </p>
              )}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="pos-amount">{t("posSal.amountLabel", { currency })}</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{currency}</span>
              <Input
                id="pos-amount"
                type="number"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="pl-14"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>{t("common.cancel")}</Button>
            <Button onClick={submit} disabled={!canSave}>
              {saving ? t("common.saving") : t("posSal.saveBtn")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
