"use client";

import * as React from "react";
import { useCurrency } from "@/components/portal/currency-provider";
import { useI18n } from "@/lib/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/utils";
import type { LedgerPayment, StudentLedger } from "@/lib/api/types";

interface PrintSingleReceiptModalProps {
  payment: LedgerPayment | null;
  ledger: StudentLedger | null;
  onClose: () => void;
}

const METHOD_KEYS: Record<string, "ledger.methodCash" | "ledger.methodBankak" | "ledger.methodFawry" | "ledger.methodOkash" | "ledger.methodAlMashriq"> = {
  cash: "ledger.methodCash",
  bankak: "ledger.methodBankak",
  fawry: "ledger.methodFawry",
  okash: "ledger.methodOkash",
  al_mashriq: "ledger.methodAlMashriq",
  CASH: "ledger.methodCash",
  BANKAK: "ledger.methodBankak",
  FAWRY: "ledger.methodFawry",
  OKASH: "ledger.methodOkash",
  AL_MASHRIQ: "ledger.methodAlMashriq",
};

export function PrintSingleReceiptModal({ payment, ledger, onClose }: PrintSingleReceiptModalProps) {
  const { money } = useCurrency();
  const { t, locale } = useI18n();
  const receiptNo = payment ? (payment.ref || payment.id.slice(0, 8)) : "";
  const methodLabel = payment ? (METHOD_KEYS[payment.method] ? t(METHOD_KEYS[payment.method]) : payment.method) : "";
  return (
    <Dialog open={!!payment} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{t("rcpt.title")}</DialogTitle></DialogHeader>
        {payment && ledger && (
          <div className="space-y-4">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">{t("rcpt.receiptNo")}</span><span className="font-medium">{receiptNo}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t("rcpt.date")}</span><span>{payment.at ? formatDateTime(payment.at, locale) : "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t("rcpt.student")}</span><span className="font-medium">{ledger.profile.name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t("rcpt.grade")}</span><span>{ledger.profile.grade != null ? t("ledger.gradeRow", { no: ledger.profile.grade }) : "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t("rcpt.target")}</span><span>{payment.target}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t("rcpt.method")}</span><span>{methodLabel}{payment.ref ? ` · ${payment.ref}` : ""}</span></div>
              <div className="flex justify-between border-t pt-2 text-base">
                <span className="font-semibold">{t("rcpt.amountPaid")}</span>
                <span className="font-bold">{money(payment.amount, payment.currencyCode)}</span>
              </div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t("rcpt.accountBalance")}</span><span>{money(ledger.totals.balance, ledger.totals.currency)}</span></div>
            </div>

            {/* Print-only voucher with signature line. */}
            <div className="hidden print:block" dir="ltr">
              <h2 className="text-lg font-bold">{t("rcpt.printTitle", { no: receiptNo })}</h2>
              <p className="text-sm">{ledger.profile.name} · {payment.at ? formatDateTime(payment.at, locale) : "—"}</p>
              <p className="text-sm">{t("rcpt.printTarget", { target: payment.target, method: methodLabel })}</p>
              <p className="mt-2 text-base font-bold">{t("rcpt.paid", { amount: money(payment.amount, payment.currencyCode) })}</p>
              <p className="text-sm">{t("rcpt.balance", { amount: money(ledger.totals.balance, ledger.totals.currency) })}</p>
              <div className="mt-10 flex justify-between text-sm">
                <span>{t("rcpt.cashierSignature")}</span>
                <span>{t("rcpt.dateLine")}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 print:hidden">
              <Button variant="outline" onClick={onClose}>{t("common.close")}</Button>
              <Button onClick={() => window.print()}>{t("rcpt.printReceipt")}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
