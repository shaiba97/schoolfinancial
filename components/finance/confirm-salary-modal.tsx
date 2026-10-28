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
import { useI18n } from "@/lib/i18n/locale-provider";
import type { MessageKey } from "@/lib/i18n/locale-provider";
import type { PayrollRegisterRow, SalaryPayMethod } from "@/lib/api/types";

const METHODS: SalaryPayMethod[] = ["CASH", "BANKAK", "FAWRY", "BANK_TRANSFER"];
const METHOD_KEYS: Record<string, MessageKey> = {
  CASH: "confirmSal.methodCASH",
  BANKAK: "confirmSal.methodBANKAK",
  FAWRY: "confirmSal.methodFAWRY",
  BANK_TRANSFER: "confirmSal.methodBANK_TRANSFER",
};

interface ConfirmSalaryModalProps {
  row: PayrollRegisterRow | null;
  onClose: () => void;
  onPaid: () => void;
}

export function ConfirmSalaryModal({ row, onClose, onPaid }: ConfirmSalaryModalProps) {
  const { money } = useCurrency();
  const { t } = useI18n();
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
      else setError(t("confirmSal.payError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!row} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("confirmSal.title")}</DialogTitle>
        </DialogHeader>
        {row && (
          <div className="space-y-4">
            <div className="rounded-md bg-muted p-3 text-sm">
              <p className="font-medium">{row.name}</p>
              <p className="text-muted-foreground">{row.positionTitle} · {row.cycleLabel}</p>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("confirmSal.baseSalary")}</span>
                <span>{money(row.baseSalary, row.currencyCode)}</span>
              </div>
              <div className="flex justify-between text-destructive">
                <span>
                  {t("confirmSal.shortage")}
                  {row.absentDays > 0 && t(row.absentDays === 1 ? "confirmSal.absentSuffix" : "confirmSal.absentSuffixMany", { n: String(row.absentDays) })}
                  {row.lateDays > 0 && t("confirmSal.lateSuffix", { n: String(row.lateDays) })}
                </span>
                <span>-{money(row.deductionAmount, row.currencyCode)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 font-semibold">
                <span>{t("confirmSal.netSalary")}</span>
                <span>{money(row.netPay, row.currencyCode)}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("confirmSal.method")}</Label>
              <Select value={method} onValueChange={(v) => { if (v) setMethod(v as SalaryPayMethod); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => <SelectItem key={m} value={m}>{t(METHOD_KEYS[m])}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="salary-ref">{t("confirmSal.refLabel")}</Label>
              <Input
                id="salary-ref"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder={t("confirmSal.refPlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="salary-notes">{t("confirmSal.notesLabel")}</Label>
              <Input
                id="salary-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("confirmSal.notesPlaceholder")}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose} disabled={saving}>{t("common.cancel")}</Button>
              <Button onClick={submit} disabled={saving}>
                {saving ? t("confirmSal.paying") : t("confirmSal.pay", { amount: money(row.netPay, row.currencyCode) })}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
