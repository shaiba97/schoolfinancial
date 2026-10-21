"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useCurrency } from "@/components/portal/currency-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Printer, Plus } from "lucide-react";
import { financialApiFetch, ApiError } from "@/lib/api/client";
import type { StudentLedger, LedgerPayment, DiscountEligibility } from "@/lib/api/types";
import { RecordPaymentDialog, type PresetStudent } from "@/components/finance/record-payment-dialog";
import { PrintSingleReceiptModal } from "@/components/finance/print-single-receipt-modal";
import { PrintMasterStatementModal } from "@/components/finance/print-master-statement-modal";

function fmtDay(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric", timeZone: "UTC" });
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

function StatusBadge({ status }: { status: StudentLedger["totals"]["status"] }) {
  if (status === "FULLY_PAID") return <Badge className="bg-green-600">FULLY_PAID</Badge>;
  if (status === "OVERDUE") return <Badge variant="destructive">OVERDUE</Badge>;
  return <Badge className="bg-amber-500">PARTIALLY_PAID</Badge>;
}

function InstallmentBadge({ status }: { status: string }) {
  if (status === "PAID") return <Badge className="bg-green-600">PAID</Badge>;
  if (status === "OVERDUE") return <Badge variant="destructive">OVERDUE</Badge>;
  if (status === "PARTIAL") return <Badge className="bg-amber-500">PARTIAL</Badge>;
  return <Badge variant="secondary">PENDING</Badge>;
}

export default function StudentLedgerPage() {
  return (
    <Suspense fallback={<div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>}>
      <StudentDetailContent />
    </Suspense>
  );
}

function StudentDetailContent() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";
  const { money } = useCurrency();
  const [ledger, setLedger] = useState<StudentLedger | null>(null);
  const [eligible, setEligible] = useState<DiscountEligibility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [preset, setPreset] = useState<PresetStudent | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [receipt, setReceipt] = useState<LedgerPayment | null>(null);
  const [statementOpen, setStatementOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [data, elig] = await Promise.all([
        financialApiFetch<StudentLedger>(`/finance/students/${id}/ledger`),
        financialApiFetch<DiscountEligibility[]>(`/finance/students/${id}/eligible-discounts`).catch(() => []),
      ]);
      setLedger(data);
      setEligible(Array.isArray(elig) ? elig : []);
      setError("");
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  function collectFor(installmentNo: number | null) {
    if (!ledger) return;
    setPreset({
      id: ledger.profile.id,
      name: ledger.profile.name,
      label: `${ledger.profile.name} · ${ledger.profile.roleNumber}`,
      ...(installmentNo != null ? { targetKey: `installment:${installmentNo}` } : {}),
    });
    setPayOpen(true);
  }

  if (loading) return <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>;
  if (error) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-destructive text-sm">{error}</p>
        <Button variant="outline" size="sm" onClick={load}>Retry</Button>
      </div>
    );
  }
  if (!ledger) return null;

  const t = ledger.totals;
  const cur = t.currency;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{ledger.profile.name}</h1>
          <p className="text-sm text-muted-foreground">
            {ledger.profile.roleNumber}
            {ledger.profile.grade != null ? ` · Grade ${ledger.profile.grade}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {eligible.length > 0 ? (
              eligible.map((e) => (
                <Badge key={e.id} className="bg-purple-600">
                  {e.label} ({e.valueType === "PERCENTAGE" ? `${e.value}% off` : `-${money(e.value, cur)}`})
                </Badge>
              ))
            ) : (
              <Badge variant="secondary">Standard Tuition (No Discounts Applied)</Badge>
            )}
          </div>
        </div>
        <Button size="sm" onClick={() => setStatementOpen(true)}>
          <Printer className="h-4 w-4 mr-1" /> Print Full Account Statement
        </Button>
      </div>

      {/* Section A: snapshot */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Total Assigned Fees</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{money(t.assigned, cur)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Total Paid</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold text-green-600">{money(t.paid, cur)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Outstanding Balance</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold text-destructive">{money(t.balance, cur)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Account Status</CardTitle></CardHeader>
          <CardContent><StatusBadge status={t.status} /></CardContent>
        </Card>
      </div>
      {ledger.profile.guardians.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Parent / Guardian</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {ledger.profile.guardians.map((g, i) => (
              <div key={i} className="flex justify-between">
                <span className="text-muted-foreground">{g.relationship || "Guardian"}{g.isPrimary ? " (primary)" : ""}</span>
                <span>{g.name}{g.phone ? ` · ${g.phone}` : ""}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Section B: fee structure */}
      <Card>
        <CardHeader><CardTitle>{ledger.fee.templateName || "Assigned Grade Fee Structure"}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fee Item</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Applied Discount</TableHead>
                <TableHead className="text-right">Net Charge</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledger.fee.rows.map((r) => (
                <TableRow key={r.label}>
                  <TableCell className="font-medium">{r.label}</TableCell>
                  <TableCell className="text-right">{money(r.amount, ledger.fee.currency)}</TableCell>
                  <TableCell className="text-right text-purple-600">{r.discount > 0 ? `-${money(r.discount, ledger.fee.currency)}` : "—"}</TableCell>
                  <TableCell className="text-right font-bold">{money(r.net, ledger.fee.currency)}</TableCell>
                </TableRow>
              ))}
              {ledger.fee.rows.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No fee structure assigned.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          {ledger.fee.rows.length > 0 && (
            <div className="space-y-1 border-t p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Gross Grade Tuition</span>
                <span className="font-medium">{money(ledger.fee.total, ledger.fee.currency)}</span>
              </div>
              <div className="flex justify-between text-destructive">
                <span>Applied Discount / Waiver</span>
                <span>-{money(ledger.fee.totalDiscount, ledger.fee.currency)}</span>
              </div>
              <div className="flex justify-between border-t pt-1 font-semibold">
                <span>Net Adjusted Tuition</span>
                <span>{money(ledger.fee.netTotal, ledger.fee.currency)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section C: installments */}
      <Card>
        <CardHeader><CardTitle>Installment Schedule</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Installment</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Amount Due</TableHead>
                <TableHead className="text-right">Discount</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Remaining</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledger.installments.map((ins) => (
                <TableRow key={ins.no}>
                  <TableCell className="font-medium">{ins.name}</TableCell>
                  <TableCell>{fmtDay(ins.dueDate)}</TableCell>
                  <TableCell className="text-right">{money(ins.amount, cur)}</TableCell>
                  <TableCell className="text-right text-purple-600">{ins.discounted > 0 ? `-${money(ins.discounted, cur)}` : "—"}</TableCell>
                  <TableCell className="text-right text-green-600">{money(ins.paid, cur)}</TableCell>
                  <TableCell className="text-right">{money(ins.remaining, cur)}</TableCell>
                  <TableCell><InstallmentBadge status={ins.status} /></TableCell>
                  <TableCell>
                    {ins.status !== "PAID" ? (
                      <Button size="sm" variant="outline" onClick={() => collectFor(ins.no)}>
                        <Plus className="h-3 w-3 mr-1" /> Collect Payment
                      </Button>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {ledger.installments.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">No installments scheduled.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Section C: collections log */}
      <Card>
        <CardHeader><CardTitle>Payment Collections Log</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Receipt / Voucher</TableHead>
                <TableHead>Date &amp; Time</TableHead>
                <TableHead>Target Installment</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Amount Paid</TableHead>
                <TableHead>Collected By</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledger.payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.ref || p.id.slice(0, 8)}</TableCell>
                  <TableCell className="whitespace-nowrap">{fmtAt(p.at)}</TableCell>
                  <TableCell>{p.target}</TableCell>
                  <TableCell><Badge variant="outline">{p.method}</Badge></TableCell>
                  <TableCell className="text-right text-green-600">{money(p.amount, p.currencyCode)}</TableCell>
                  <TableCell>{p.by}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => setReceipt(p)}>
                      <Printer className="h-3 w-3 mr-1" /> Print Single Receipt
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {ledger.payments.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No payments recorded.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {payOpen && (
        <RecordPaymentDialog
          onCreated={async () => { setPayOpen(false); await load(); }}
          presetStudent={preset}
          open={payOpen}
          onClose={() => setPayOpen(false)}
        />
      )}
      <PrintSingleReceiptModal payment={receipt} ledger={ledger} onClose={() => setReceipt(null)} />
      <PrintMasterStatementModal ledger={ledger} open={statementOpen} onClose={() => setStatementOpen(false)} />
    </div>
  );
}
