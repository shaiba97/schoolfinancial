"use client";

import { useEffect, useState, useCallback } from "react";
import { useCurrency } from "@/components/portal/currency-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { financialApiFetch, ApiError } from "@/lib/api/client";
import type { Payment } from "@/lib/api/types";
import { useFinanceRealtimeEvent } from "@/lib/realtime/socket";
import { RecordPaymentDialog, LEVEL_LABELS, GRADE_INT_LABELS } from "@/components/finance/record-payment-dialog";
import { CheckCircle, Printer, ChevronRight } from "lucide-react";

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash", bankak: "Bankak", fawry: "Fawry", okash: "Okash", al_mashriq: "Al Mashriq",
};

export default function PaymentsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Payments & Collections</h1>
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Payments</TabsTrigger>
          <TabsTrigger value="verification">Verification Queue</TabsTrigger>
        </TabsList>
        <TabsContent value="all"><AllPaymentsTab /></TabsContent>
        <TabsContent value="verification"><VerificationTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status + label helpers
// ---------------------------------------------------------------------------

function StatusBadge({ status, daysLate }: { status?: string; daysLate?: number }) {
  if (status === "paid_in_full") return <Badge className="bg-green-600 hover:bg-green-700 text-white">Paid in Full</Badge>;
  if (status === "overdue") return <Badge variant="destructive">Overdue{daysLate ? ` (${daysLate}d late)` : ""}</Badge>;
  if (status === "partial") return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white">Partial</Badge>;
  return <Badge className="bg-blue-600 hover:bg-blue-700 text-white">On Track</Badge>;
}

function effectLabel(eff: NonNullable<Payment["installmentEffect"]>): string {
  if (eff.isOpening && eff.isFinal) return "Paid in full";
  if (eff.isFinal) return "Final payment";
  if (eff.isOpening) return "Opening payment";
  return "Part payment";
}

function EffectBadge({ eff }: { eff: NonNullable<Payment["installmentEffect"]> }) {
  const label = effectLabel(eff);
  const cls =
    label === "Paid in full" || label === "Final payment"
      ? "bg-green-600 hover:bg-green-700 text-white"
      : label === "Opening payment"
        ? "bg-blue-600 hover:bg-blue-700 text-white"
        : "bg-yellow-500 hover:bg-yellow-600 text-white";
  return <Badge className={cls}>{label}</Badge>;
}

// Two-tone bar: cumulative paid as the track fill, this payment's slice overlaid.
function EffectBar({ before, after, total }: { before: number; after: number; total: number }) {
  const pct = (v: number) => (total > 0 ? Math.min(100, Math.max(0, (v / total) * 100)) : 0);
  return (
    <div className="relative h-1 w-full overflow-hidden rounded-full bg-muted">
      <div className="absolute inset-y-0 left-0 bg-primary/40" style={{ width: `${pct(after)}%` }} />
      <div
        className="absolute inset-y-0 bg-primary"
        style={{ left: `${pct(before)}%`, width: `${Math.max(0, pct(after) - pct(before))}%` }}
      />
    </div>
  );
}

function AllocationBadge({ kind, target, isFinal }: { kind?: string; target?: string; isFinal?: boolean }) {
  const cls =
    kind === "lump_sum" ? "bg-slate-800 hover:bg-slate-900 text-white"
    : kind === "registration" ? "bg-purple-600 hover:bg-purple-700 text-white"
    : "bg-blue-100 text-blue-800 border-blue-200";
  return (
    <Badge variant="outline" className={cls}>
      {target ?? "Lump-Sum"}{isFinal ? " (Final)" : ""}
    </Badge>
  );
}


// ---------------------------------------------------------------------------
// All payments ledger
// ---------------------------------------------------------------------------

