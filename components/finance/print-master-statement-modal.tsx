"use client";

import * as React from "react";
import { useCurrency } from "@/components/portal/currency-provider";
import { useI18n } from "@/lib/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { StudentLedger } from "@/lib/api/types";

interface PrintMasterStatementModalProps {
  ledger: StudentLedger | null;
  open: boolean;
  onClose: () => void;
}

export function PrintMasterStatementModal({ ledger, open, onClose }: PrintMasterStatementModalProps) {
  const { money } = useCurrency();
  const { t, locale } = useI18n();
  const totalStatus = (s: string) =>
    s === "FULLY_PAID" ? t("ledger.statusFULLY_PAID") : s === "OVERDUE" ? t("ledger.statusOVERDUE") : t("ledger.statusPARTIALLY_PAID");
  const instStatus = (s: string) =>
    s === "PAID" ? t("ledger.statusFULLY_PAID") : s === "OVERDUE" ? t("ledger.statusOVERDUE") : s === "PARTIAL" ? t("ledger.statusPARTIALLY_PAID") : t("ledger.schedulePending");
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{t("pMaster.title")}</DialogTitle></DialogHeader>
        {ledger && (
          <div className="space-y-4">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">{t("pMaster.student")}</span><span className="font-medium">{ledger.profile.name} · {ledger.profile.roleNumber}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t("pMaster.grade")}</span><span>{ledger.profile.grade != null ? t("ledger.gradeRow", { no: ledger.profile.grade }) : "—"}</span></div>
              {ledger.profile.guardians.map((g, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-muted-foreground">{g.relationship ? t("pMaster.guardianRel", { relationship: g.relationship }) : t("pMaster.guardian")}</span>
                  <span>{g.name}{g.phone ? ` · ${g.phone}` : ""}</span>
                </div>
              ))}
            </div>

            {/* Print-only full statement. */}
            <div className="hidden print:block text-sm">
              <h2 className="text-lg font-bold">{t("pMaster.printTitle", { name: ledger.profile.name })}</h2>
              <p>{ledger.profile.roleNumber} · {ledger.fee.templateName}</p>
              <h3 className="mt-3 font-semibold">{t("pMaster.feeSection")}</h3>
              <table className="w-full">
                <tbody>
                  {ledger.fee.rows.map((r) => (
                    <tr key={r.label}><td>{r.label}</td><td>{money(r.amount)}</td><td>-{money(r.discount)}</td><td>{money(r.net)}</td></tr>
                  ))}
                </tbody>
              </table>
              <h3 className="mt-3 font-semibold">{t("pMaster.installmentsSection")}</h3>
              <table className="w-full">
                <thead><tr><th className="text-left">{t("pMaster.colName")}</th><th className="text-left">{t("pMaster.colDue")}</th><th className="text-right">{t("pMaster.colAmount")}</th><th className="text-right">{t("pMaster.colPaid")}</th><th className="text-left">{t("pMaster.colStatus")}</th></tr></thead>
                <tbody>
                  {ledger.installments.map((ins) => (
                    <tr key={ins.no}><td>{ins.name}</td><td>{ins.dueDate ? formatDate(ins.dueDate, locale) : "—"}</td><td className="text-right">{money(ins.amount)}</td><td className="text-right">{money(ins.paid)}</td><td>{instStatus(ins.status)}</td></tr>
                  ))}
                </tbody>
              </table>
              <h3 className="mt-3 font-semibold">{t("pMaster.paymentsSection")}</h3>
              <table className="w-full">
                <thead><tr><th className="text-left">{t("pMaster.colReceipt")}</th><th className="text-left">{t("pMaster.colDate")}</th><th className="text-left">{t("pMaster.colTarget")}</th><th className="text-right">{t("pMaster.colAmount")}</th></tr></thead>
                <tbody>
                  {ledger.payments.map((p) => (
                    <tr key={p.id}><td>{p.ref || p.id.slice(0, 8)}</td><td>{p.at ? formatDateTime(p.at, locale) : "—"}</td><td>{p.target}</td><td className="text-right">{money(p.amount, p.currencyCode)}</td></tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 border-t pt-2">
                <p>{t("pMaster.assignedPaid", { assigned: money(ledger.totals.assigned, ledger.totals.currency), paid: money(ledger.totals.paid, ledger.totals.currency) })}</p>
                <p><strong>{t("pMaster.balance", { balance: money(ledger.totals.balance, ledger.totals.currency), status: totalStatus(ledger.totals.status) })}</strong></p>
              </div>
            </div>

            <div className="flex justify-end gap-2 print:hidden">
              <Button variant="outline" onClick={onClose}>{t("common.close")}</Button>
              <Button onClick={() => window.print()}>{t("pMaster.printStatement")}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
