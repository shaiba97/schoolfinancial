"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem,
} from "@/components/ui/select";
import { financialApiFetch, ApiError } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/locale-provider";
import type { MessageKey } from "@/lib/i18n/locale-provider";
import type { SiblingGroup, SiblingRelationType } from "@/lib/api/types";
import { Trash2 } from "lucide-react";

interface StudentOption { id: string; name: string; grade: string }

interface SiblingGroupsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}

const RELATION_KEYS: Record<SiblingRelationType, MessageKey> = {
  SISTERS: "sibGrp.relSisters",
  BROTHERS: "sibGrp.relBrothers",
  SISTERS_AND_BROTHERS: "sibGrp.relBoth",
};

export function SiblingGroupsDialog({ open, onOpenChange, onChanged }: SiblingGroupsDialogProps) {
  const { t } = useI18n();
  const [groups, setGroups] = useState<SiblingGroup[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [relation, setRelation] = useState<SiblingRelationType>("SISTERS_AND_BROTHERS");
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await financialApiFetch<SiblingGroup[]>("/finance/sibling-groups");
      setGroups(data);
      setError("");
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSyncNote("");
    load();
    financialApiFetch<StudentOption[]>("/finance/student-profiles")
      .then(setStudents)
      .catch(() => setStudents([]));
  }, [open, load]);

  async function syncDiscounts() {
    setSyncing(true);
    setSyncNote("");
    try {
      const res = await financialApiFetch<{ created: number; skipped: number; groupsScanned: number }>(
        "/finance/sibling-discounts/sync",
        { method: "POST", body: "{}" },
      );
      setSyncNote(t("sibGrp.syncNote", { created: res.created, skipped: res.skipped }));
      onChanged?.();
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
    } finally {
      setSyncing(false);
    }
  }

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await financialApiFetch("/finance/sibling-groups", {
        method: "POST",
        body: JSON.stringify({ name, relation, studentIds: selected }),
      });
      setName(""); setSelected([]);
      await load();
      onChanged?.();
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeMember(groupId: string, studentId: string) {
    try {
      await financialApiFetch(`/finance/sibling-groups/${groupId}/members/${studentId}`, { method: "DELETE" });
      await load();
      onChanged?.();
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
    }
  }

  async function removeGroup(id: string) {
    if (!confirm(t("sibGrp.confirmDelete"))) return;
    try {
      await financialApiFetch(`/finance/sibling-groups/${id}`, { method: "DELETE" });
      await load();
      onChanged?.();
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{t("sibGrp.title")}</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-4">
          {error && <p className="text-destructive text-sm" role="alert">{error}</p>}
          {syncNote && <p className="text-sm text-muted-foreground">{syncNote}</p>}

          <div className="flex flex-col gap-3 rounded-md border p-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="sg-name">{t("sibGrp.groupName")}</Label>
              <Input id="sg-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="sg-relation">{t("sibGrp.relation")}</Label>
              <Select value={relation} onValueChange={(v) => { if (v) setRelation(v as SiblingRelationType); }}>
                <SelectTrigger id="sg-relation" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="SISTERS">{t("sibGrp.relSisters")}</SelectItem>
                    <SelectItem value="BROTHERS">{t("sibGrp.relBrothers")}</SelectItem>
                    <SelectItem value="SISTERS_AND_BROTHERS">{t("sibGrp.relBoth")}</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>{t("sibGrp.students", { count: selected.length })}</Label>
              <div className="max-h-48 overflow-y-auto rounded-md border divide-y">
                {students.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">{t("sibGrp.noStudents")}</p>
                ) : students.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 p-2 text-sm cursor-pointer hover:bg-muted/50">
                    <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggle(s.id)} />
                    <span className="font-medium">{s.name}</span>
                    <span className="text-muted-foreground">{s.grade}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleSave} disabled={saving || selected.length < 2}>
                {saving ? t("sibGrp.saving") : t("sibGrp.createGroup")}
              </Button>
              <Button size="sm" variant="outline" onClick={syncDiscounts} disabled={syncing}>
                {syncing ? t("sibGrp.syncing") : t("sibGrp.syncToDiscounts")}
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col gap-3">{[1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : groups.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">{t("sibGrp.none")}</p>
          ) : (
            groups.map((g) => (
              <div key={g.id} className="rounded-md border p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{g.name || t("sibGrp.groupFallback")}</span>
                    <Badge variant="outline">{t(RELATION_KEYS[g.relation])}</Badge>
                  </div>
                  <Button variant="ghost" size="icon" aria-label={t("sibGrp.deleteGroupAria")} onClick={() => removeGroup(g.id)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {g.members.map((m) => (
                    <span key={m.id} className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm">
                      {m.studentName}
                      <button
                        type="button"
                        aria-label={t("sibGrp.removeAria", { name: m.studentName })}
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => removeMember(g.id, m.studentId)}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
