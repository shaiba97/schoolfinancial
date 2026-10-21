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
import { Plus, Pencil, Trash2, Archive, MoreHorizontal } from "lucide-react";

export default function FeesPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Fee Management</h1>
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
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={buttonVariants({ variant: "ghost", size: "icon" })}
        aria-label="Actions"
      >
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={onEdit} disabled={!structure.active}>
          <Pencil className="h-4 w-4 mr-2" />Edit
        </DropdownMenuItem>
        {structure.active ? (
          <DropdownMenuItem onClick={onArchive}>
            <Archive className="h-4 w-4 mr-2" />Archive
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={onReactivate}>
            <Plus className="h-4 w-4 mr-2 rotate-45" />Reactivate
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 className="h-4 w-4 mr-2" />Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FeeStructuresTab() {
  const { money } = useCurrency();
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

  const LEVEL_LABELS: Record<string, string> = { SECONDARY: "Secondary", INTERMEDIATE: "Intermediate" };
  const GRADE_LABELS: Record<string, string> = { FIRST: "First", SECOND: "Second", THIRD: "Third", SIXTH: "Sixth", SEVENTH: "Seventh", EIGHTH: "Eighth", NINTH: "Ninth" };

  function autoName() {
    const parts = [
      LEVEL_LABELS[educationLevel] ?? educationLevel,
      GRADE_LABELS[grade] ?? grade,
      frequency === "per_term" ? "Per Term" : "Annual",
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
        <CardTitle>Fee Structures</CardTitle>
<Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />Add Structure
        </Button>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
<DialogHeader>
              <DialogTitle>{editing ? "Edit Fee Structure" : "New Fee Structure"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="struct-tuition">Tuition Fee</Label>
                  <Input id="struct-tuition" type="number" min="0.01" step="0.01" value={tuitionFee} onChange={(e) => setTuitionFee(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="struct-registration">Registration Fee (optional)</Label>
                  <Input id="struct-registration" type="number" min="0" step="0.01" value={registrationFee} onChange={(e) => setRegistrationFee(e.target.value)} />
                </div>
              </div>
              {parseFloat(registrationFee) > 0 && (
                <p className="text-xs text-muted-foreground">
                  Billed as a separate registration invoice, not folded into installments.
                </p>
              )}
              <div className="space-y-2">
                <Label htmlFor="struct-freq">Frequency</Label>
                <select id="struct-freq" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                  <option value="annual">Annual</option>
                  <option value="per_term">Per Term</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="struct-count">Installments</Label>
                <select id="struct-count" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={installmentCount} onChange={(e) => changeCount(Number(e.target.value))}>
                  <option value={1}>1 (single payment)</option>
                  <option value={2}>2 installments</option>
                  <option value={3}>3 installments</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Due dates</Label>
                {dueDates.map((d, i) => (
                  <div key={i} className="space-y-1">
                    <Label htmlFor={`due-${i}`} className="text-xs text-muted-foreground">Installment {i + 1}</Label>
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
                    Every installment needs a due date, and dates must be in ascending order.
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="struct-level">Education Level</Label>
                  <select id="struct-level" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={educationLevel} onChange={(e) => setEducationLevel(e.target.value)}>
                    <option value="">All levels</option>
                    <option value="SECONDARY">Secondary</option>
                    <option value="INTERMEDIATE">Intermediate</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="struct-grade">Grade</Label>
                  <select id="struct-grade" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={grade} onChange={(e) => setGrade(e.target.value)}>
                    <option value="">All grades</option>
                    <option value="FIRST">First</option>
                    <option value="SECOND">Second</option>
                    <option value="THIRD">Third</option>
                    <option value="SIXTH">Sixth</option>
                    <option value="SEVENTH">Seventh</option>
                    <option value="EIGHTH">Eighth</option>
                    <option value="NINTH">Ninth</option>
                  </select>
                </div>
              </div>
<Button onClick={handleSave} disabled={saving || !canSave}>
                {saving ? "Saving..." : editing ? "Save Changes" : "Save"}
              </Button>
</div>
          </DialogContent>
        </Dialog>
        <AlertDialog open={!!deleting} onOpenChange={(open) => { if (!open) setDeleting(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete &ldquo;{deleting?.name}&rdquo;</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. The structure can only be deleted if no student is assigned and no invoice references it.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={handleDeleteStructure}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardHeader>
      <CardContent>
        {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
        {structures.length === 0 ? (
          <EmptyState message="No fee structures yet" />
        ) : (
          <Table>
<TableHeader><TableRow><TableHead>Education Level</TableHead><TableHead>Grade</TableHead><TableHead>Registration Fees</TableHead><TableHead>Total Fees</TableHead><TableHead>Frequency</TableHead><TableHead>Installments</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {structures.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{LEVEL_LABELS[s.educationLevel || ""] || "All"}</TableCell>
                  <TableCell>{GRADE_LABELS[s.grade || ""] || "All"}</TableCell>
                  <TableCell className="tabular-nums">{money(s.registrationFee ?? 0, s.currencyCode)}</TableCell>
                  <TableCell className="tabular-nums font-medium">{money((s.tuitionFee ?? 0) + (s.registrationFee ?? 0), s.currencyCode)}</TableCell>
                  <TableCell><Badge variant="outline">{s.frequency === "per_term" ? "Per Term" : "Annual"}</Badge></TableCell>
                  <TableCell><InstallmentCell count={s.installmentCount} dates={s.installmentDueDates} amounts={s.installments?.map((i) => i.amount)} /></TableCell>
                  <TableCell><Badge variant={s.active ? "default" : "secondary"}>{s.active ? "Active" : "Archived"}</Badge></TableCell>
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
  const n = count ?? amounts?.length ?? 1;
  if (n <= 1) return <span className="text-muted-foreground text-xs">Single payment</span>;
  return (
    <div className="space-y-0.5">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="text-xs text-muted-foreground">
          {i + 1}. {amounts?.[i] !== undefined ? new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amounts[i]) : ""}
          {dates?.[i] ? ` - ${new Date(dates[i]).toLocaleDateString()}` : ""}
        </div>
      ))}
    </div>
  );
}

function CategoriesSkeleton() {
  return <div className="space-y-3">{[1,2,3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
}

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="text-center py-12 space-y-3">
      <p className="text-destructive text-sm">{message}</p>
      {onRetry && <Button variant="outline" size="sm" onClick={onRetry}>Retry</Button>}
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


