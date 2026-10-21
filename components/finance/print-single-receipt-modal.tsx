"use client";

import * as React from "react";
import { useCurrency } from "@/components/portal/currency-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { LedgerPayment, StudentLedger } from "@/lib/api/types";

interface PrintSingleReceiptModalProps {
  payment: LedgerPayment | null;
  ledger: StudentLedger | null;
  onClose: () => void;
}

function fmtAt(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("en-US", {
    month: "short", day: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC",
  });
}

export function PrintSingleReceiptModal({ payment, ledger, onClose }: PrintSingleReceiptModalProps) {
  const { money } = useCurrency();
  return (
    <Dialog open={!!payment} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Payment Receipt</DialogTitle></DialogHeader>
        {payment && ledger && (
          <div className="space-y-4">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Receipt No</span><span className="font-medium">{payment.ref || payment.id.slice(0, 8)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span>{fmtAt(payment.at)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Student</span><span className="font-medium">{ledger.profile.name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Grade</span><span>{ledger.profile.grade != null ? `Grade ${ledger.profile.grade}` : "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Target</span><span>{payment.target}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Method</span><span>{payment.method}{payment.ref ? ` · ${payment.ref}` : ""}</span></div>
              <div className="flex justify-between border-t pt-2 text-base">
                <span className="font-semibold">Amount Paid</span>
                <span className="font-bold">{money(payment.amount, payment.currencyCode)}</span>
              </div>
              <div className="flex justify-between"><span className="text-muted-foreground">Account Balance</span><span>{money(ledger.totals.balance, ledger.totals.currency)}</span></div>
            </div>

            {/* Print-only voucher with signature line. */}
            <div className="hidden print:block">
              <h2 className="text-lg font-bold">Official Receipt — {payment.ref || payment.id.slice(0, 8)}</h2>
              <p className="text-sm">{ledger.profile.name} · {fmtAt(payment.at)}</p>
              <p className="text-sm">Target: {payment.target} · Method: {payment.method}</p>
              <p className="mt-2 text-base font-bold">Paid: {money(payment.amount, payment.currencyCode)}</p>
              <p className="text-sm">Balance: {money(ledger.totals.balance, ledger.totals.currency)}</p>
              <div className="mt-10 flex justify-between text-sm">
                <span>Cashier signature: ________________</span>
                <span>Date: ________________</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 print:hidden">
              <Button variant="outline" onClick={onClose}>Close</Button>
              <Button onClick={() => window.print()}>Print Receipt</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
