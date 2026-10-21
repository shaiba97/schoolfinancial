"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCurrency } from "@/components/portal/currency-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from "@/components/ui/command";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem,
} from "@/components/ui/select";
import { financialApiFetch, ApiError } from "@/lib/api/client";
import type { StudentSchedule, RecordPaymentInput, DiscountEligibility } from "@/lib/api/types";
import { Plus, ChevronsUpDown } from "lucide-react";

export type StudentCandidate = {
  id: string;
  name: string;
  displayLabel: string;
  educationLevel?: string;
  grade?: number;
};

export const LEVEL_LABELS: Record<string, string> = { SECONDARY: "Secondary", INTERMEDIATE: "Intermediate" };
export const GRADE_INT_LABELS: Record<number, string> = { 1: "First", 2: "Second", 3: "Third", 6: "Sixth", 7: "Seventh", 8: "Eighth", 9: "Ninth" };
const METHODS = ["cash", "bankak", "fawry", "okash", "al_mashriq"] as const;
const METHOD_LABELS: Record<string, string> = {
  cash: "Cash", bankak: "Bankak", fawry: "Fawry", okash: "Okash", al_mashriq: "Al Mashriq",
};

type PayTarget = {
  key: string;
  kind: "installment" | "registration" | "lump_sum";
  installmentNo: number | null;
  outstanding: number;
  discounted: number;
};

export interface PresetStudent {
  id: string;
  name: string;
  label: string;
  /** e.g. "installment:2" — pre-selects the target once the schedule loads. */
  targetKey?: string;
}

interface RecordPaymentDialogProps {
  onCreated: () => Promise<void>;
  /** When set, the student picker is locked to this student. */
  presetStudent?: PresetStudent | null;
  triggerLabel?: string;
  /** Controlled mode: parent owns visibility, trigger button hidden. */
  open?: boolean;
  onClose?: () => void;
}

