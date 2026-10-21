"use client";

import * as React from "react";
import { useCurrency } from "@/components/portal/currency-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { financialApiFetch, ApiError } from "@/lib/api/client";
import type { PayrollRegisterRow, SalaryPayMethod } from "@/lib/api/types";

const METHODS: SalaryPayMethod[] = ["CASH", "BANKAK", "FAWRY", "BANK_TRANSFER"];

interface ConfirmSalaryModalProps {
  row: PayrollRegisterRow | null;
  onClose: () => void;
  onPaid: () => void;
}

export function ConfirmSalaryModal({ row, onClose, onPaid }: ConfirmSalaryModalProps) {
  const { money } = useCurrency();
  const [method, setMethod] = React.useState<SalaryPayMethod>("CASH");
  const [reference, setReference] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (row) {
      setMethod("CASH"); setReference(""); setNotes("");
      setSaving(false); setError(null);
    }
  }, [row]);

  async function submit() {
    if (!row || saving) return;
    setSaving(true);
    setError(null);
    try {
      await financialApiFetch("/finance/payroll/pay", {
        method: "POST",
        body: JSON.stringify({
          userId: row.userId,
          method,
          ...(reference.trim() ? { reference: reference.trim() } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        }),
      });
      onPaid();
      onClose();
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Payment failed. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!row} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm Salary Payment</DialogTitle>
        </DialogHeader>
        {row && (
          <div className="space-y-4">
            <div className="rounded-md bg-muted p-3 text-sm">
              <p className="font-medium">{row.name}</p>
              <p className="text-muted-foreground">{row.positionTitle} · {row.cycleLabel}</p>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Base Salary</span>
                <span>{money(row.baseSalary, row.currencyCode)}</span>
              </div>
              <div className="flex justify-between text-destructive">
                <span>
                  Attendance Shortage Deductions
                  {row.absentDays > 0 && ` (${row.absentDays} day${row.absentDays === 1 ? "" : "s"} absent)`}
                  {row.lateDays > 0 && ` (${row.lateDays} late)`}
                </span>
                <span>-{money(row.deductionAmount, row.currencyCode)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 font-semibold">
                <span>Final Net Salary</span>
                <span>{money(row.netPay, row.currencyCode)}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={method} onValueChange={(v) => { if (v) setMethod(v as SalaryPayMethod); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="salary-ref">Reference ID / Voucher No (optional)</Label>
              <Input
                id="salary-ref"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Bank transfer reference"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="salary-notes">Notes / Remarks (optional)</Label>
              <Input
                id="salary-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. October salary minus 1 day absence"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
              <Button onClick={submit} disabled={saving}>
                {saving ? "Paying…" : `Pay ${money(row.netPay, row.currencyCode)}`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