function AllPaymentsTab() {
  const { money } = useCurrency();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<Payment | null>(null);
  const [audit, setAudit] = useState<Payment | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await financialApiFetch<Payment[]>("/finance/payments");
      setPayments(data);
      setError("");
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useFinanceRealtimeEvent("payment.recorded", {
    onEvent: () => load(),
    onReconnect: () => load(),
  });

  if (loading) return <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  if (error && payments.length === 0) return <div className="text-center py-12"><p className="text-destructive text-sm">{error}</p></div>;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Payments Ledger</CardTitle>
        <RecordPaymentDialog onCreated={load} />
      </CardHeader>
      <CardContent>
        {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
        {payments.length === 0 ? (
          <div className="text-center py-12"><p className="text-sm text-muted-foreground">No payments recorded</p></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Allocation</TableHead>
                <TableHead>This Payment</TableHead>
                <TableHead>Paid To Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => {
                const prog = p.installmentProgress;
                const eff = p.installmentEffect;
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="font-medium">{p.studentName}</div>
                      <div className="text-xs text-muted-foreground">
                        {[LEVEL_LABELS[p.educationLevel || ""], p.grade != null ? `Grade ${GRADE_INT_LABELS[p.grade] ?? p.grade}` : null, p.className]
                          .filter(Boolean).join(" • ") || "â€”"}
                      </div>
                      <div className="text-xs text-muted-foreground tabular-nums">
                        {new Date(p.paidAt).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell><AllocationBadge kind={p.allocationKind} target={p.allocationTarget} isFinal={p.isFinalPaymentOnInstallment} /></TableCell>
                    <TableCell>
                      <div className="font-medium text-green-700 tabular-nums">{money(p.amount, p.currencyCode)}</div>
                      <div className="text-xs text-muted-foreground">{METHOD_LABELS[p.method] ?? p.method}{p.reference ? ` • ${p.reference}` : ""}</div>
                      {eff && <div className="mt-1"><EffectBadge eff={eff} /></div>}
                    </TableCell>
                    <TableCell className="min-w-[140px]">
                      {eff && prog ? (
                        <>
                          <EffectBar before={eff.amountBefore} after={eff.amountAfter} total={prog.invoiceAmount} />
                          <div className="text-xs text-muted-foreground tabular-nums mt-1">
                            {money(prog.amountPaidToDate, p.currencyCode)} / {money(prog.invoiceAmount, p.currencyCode)}
                          </div>
                        </>
                      ) : prog ? (
                        <>
                          <Progress value={prog.percent} className="mb-1" />
                          <div className="text-xs text-muted-foreground tabular-nums">
                            {money(prog.amountPaidToDate, p.currencyCode)} / {money(prog.invoiceAmount, p.currencyCode)}
                          </div>
                        </>
                      ) : (
                        <>
                          <Progress value={p.progress ?? 0} className="mb-1" />
                          <div className="text-xs text-muted-foreground tabular-nums">
                            Total paid {money((p.totalFee ?? 0) - (p.balance ?? 0), p.currencyCode)} / {money(p.totalFee ?? 0, p.currencyCode)}
                          </div>
                        </>
                      )}
                    </TableCell>
                    <TableCell><StatusBadge status={p.status} daysLate={p.daysLate} /></TableCell>
                    <TableCell className="tabular-nums">{money(p.balance ?? 0, p.currencyCode)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setReceipt(p)} title="Print Receipt">
                          <Printer className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setAudit(p)} title="View Breakdown">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <ReceiptDialog payment={receipt} onClose={() => setReceipt(null)} />
      <AuditDialog payment={audit} onClose={() => setAudit(null)} />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Receipt + audit dialogs
// ---------------------------------------------------------------------------

function ReceiptDialog({ payment, onClose }: { payment: Payment | null; onClose: () => void }) {
  const { money } = useCurrency();
  const [downloading, setDownloading] = useState(false);
  const [dlError, setDlError] = useState("");

  async function downloadReceipt() {
    if (!payment) return;
    setDownloading(true); setDlError("");
    try {
      const res = await fetch(`/api/backend/finance/payments/${payment.id}/receipt`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Receipt download failed: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `receipt-${payment.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setDlError(e instanceof Error ? e.message : "Receipt download failed");
    } finally { setDownloading(false); }
  }

  return (
    <Dialog open={!!payment} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Payment Receipt</DialogTitle></DialogHeader>
        {payment && (
          <div className="space-y-2 text-sm" id="receipt-body">
            <div className="flex justify-between"><span className="text-muted-foreground">Student</span><span className="font-medium">{payment.studentName}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Payment Date</span><span>{new Date(payment.paidAt).toLocaleString()}</span></div>
            {payment.createdAt && (
              <div className="flex justify-between"><span className="text-muted-foreground">Receipt Issued</span><span>{new Date(payment.createdAt).toLocaleString()}</span></div>
            )}
            <div className="flex justify-between"><span className="text-muted-foreground">Allocation</span><span>{payment.allocationTarget}{payment.isFinalPaymentOnInstallment ? " (Final)" : ""}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Method</span><span>{METHOD_LABELS[payment.method] ?? payment.method}</span></div>
            {payment.reference && <div className="flex justify-between"><span className="text-muted-foreground">Ref</span><span>{payment.reference}</span></div>}
            <div className="flex justify-between border-t pt-2 text-base font-semibold">
              <span>Amount</span><span className="tabular-nums">{money(payment.amount, payment.currencyCode)}</span>
            </div>
            {dlError && <p className="text-sm text-destructive">{dlError}</p>}
            <Button className="w-full mt-2" onClick={downloadReceipt} disabled={downloading}>
              <Printer className="h-4 w-4 mr-1" />{downloading ? "Preparing PDF..." : "Print Receipt (PDF)"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AuditDialog({ payment, onClose }: { payment: Payment | null; onClose: () => void }) {
  const { money } = useCurrency();
  return (
    <Dialog open={!!payment} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Payment Breakdown</DialogTitle></DialogHeader>
        {payment && (
          <div className="space-y-2 text-sm">
            <div className="font-medium">{payment.studentName}</div>
            <div className="text-xs text-muted-foreground">
              {[LEVEL_LABELS[payment.educationLevel || ""], payment.grade != null ? `Grade ${GRADE_INT_LABELS[payment.grade] ?? payment.grade}` : null, payment.className]
                .filter(Boolean).join(" • ")}
            </div>
            <div className="rounded-md border p-3 space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Total Fee</span><span className="tabular-nums">{money(payment.totalFee ?? 0)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">This Payment</span><span className="tabular-nums text-green-700">{money(payment.amount)}</span></div>
              {payment.installmentEffect && payment.installmentProgress ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Effect</span>
                    <EffectBadge eff={payment.installmentEffect} />
                  </div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Paid Before</span><span className="tabular-nums">{money(payment.installmentEffect.amountBefore)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Contributed</span><span className="tabular-nums text-green-700">+{money(payment.installmentEffect.contributed)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Installment Paid</span><span className="tabular-nums">{money(payment.installmentProgress.amountPaidToDate)} / {money(payment.installmentProgress.invoiceAmount)}</span></div>
                </>
              ) : payment.installmentNo != null ? (
                <div className="flex justify-between"><span className="text-muted-foreground">Installment Paid</span><span className="tabular-nums">{money(payment.installmentPaid ?? 0)} / {money(payment.installmentAmount ?? 0)}</span></div>
              ) : (
                <div className="flex justify-between"><span className="text-muted-foreground">Total Paid To Date</span><span className="tabular-nums">{money((payment.totalFee ?? 0) - (payment.balance ?? 0))} / {money(payment.totalFee ?? 0)}</span></div>
              )}
              <div className="flex justify-between border-t pt-1"><span className="text-muted-foreground">Remaining Balance</span><span className="tabular-nums font-medium">{money(payment.balance ?? 0)}</span></div>
            </div>
            <div className="flex items-center justify-between">
              <span>Status</span>
              <StatusBadge status={payment.status} daysLate={payment.daysLate} />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Verification queue (kept: electronic methods reconciled by transaction ID)
// ---------------------------------------------------------------------------

function VerificationTab() {
  const { money } = useCurrency();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await financialApiFetch<Payment[]>("/finance/payments?status=pending");
      setPayments(data);
      setError("");
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useFinanceRealtimeEvent("payment.recorded", {
    onEvent: () => load(),
    onReconnect: () => load(),
  });

  async function verifyPayment(id: string) {
    try {
      await financialApiFetch(`/finance/payments/${id}/verify`, { method: "POST", body: "{}" });
      setPayments((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
    }
  }

  if (loading) return <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  if (error) return <div className="text-center py-12"><p className="text-destructive text-sm">{error}</p></div>;

  return (
    <Card>
      <CardHeader><CardTitle>Payment Verification Queue</CardTitle></CardHeader>
      <CardContent>
        {payments.length === 0 ? (
          <div className="text-center py-12"><p className="text-sm text-muted-foreground">No payments pending verification</p></div>
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Amount</TableHead><TableHead>Method</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.studentName}</TableCell>
                  <TableCell>{money(p.amount, p.currencyCode)}</TableCell>
                  <TableCell><Badge variant="outline">{METHOD_LABELS[p.method] ?? p.method}</Badge></TableCell>
                  <TableCell>{new Date(p.paidAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => verifyPayment(p.id)}>
                      <CheckCircle className="h-4 w-4 mr-1" />Verify
                    </Button>
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
