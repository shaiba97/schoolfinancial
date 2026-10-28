"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { financialApiFetch, ApiError } from "@/lib/api/client";
import type { FeeStructure } from "@/lib/api/types";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrency } from "@/components/portal/currency-provider";
import { useI18n } from "@/lib/i18n/locale-provider";
import type { MessageKey } from "@/lib/i18n/locale-provider";
import { formatDate } from "@/lib/utils";
import { Plus, Pencil, Trash2, Archive, MoreHorizontal } from "lucide-react";

export default function FeesPage() {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("fees.title")}</h1>
      <FeeStructuresTab />
    </div>
  );
}

interface FeeStructureActionsMenuProps {
  structure: FeeStructure;
  onEdit: () => void;
  onArchive: () => void;
  onReactivate: () => void;
  onDelete: () => void;
}

function FeeStructureActionsMenu({
  structure,
  onEdit,
  onArchive,
  onReactivate,
  onDelete,
}: FeeStructureActionsMenuProps) {
  const { t } = useI18n();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={buttonVariants({ variant: "ghost", size: "icon" })}
        aria-label={t("fees.actionsAria")}
      >
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={onEdit} disabled={!structure.active}>
          <Pencil className="h-4 w-4 mr-2" />{t("fees.edit")}
        </DropdownMenuItem>
        {structure.active ? (
          <DropdownMenuItem onClick={onArchive}>
            <Archive className="h-4 w-4 mr-2" />{t("fees.archive")}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={onReactivate}>
            <Plus className="h-4 w-4 mr-2 rotate-45" />{t("fees.reactivate")}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 className="h-4 w-4 mr-2" />{t("fees.delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const LEVEL_KEYS: Record<string, MessageKey> = {
  SECONDARY: "fees.levelSECONDARY",
  INTERMEDIATE: "fees.levelINTERMEDIATE",
};
const GRADE_KEYS: Record<string, MessageKey> = {
  FIRST: "fees.gradeFIRST",
  SECOND: "fees.gradeSECOND",
  THIRD: "fees.gradeTHIRD",
  SIXTH: "fees.gradeSIXTH",
  SEVENTH: "fees.gradeSEVENTH",
  EIGHTH: "fees.gradeEIGHTH",
  NINTH: "fees.gradeNINTH",
};

/** Canonical English name stored on the backend — not localized on purpose. */
function levelName(level: string): string {
  return level === "SECONDARY" ? "Secondary" : level === "INTERMEDIATE" ? "Intermediate" : level;
}

function gradeName(grade: string): string {
  const names: Record<string, string> = {
    FIRST: "First",
    SECOND: "Second",
    THIRD: "Third",
    SIXTH: "Sixth",
    SEVENTH: "Seventh",
    EIGHTH: "Eighth",
    NINTH: "Ninth",
  };
  return names[grade] ?? grade;
}

function frequencyName(frequency: string): string {
  return frequency === "per_term" ? "Per Term" : "Annual";
}

function FeeStructuresTab() {
  const { money } = useCurrency();
  const { t } = useI18n();
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FeeStructure | null>(null);
  const [deleting, setDeleting] = useState<FeeStructure | null>(null);
  const [tuitionFee, setTuitionFee] = useState("");
  const [registrationFee, setRegistrationFee] = useState("");
  const [frequency, setFrequency] = useState("annual");
  const [educationLevel, setEducationLevel] = useState("");
  const [grade, setGrade] = useState("");
  const [installmentCount, setInstallmentCount] = useState(1);
  const [dueDates, setDueDates] = useState<string[]>([""]);
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setEditing(null);
    setTuitionFee("");
    setRegistrationFee("");
    setFrequency("annual");
    setEducationLevel("");
    setGrade("");
    setInstallmentCount(1);
    setDueDates([""]);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (s: FeeStructure) => {
    setEditing(s);
    setTuitionFee(String(s.tuitionFee ?? 0));
    setRegistrationFee(String(s.registrationFee ?? 0));
    setFrequency(s.frequency ?? "annual");
    setEducationLevel(s.educationLevel ?? "");
    setGrade(s.grade ?? "");
    setInstallmentCount(s.installmentCount ?? 1);
    setDueDates(
      s.installmentDueDates?.length ? s.installmentDueDates.map((d) => d.slice(0, 10)) : [""],
    );
    setDialogOpen(true);
  };

  const load = useCallback(async () => {
    try {
      const structs = await financialApiFetch<FeeStructure[]>("/fees/structures");
      setStructures(structs);
      setError("");
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function changeCount(next: number) {
    setInstallmentCount(next);
    setDueDates((prev) => {
      const arr = [...prev];
      if (arr.length < next) while (arr.length < next) arr.push("");
      else arr.length = next;
      return arr;
    });
  }

  const datesValid =
    installmentCount === 1
      ? dueDates[0] !== ""
      : dueDates.every((d) => d !== "") &&
        dueDates.every((d, i) => i === 0 || d >= dueDates[i - 1]);

  const canSave =
    parseFloat(tuitionFee) > 0 &&
    datesValid;

  function autoName() {
    const parts = [
      levelName(educationLevel),
      gradeName(grade),
      frequencyName(frequency),
    ].filter(Boolean);
    return parts.length ? parts.join(" - ") : "Fee Structure";
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        name: autoName(),
        tuitionFee: parseFloat(tuitionFee),
        registrationFee: parseFloat(registrationFee) || 0,
        frequency,
        educationLevel: educationLevel || undefined,
        grade: grade || undefined,
        installmentCount,
        installmentDueDates: dueDates,
      };
      await financialApiFetch(
        editing ? `/fees/structures/${editing.id}` : "/fees/structures",
        {
          method: editing ? "PUT" : "POST",
          body: JSON.stringify(payload),
        },
      );
      setDialogOpen(false);
      resetForm();
      await load();
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
    } finally {
setSaving(false);
    }
  }

  async function handleArchive(s: FeeStructure) {
    try {
      await financialApiFetch(`/fees/structures/${s.id}/archive`, { method: "POST" });
      await load();
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
    }
  }

  async function handleReactivate(s: FeeStructure) {
    try {
      await financialApiFetch(`/fees/structures/${s.id}/unarchive`, { method: "POST" });
      await load();
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
    }
  }

  async function handleDeleteStructure() {
    if (!deleting) return;
    try {
      await financialApiFetch(`/fees/structures/${deleting.id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
    } finally {
      setDeleting(null);
    }
  }

  if (loading) return <CategoriesSkeleton />;
  if (error && structures.length === 0) return <ErrorState message={error} onRetry={load} />;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t("fees.structuresCard")}</CardTitle>
<Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />{t("fees.add")}
        </Button>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
<DialogHeader>
              <DialogTitle>{editing ? t("fees.editTitle") : t("fees.createTitle")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="struct-tuition">{t("fees.tuition")}</Label>
                  <Input id="struct-tuition" type="number" min="0.01" step="0.01" value={tuitionFee} onChange={(e) => setTuitionFee(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="struct-registration">{t("fees.registration")}</Label>
                  <Input id="struct-registration" type="number" min="0" step="0.01" value={registrationFee} onChange={(e) => setRegistrationFee(e.target.value)} />
                </div>
              </div>
              {parseFloat(registrationFee) > 0 && (
                <p className="text-xs text-muted-foreground">
                  {t("fees.registrationNote")}
                </p>
              )}
              <div className="space-y-2">
                <Label htmlFor="struct-freq">{t("fees.frequency")}</Label>
                <select id="struct-freq" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                  <option value="annual">{t("fees.freqAnnual")}</option>
                  <option value="per_term">{t("fees.freqPerTerm")}</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="struct-count">{t("fees.installments")}</Label>
                <select id="struct-count" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={installmentCount} onChange={(e) => changeCount(Number(e.target.value))}>
                  <option value={1}>{t("fees.installmentsSingleOption")}</option>
                  <option value={2}>{t("fees.installmentsCount", { count: 2 })}</option>
                  <option value={3}>{t("fees.installmentsCount", { count: 3 })}</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>{t("fees.dueDates")}</Label>
                {dueDates.map((d, i) => (
                  <div key={i} className="space-y-1">
                    <Label htmlFor={`due-${i}`} className="text-xs text-muted-foreground">{t("fees.dueNumber", { no: i + 1 })}</Label>
                    <Input
                      id={`due-${i}`}
                      type="date"
                      value={d}
                      min={i > 0 ? dueDates[i - 1] || undefined : undefined}
                      onChange={(e) => {
                        const next = [...dueDates];
                        next[i] = e.target.value;
                        setDueDates(next);
                      }}
                    />
                  </div>
                ))}
                {!datesValid && dueDates.some((d) => d !== "") && (
                  <p className="text-xs text-destructive">
                    {t("fees.dueDatesInvalid")}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="struct-level">{t("fees.educationLevel")}</Label>
                  <select id="struct-level" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={educationLevel} onChange={(e) => setEducationLevel(e.target.value)}>
                    <option value="">{t("fees.allLevels")}</option>
                    <option value="SECONDARY">{t("fees.levelSECONDARY")}</option>
                    <option value="INTERMEDIATE">{t("fees.levelINTERMEDIATE")}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="struct-grade">{t("fees.grade")}</Label>
                  <select id="struct-grade" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={grade} onChange={(e) => setGrade(e.target.value)}>
                    <option value="">{t("fees.allGrades")}</option>
                    {Object.entries(GRADE_KEYS).map(([value, key]) => (
                      <option key={value} value={value}>{t(key)}</option>
                    ))}
                  </select>
                </div>
              </div>
<Button onClick={handleSave} disabled={saving || !canSave}>
                {saving ? t("common.saving") : editing ? t("fees.saveChanges") : t("fees.save")}
              </Button>
</div>
          </DialogContent>
        </Dialog>
        <AlertDialog open={!!deleting} onOpenChange={(open) => { if (!open) setDeleting(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("fees.deleteTitle", { name: deleting?.name ?? "" })}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("fees.deleteNote")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={handleDeleteStructure}>
                {t("fees.delete")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardHeader>
      <CardContent>
        {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
        {structures.length === 0 ? (
          <EmptyState message={t("fees.noStructures")} />
        ) : (
          <Table>
<TableHeader><TableRow><TableHead>{t("fees.colLevel")}</TableHead><TableHead>{t("fees.colGrade")}</TableHead><TableHead>{t("fees.colRegistration")}</TableHead><TableHead>{t("fees.colTotal")}</TableHead><TableHead>{t("fees.colFrequency")}</TableHead><TableHead>{t("fees.colInstallments")}</TableHead><TableHead>{t("fees.colStatus")}</TableHead><TableHead className="text-right">{t("fees.colActions")}</TableHead></TableRow></TableHeader>
            <TableBody>
              {structures.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{(s.educationLevel && LEVEL_KEYS[s.educationLevel]) ? t(LEVEL_KEYS[s.educationLevel]) : t("fees.all")}</TableCell>
                  <TableCell>{(s.grade && GRADE_KEYS[s.grade]) ? t(GRADE_KEYS[s.grade]) : t("fees.all")}</TableCell>
                  <TableCell className="tabular-nums">{money(s.registrationFee ?? 0, s.currencyCode)}</TableCell>
                  <TableCell className="tabular-nums font-medium">{money((s.tuitionFee ?? 0) + (s.registrationFee ?? 0), s.currencyCode)}</TableCell>
                  <TableCell><Badge variant="outline">{s.frequency === "per_term" ? t("fees.freqPerTerm") : t("fees.freqAnnual")}</Badge></TableCell>
                  <TableCell><InstallmentCell count={s.installmentCount} dates={s.installmentDueDates} amounts={s.installments?.map((i) => i.amount)} /></TableCell>
                  <TableCell><Badge variant={s.active ? "default" : "secondary"}>{s.active ? t("fees.active") : t("fees.archived")}</Badge></TableCell>
                  <TableCell className="text-right">
                    <FeeStructureActionsMenu
                      structure={s}
                      onEdit={() => openEdit(s)}
                      onArchive={() => handleArchive(s)}
                      onReactivate={() => handleReactivate(s)}
                      onDelete={() => setDeleting(s)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function InstallmentCell({ count, dates, amounts }: { count?: number; dates?: string[]; amounts?: number[] }) {
  const { t } = useI18n();
  const n = count ?? amounts?.length ?? 1;
  if (n <= 1) return <span className="text-muted-foreground text-xs">{t("fees.singlePayment")}</span>;
  return (
    <div className="space-y-0.5">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="text-xs text-muted-foreground">
          {i + 1}. {amounts?.[i] !== undefined ? new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amounts[i]) : ""}
          {dates?.[i] ? ` - ${formatDate(dates[i])}` : ""}
        </div>
      ))}
    </div>
  );
}

function CategoriesSkeleton() {
  return <div className="space-y-3">{[1,2,3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
}

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useI18n();
  return (
    <div className="text-center py-12 space-y-3">
      <p className="text-destructive text-sm">{message}</p>
      {onRetry && <Button variant="outline" size="sm" onClick={onRetry}>{t("common.retry")}</Button>}
    </div>
  );
}

function EmptyState({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div className="text-center py-12 space-y-3">
      <p className="text-sm text-muted-foreground">{message}</p>
      {action}
    </div>
  );
}