export function RecordPaymentDialog({ onCreated, presetStudent, triggerLabel, open, onClose }: RecordPaymentDialogProps) {
  const { money } = useCurrency();
  const [innerOpen, setInnerOpen] = useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? (open as boolean) : innerOpen;
  function setOpen(v: boolean) {
    if (!v && onClose) onClose();
    if (!isControlled) setInnerOpen(v);
  }
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<StudentCandidate[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [pickedLabel, setPickedLabel] = useState("");
  const [schedule, setSchedule] = useState<StudentSchedule | null>(null);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [targetKey, setTargetKey] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<string>("cash");
  const [transactionId, setTransactionId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [eligible, setEligible] = useState<DiscountEligibility[]>([]);
  const [discountIds, setDiscountIds] = useState<string[]>([]);
  const [loadingDiscounts, setLoadingDiscounts] = useState(false);
  const [presetApplied, setPresetApplied] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = () => {
    setQuery(""); setCandidates([]); setPickerOpen(false);
    setStudentId(""); setStudentName(""); setPickedLabel("");
    setSchedule(null); setLoadingSchedule(false);
    setEligible([]); setDiscountIds([]); setLoadingDiscounts(false);
    setTargetKey(""); setAmount("");
    setMethod("cash"); setTransactionId(""); setError("");
    setPresetApplied(false);
  };

  function clearStudent() {
    if (presetStudent) return;
    setStudentId(""); setStudentName(""); setPickedLabel("");
    setSchedule(null); setLoadingSchedule(false);
    setEligible([]); setDiscountIds([]); setLoadingDiscounts(false);
    setTargetKey(""); setAmount("");
    setQuery(""); setCandidates([]);
  }

  const search = useCallback((q: string) => {
    if (debounce.current) clearTimeout(debounce.current);
    if (!q.trim()) { setCandidates([]); return; }
    debounce.current = setTimeout(async () => {
      try {
        const res = await financialApiFetch<{ data: StudentCandidate[] }>(
          `/fees/students?q=${encodeURIComponent(q)}&pageSize=20`,
        );
        setCandidates(res.data ?? []);
      } catch { /* ignore */ }
    }, 250);
  }, []);

  const loadForStudent = useCallback(async (id: string, name: string, label: string) => {
    // UUID-bound selection — the transaction links by id, never by name.
    setStudentId(id); setStudentName(name); setPickedLabel(label);
    setCandidates([]); setPickerOpen(false);
    setQuery("");
    setTargetKey(""); setAmount("");
    setEligible([]); setDiscountIds([]);
    setLoadingSchedule(true);
    try {
      const sched = await financialApiFetch<StudentSchedule>(`/fees/students/${id}/schedule`);
      setSchedule(sched);
      // Default target: the current installment if still open, else the
      // registration fee (when it is the target), else the first open
      // installment, else the lump-sum balance. Amount pre-fills from the
      // target's outstanding and stays editable.
      const list = Array.isArray(sched.installments) ? sched.installments : [];
      const open = list
        .map((i) => ({ no: i.no, rem: Math.max(0, i.amount - i.paid) }))
        .filter((i) => i.rem > 0);
      const regRem = Math.max(0, sched.registrationFee - sched.registrationPaid);
      let key = "";
      let outstanding = 0;
      const current = open.find((i) => i.no === sched.currentTarget?.no);
      if (sched.assigned && current) {
        key = `installment:${current.no}`;
        outstanding = current.rem;
      } else if (sched.assigned && !sched.currentTarget && regRem > 0) {
        key = "registration";
        outstanding = regRem;
      } else if (sched.assigned && open.length > 0) {
        key = `installment:${open[0].no}`;
        outstanding = open[0].rem;
      } else if (sched.assigned && sched.balance > 0) {
        key = "lump_sum";
        outstanding = sched.balance;
      }
      setTargetKey(key);
      setAmount(outstanding > 0 ? outstanding.toFixed(2) : "");
      setError("");
    } catch (e) {
      setError(e instanceof ApiError
        ? e.message
        : "Could not load this student's schedule — you can still record a lump-sum amount below.");
      setSchedule(null);
    } finally {
      setLoadingSchedule(false);
    }
    // Eligible discounts load independently: a failure here must never block
    // recording the payment itself (the server re-validates everything).
    setLoadingDiscounts(true);
    try {
      const rows = await financialApiFetch<DiscountEligibility[]>(
        `/finance/students/${id}/eligible-discounts`,
      );
      const list = Array.isArray(rows) ? rows : [];
      setEligible(list);
      setDiscountIds(list.filter((r) => r.preChecked).map((r) => r.id));
    } catch {
      setEligible([]); setDiscountIds([]);
    } finally {
      setLoadingDiscounts(false);
    }
  }, []);

  async function pickStudent(c: StudentCandidate) {
    await loadForStudent(c.id, c.name, c.displayLabel);
  }

  // Preset mode: lock to the given student as soon as the dialog opens.
  useEffect(() => {
    if (isOpen && presetStudent && !presetApplied) {
      setPresetApplied(true);
      void loadForStudent(presetStudent.id, presetStudent.name, presetStudent.label);
    }
  }, [isOpen, presetStudent, presetApplied, loadForStudent]);

  // Preset target: pre-select once the schedule (and its targets) loads.
  useEffect(() => {
    if (isOpen && presetStudent?.targetKey && schedule && !targetKey) {
      setTargetKey(presetStudent.targetKey);
    }
  }, [isOpen, presetStudent, schedule, targetKey]);

  // Client-side estimate only — the server computes the binding reduction
  // (percentage base = annual fee total, capped at the outstanding).
  function estimatedReduction(e: DiscountEligibility): number {
    const base = e.valueType === "PERCENTAGE"
      ? ((schedule?.totalFee ?? 0) * e.value) / 100
      : e.value;
    return Math.max(0, base - (e.appliedAmount ?? 0));
  }

  const selectedDiscounts = eligible.filter((e) => discountIds.includes(e.id));
  const estimatedTotal = selectedDiscounts.reduce((s, e) => s + estimatedReduction(e), 0);

  // One target per transaction: the installment the school determined
  // (1..n), the registration fee, or the lump-sum balance — each only when
  // it still has something outstanding.
  const targets: (PayTarget & { label: string })[] = (() => {
    if (!schedule?.assigned) return [];
    const list = Array.isArray(schedule.installments) ? schedule.installments : [];
    const out: (PayTarget & { label: string })[] = [];
    for (const i of list) {
      const discounted = Math.max(0, i.discounted ?? 0);
      const rem = Math.max(0, i.amount - i.paid - discounted);
      if (rem <= 0) continue; // fully settled — not payable, not shown
      out.push({
        key: `installment:${i.no}`,
        kind: "installment",
        installmentNo: i.no,
        outstanding: rem,
        discounted,
        label: `Installment #${i.no} — ${money(i.amount)} (paid ${money(i.paid)}${discounted > 0 ? `, discount −${money(discounted)}` : ""})`,
      });
    }
    const regRem = Math.max(0, schedule.registrationFee - schedule.registrationPaid);
    if (regRem > 0) {
      out.push({
        key: "registration",
        kind: "registration",
        installmentNo: null,
        outstanding: regRem,
        discounted: 0,
        label: `Registration Fee — ${money(schedule.registrationFee)} (paid ${money(schedule.registrationPaid)})`,
      });
    }
    if (schedule.balance > 0) {
      out.push({
        key: "lump_sum",
        kind: "lump_sum",
        installmentNo: null,
        outstanding: schedule.balance,
        discounted: 0,
        label: `Lump-Sum (Full Year) — balance ${money(schedule.balance)}`,
      });
    }
    return out;
  })();

  const selectedTarget = targets.find((t) => t.key === targetKey) ?? null;

  // Keep a preset target's amount in sync once targets resolve.
  useEffect(() => {
    if (isOpen && presetStudent?.targetKey && selectedTarget && !amount) {
      setAmount(selectedTarget.outstanding > 0 ? selectedTarget.outstanding.toFixed(2) : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedTarget]);

  function selectTarget(key: string) {
    setTargetKey(key);
    const t = targets.find((x) => x.key === key);
    setAmount(t && t.outstanding > 0 ? t.outstanding.toFixed(2) : "");
    setError("");
  }

  function toggleDiscount(id: string) {
    setDiscountIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setError("");
  }

  // Clamp to the target's outstanding on blur — the server rejects over-allocation.
  function clampAmount() {
    const n = parseFloat(amount);
    if (!Number.isFinite(n)) { setAmount(""); return; }
    const cap = selectedTarget ? selectedTarget.outstanding : n;
    setAmount(Math.min(Math.max(0, n), cap).toFixed(2));
  }

  const needsRef = method !== "cash";
  const unassigned = !!schedule && !schedule.assigned;
  // No schedule (fetch failed) behaves like unassigned: a lump-sum amount
  // can always be entered so the cashier is never stuck.
  const fallbackMode = !!studentId && (!schedule || unassigned);
  const canSave =
    !!studentId &&
    (!needsRef || !!transactionId.trim()) &&
    (fallbackMode
      ? parseFloat(amount) > 0
      : !!selectedTarget && parseFloat(amount) > 0);
  const canPayAll =
    !!studentId && !!schedule?.assigned && schedule.balance > 0 &&
    (!needsRef || !!transactionId.trim()) && !saving;

  async function postPayment(allocations: RecordPaymentInput["allocations"]) {
    await financialApiFetch("/finance/payments", {
      method: "POST",
      body: JSON.stringify({
        studentId,
        allocations,
        method: method as RecordPaymentInput["method"],
        transactionId: needsRef ? transactionId.trim() : undefined,
        discountIds: discountIds.length > 0 ? discountIds : undefined,
      } satisfies RecordPaymentInput),
    });
  }

  async function handleSave() {
    if (fallbackMode) {
      const n = parseFloat(amount);
      if (!(n > 0)) { setError("Enter an amount."); return; }
      setSaving(true); setError("");
      try {
        await postPayment([{ installmentNo: null, kind: "lump_sum", amount: n }]);
        setOpen(false); reset();
        await onCreated();
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Could not record the payment — try again.");
      } finally { setSaving(false); }
      return;
    }
    if (!selectedTarget) { setError("Select an installment to pay towards."); return; }
    const n = parseFloat(amount);
    if (!(n > 0)) { setError(`Enter an amount for ${selectedTarget.label}.`); return; }
    if (n > selectedTarget.outstanding + 0.005) {
      setError(`${selectedTarget.label}: ${money(n)} exceeds the outstanding ${money(selectedTarget.outstanding)}.`);
      return;
    }
    setSaving(true); setError("");
    try {
      await postPayment([{
        installmentNo: selectedTarget.installmentNo,
        kind: selectedTarget.kind,
        amount: n,
      }]);
      setOpen(false); reset();
      await onCreated();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not record the payment — try again.");
    } finally { setSaving(false); }
  }

  async function handlePayAll() {
    setSaving(true); setError("");
    try {
      await financialApiFetch("/finance/payments/pay-all", {
        method: "POST",
        body: JSON.stringify({
          studentId,
          method: method as RecordPaymentInput["method"],
          transactionId: needsRef ? transactionId.trim() : undefined,
          discountIds: discountIds.length > 0 ? discountIds : undefined,
        }),
      });
      setOpen(false); reset();
      await onCreated();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not settle the balance — try again.");
    } finally { setSaving(false); }
  }

  return (
    <>
      {!isControlled && (
        <Button size="sm" onClick={() => { reset(); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" />{triggerLabel ?? "Record Payment"}
        </Button>
      )}
      <Dialog open={isOpen} onOpenChange={(o) => { if (!o) { setOpen(false); reset(); } else setOpen(o); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="pay-student">Student</Label>
              {studentId ? (
                <div className="flex items-center gap-2 rounded-md border p-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{pickedLabel || studentName}</div>
                    <div className="text-xs text-muted-foreground tabular-nums">
                      Linked · {studentId.slice(0, 8)}…
                    </div>
                  </div>
                  {!presetStudent && (
                    <Button type="button" size="sm" variant="ghost" onClick={clearStudent}>
                      Change
                    </Button>
                  )}
                </div>
              ) : (
                <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                  <PopoverTrigger
                    render={
                      <Button
                        id="pay-student"
                        type="button"
                        variant="outline"
                        className="w-full justify-between font-normal"
                      />
                    }
                  >
                    <span className="truncate text-muted-foreground">Type student name or paste ID…</span>
                    <ChevronsUpDown />
                  </PopoverTrigger>
                  <PopoverContent className="w-[--anchor-width] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Type student name or paste ID…"
                        value={query}
                        onValueChange={(v) => { setQuery(v); search(v); }}
                      />
                      <CommandList>
                        <CommandEmpty>
                          {query.trim()
                            ? `No students found for “${query.trim()}”.`
                            : "Type to search students."}
                        </CommandEmpty>
                        <CommandGroup>
                          {candidates.map((c) => (
                            <CommandItem
                              key={c.id}
                              value={c.id}
                              onSelect={() => pickStudent(c)}
                            >
                              <span className="min-w-0 flex-1 truncate">
                                {c.displayLabel}
                                <span className="ml-2 text-xs text-muted-foreground tabular-nums">
                                  {c.id.slice(0, 8)}
                                </span>
                              </span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}
              {!pickerOpen && !studentId && query.trim() && (
                <p className="text-xs text-destructive" role="alert">
                  No student selected — pick a result from the list so the payment links to the right record.
                </p>
              )}
            </div>

            {schedule && (
              <div className="flex flex-col gap-1 rounded-md border p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Fee</span>
                  <span className="font-medium tabular-nums">{money(schedule.totalFee)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Paid</span>
                  <span className="tabular-nums">{money(schedule.totalPaid)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Balance</span>
                  <span className="font-medium tabular-nums text-destructive">{money(schedule.balance)}</span>
                </div>
                {schedule.currentTarget && (
                  <>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Current Target</span>
                      <span>Installment #{schedule.currentTarget.no}</span>
                    </div>
                  </>
                )}
                {!schedule.assigned && (
                  <p className="text-xs text-destructive pt-1">No fee structure assigned. Payment will auto-assign by level/grade.</p>
                )}
              </div>
            )}

            {loadingSchedule && (
              <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading schedule">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            )}

            {!loadingSchedule && schedule?.proposed && (
              <p className="text-xs text-muted-foreground">
                Fee structure for {LEVEL_LABELS[schedule.educationLevel ?? ""] ?? schedule.educationLevel}
                {schedule.grade != null ? ` · Grade ${GRADE_INT_LABELS[schedule.grade] ?? schedule.grade}` : ""}
                {" "}will be assigned automatically on save.
              </p>
            )}

            {!loadingSchedule && schedule?.assigned && targets.length > 0 && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="pay-installment">Installment</Label>
                <Select value={targetKey} onValueChange={(v) => { if (v) selectTarget(v); }}>
                  <SelectTrigger id="pay-installment" className="w-full">
                    <SelectValue placeholder="Select an installment…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {targets.map((t) => (
                        <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Label htmlFor="pay-amount">Amount</Label>
                <Input
                  id="pay-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={selectedTarget?.outstanding}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onBlur={clampAmount}
                  aria-label={selectedTarget ? `Amount for ${selectedTarget.label}, max ${selectedTarget.outstanding}` : "Amount"}
                />
                {selectedTarget && (
                  <p className="text-xs text-muted-foreground tabular-nums">
                    Outstanding {money(selectedTarget.outstanding)}
                    {schedule.currentTarget?.no === selectedTarget.installmentNo && <span> • current target</span>}
                  </p>
                )}
                {selectedTarget && selectedTarget.discounted > 0 && (
                  <p className="text-xs text-purple-600 tabular-nums">
                    Already applied to this target: −{money(selectedTarget.discounted)} (consumed discount — see Discounts below for new applications)
                  </p>
                )}
                {schedule.balance > 0 && (
                  <Button type="button" size="sm" variant="outline" className="w-full" onClick={handlePayAll} disabled={!canPayAll}>
                    {saving ? "Settling…" : `Pay All Outstanding — ${money(schedule.balance)}`}
                  </Button>
                )}
              </div>
            )}

            {!loadingSchedule && schedule?.assigned && targets.length === 0 && (
              <p className="text-sm text-green-700">Nothing outstanding — this student is paid in full.</p>
            )}

            {!loadingSchedule && schedule?.assigned && (loadingDiscounts || eligible.length > 0) && (
              <div className="flex flex-col gap-2 rounded-md border p-3">
                <Label>Discounts</Label>
                {loadingDiscounts ? (
                  <Skeleton className="h-9 w-full" />
                ) : (
                  <>
                    {eligible.map((e) => (
                      <label key={e.id} className="flex items-start gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={discountIds.includes(e.id)}
                          onCheckedChange={() => toggleDiscount(e.id)}
                          aria-label={`Apply ${e.label}`}
                        />
                        <span className="flex-1">
                          <span className="font-medium">{e.label}</span>
                          <span className="text-muted-foreground"> — est. {e.valueType === "PERCENTAGE" ? `${e.value}%` : money(e.value)}</span>
                          {e.sourceType === "FAMILY_CONDITION" && (
                            <span className="text-muted-foreground"> • manual</span>
                          )}
                        </span>
                        <span className="tabular-nums text-muted-foreground">−{money(estimatedReduction(e))}</span>
                      </label>
                    ))}
                    {selectedDiscounts.length > 0 && (
                      <p className="text-xs text-muted-foreground tabular-nums">
                        Estimated reduction {money(estimatedTotal)} — the server applies the binding amount at save.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {!loadingSchedule && fallbackMode && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="pay-amount-plain">Amount</Label>
                <Input
                  id="pay-amount-plain"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">No fee structure assigned yet — this records a lump-sum and auto-assigns one.</p>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="pay-method">Method</Label>
              <Select value={method} onValueChange={(v) => { if (v) setMethod(v); }}>
                <SelectTrigger id="pay-method" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {METHODS.map((m) => (
                      <SelectItem key={m} value={m}>{METHOD_LABELS[m]}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {needsRef && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="pay-ref">Transaction ID</Label>
                <Input id="pay-ref" value={transactionId} onChange={(e) => setTransactionId(e.target.value)} placeholder="Bank / provider reference" />
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button onClick={handleSave} disabled={saving || !canSave}>
              {saving ? "Recording..." : "Record Payment"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
