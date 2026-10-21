"use client";

import * as React from "react";
import { useCurrency } from "@/components/portal/currency-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { StudentLedger } from "@/lib/api/types";

interface PrintMasterStatementModalProps {
  ledger: StudentLedger | null;
  open: boolean;
  onClose: () => void;
}

export function PrintMasterStatementModal({ ledger, open, onClose }: PrintMasterStatementModalProps) {
  const { money } = useCurrency();
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Full Account Statement</DialogTitle></DialogHeader>
        {ledger && (
          <div className="space-y-4">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Student</span><span className="font-medium">{ledger.profile.name} · {ledger.profile.roleNumber}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Grade</span><span>{ledger.profile.grade != null ? `Grade ${ledger.profile.grade}` : "—"}</span></div>
              {ledger.profile.guardians.map((g, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-muted-foreground">Guardian{g.relationship ? ` (${g.relationship})` : ""}</span>
                  <span>{g.name}{g.phone ? ` · ${g.phone}` : ""}</span>
                </div>
              ))}
            </div>

            {/* Print-only full statement. */}
            <div className="hidden print:block text-sm">
              <h2 className="text-lg font-bold">Account Statement — {ledger.profile.name}</h2>
              <p>{ledger.profile.roleNumber} · {ledger.fee.templateName}</p>
              <h3 className="mt-3 font-semibold">Fee Structure &amp; Discounts</h3>
              <table className="w-full">
                <tbody>
                  {ledger.fee.rows.map((r) => (
                    <tr key={r.label}><td>{r.label}</td><td>{money(r.amount)}</td><td>-{money(r.discount)}</td><td>{money(r.net)}</td></tr>
                  ))}
                </tbody>
              </table>
              <h3 className="mt-3 font-semibold">Installments</h3>
              <table className="w-full">
                <thead><tr><th className="text-left">Name</th><th className="text-left">Due</th><th className="text-right">Amount</th><th className="text-right">Paid</th><th className="text-left">Status</th></tr></thead>
                <tbody>
                  {ledger.installments.map((ins) => (
                    <tr key={ins.no}><td>{ins.name}</td><td>{ins.dueDate}</td><td className="text-right">{money(ins.amount)}</td><td className="text-right">{money(ins.paid)}</td><td>{ins.status}</td></tr>
                  ))}
                </tbody>
              </table>
              <h3 className="mt-3 font-semibold">Payment History</h3>
              <table className="w-full">
                <thead><tr><th className="text-left">Receipt</th><th className="text-left">Date</th><th className="text-left">Target</th><th className="text-right">Amount</th></tr></thead>
                <tbody>
                  {ledger.payments.map((p) => (
                    <tr key={p.id}><td>{p.ref || p.id.slice(0, 8)}</td><td>{p.at}</td><td>{p.target}</td><td className="text-right">{money(p.amount, p.currencyCode)}</td></tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 border-t pt-2">
                <p>Assigned: {money(ledger.totals.assigned, ledger.totals.currency)} · Paid: {money(ledger.totals.paid, ledger.totals.currency)}</p>
                <p><strong>Balance: {money(ledger.totals.balance, ledger.totals.currency)} ({ledger.totals.status})</strong></p>
              </div>
            </div>

            <div className="flex justify-end gap-2 print:hidden">
              <Button variant="outline" onClick={onClose}>Close</Button>
              <Button onClick={() => window.print()}>Print Statement</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
