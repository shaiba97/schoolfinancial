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
import { useI18n } from "@/lib/i18n/locale-provider";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { StudentLedger, LedgerPayment, DiscountEligibility } from "@/lib/api/types";
import { RecordPaymentDialog, type PresetStudent } from "@/components/finance/record-payment-dialog";
import { PrintSingleReceiptModal } from "@/components/finance/print-single-receipt-modal";
import { PrintMasterStatementModal } from "@/components/finance/print-master-statement-modal";

const METHOD_KEYS: Record<string, "ledger.methodCash" | "ledger.methodBankak" | "ledger.methodFawry" | "ledger.methodOkash" | "ledger.methodAlMashriq"> = {
  CASH: "ledger.methodCash",
  BANKAK: "ledger.methodBankak",
  FAWRY: "ledger.methodFawry",
  OKASH: "ledger.methodOkash",
  AL_MASHRIQ: "ledger.methodAlMashriq",
};

function StatusBadge({ status }: { status: StudentLedger["totals"]["status"] }) {
  const { t } = useI18n();
  if (status === "FULLY_PAID") return <Badge variant="success">{t("ledger.statusFULLY_PAID")}</Badge>;
  if (status === "OVERDUE") return <Badge variant="destructive">{t("ledger.statusOVERDUE")}</Badge>;
  return <Badge variant="warning">{t("ledger.statusPARTIALLY_PAID")}</Badge>;
}

function InstallmentBadge({ status }: { status: string }) {
  const { t } = useI18n();
  if (status === "PAID") return <Badge variant="success">{t("ledger.statusFULLY_PAID")}</Badge>;
  if (status === "OVERDUE") return <Badge variant="destructive">{t("ledger.statusOVERDUE")}</Badge>;
  if (status === "PARTIAL") return <Badge variant="warning">{t("ledger.statusPARTIALLY_PAID")}</Badge>;
  return <Badge variant="secondary">{t("ledger.schedulePending")}</Badge>;
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
  const { t, locale } = useI18n();
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
        <Button variant="outline" size="sm" onClick={load}>{t("ledger.retry")}</Button>
      </div>
    );
  }
  if (!ledger) return null;

  const totals = ledger.totals;
  const cur = totals.currency;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{ledger.profile.name}</h1>
          <p className="text-sm text-muted-foreground">
            {ledger.profile.roleNumber}
            {ledger.profile.grade != null ? ` · ${t("ledger.gradeRow", { no: ledger.profile.grade })}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {eligible.length > 0 ? (
              eligible.map((e) => (
                <Badge key={e.id} variant="info">
                  {e.label} ({e.valueType === "PERCENTAGE" ? t("ledger.pctOff", { pct: String(e.value) }) : `-${money(e.value, cur)}`})
                </Badge>
              ))
            ) : (
              <Badge variant="secondary">{t("ledger.standardTuition")}</Badge>
            )}
          </div>
        </div>
        <Button size="sm" onClick={() => setStatementOpen(true)}>
          <Printer className="h-4 w-4 mr-1 rtl:mr-0 rtl:ml-1" /> {t("ledger.printStatement")}
        </Button>
      </div>

      {/* Section A: snapshot */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">{t("ledger.assignedFees")}</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{money(totals.assigned, cur)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">{t("ledger.totalPaid")}</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold text-success">{money(totals.paid, cur)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">{t("ledger.outstanding")}</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold text-destructive">{money(totals.balance, cur)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">{t("ledger.accountStatus")}</CardTitle></CardHeader>
          <CardContent><StatusBadge status={totals.status} /></CardContent>
        </Card>
      </div>
      {ledger.profile.guardians.length > 0 && (
        <Card>
          <CardHeader><CardTitle>{t("ledger.guardiansCard")}</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {ledger.profile.guardians.map((g, i) => (
              <div key={i} className="flex justify-between">
                <span className="text-muted-foreground">{g.relationship || t("ledger.guardianFallback")}{g.isPrimary ? ` ${t("ledger.guardianPrimary")}` : ""}</span>
                <span>{g.name}{g.phone ? ` · ${g.phone}` : ""}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Section B: fee structure */}
      <Card>
        <CardHeader><CardTitle>{ledger.fee.templateName || t("ledger.feeFallbackTitle")}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("ledger.colFeeItem")}</TableHead>
                <TableHead className="text-right">{t("ledger.colAmount")}</TableHead>
                <TableHead className="text-right">{t("ledger.colAppliedDiscount")}</TableHead>
                <TableHead className="text-right">{t("ledger.colNetCharge")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledger.fee.rows.map((r) => (
                <TableRow key={r.label}>
                  <TableCell className="font-medium">{r.label}</TableCell>
                  <TableCell className="text-right">{money(r.amount, ledger.fee.currency)}</TableCell>
                  <TableCell className="text-right text-info">{r.discount > 0 ? `-${money(r.discount, ledger.fee.currency)}` : "—"}</TableCell>
                  <TableCell className="text-right font-bold">{money(r.net, ledger.fee.currency)}</TableCell>
                </TableRow>
              ))}
              {ledger.fee.rows.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">{t("ledger.noFeeStructure")}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          {ledger.fee.rows.length > 0 && (
            <div className="space-y-1 border-t p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("ledger.grossTuition")}</span>
                <span className="font-medium">{money(ledger.fee.total, ledger.fee.currency)}</span>
              </div>
              <div className="flex justify-between text-destructive">
                <span>{t("ledger.appliedDiscountRow")}</span>
                <span>-{money(ledger.fee.totalDiscount, ledger.fee.currency)}</span>
              </div>
              <div className="flex justify-between border-t pt-1 font-semibold">
                <span>{t("ledger.netTuition")}</span>
                <span>{money(ledger.fee.netTotal, ledger.fee.currency)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section C: installments */}
      <Card>
        <CardHeader><CardTitle>{t("ledger.scheduleCard")}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("ledger.colInstallment")}</TableHead>
                <TableHead>{t("ledger.colDueDate")}</TableHead>
                <TableHead className="text-right">{t("ledger.colAmountDue")}</TableHead>
                <TableHead className="text-right">{t("ledger.colDiscount")}</TableHead>
                <TableHead className="text-right">{t("ledger.colPaid")}</TableHead>
                <TableHead className="text-right">{t("ledger.colRemaining")}</TableHead>
                <TableHead>{t("ledger.colStatus")}</TableHead>
                <TableHead>{t("ledger.colAction")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledger.installments.map((ins) => (
                <TableRow key={ins.no}>
                  <TableCell className="font-medium">{ins.name}</TableCell>
                  <TableCell>{ins.dueDate ? formatDate(ins.dueDate, locale) : "—"}</TableCell>
                  <TableCell className="text-right">{money(ins.amount, cur)}</TableCell>
                  <TableCell className="text-right text-info">{ins.discounted > 0 ? `-${money(ins.discounted, cur)}` : "—"}</TableCell>
                  <TableCell className="text-right text-success">{money(ins.paid, cur)}</TableCell>
                  <TableCell className="text-right">{money(ins.remaining, cur)}</TableCell>
                  <TableCell><InstallmentBadge status={ins.status} /></TableCell>
                  <TableCell>
                    {ins.status !== "PAID" ? (
                      <Button size="sm" variant="outline" onClick={() => collectFor(ins.no)}>
                        <Plus className="h-3 w-3 mr-1" /> {t("ledger.collect")}
                      </Button>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {ledger.installments.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">{t("ledger.noInstallments")}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Section C: collections log */}
      <Card>
        <CardHeader><CardTitle>{t("ledger.logCard")}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("ledger.colReceipt")}</TableHead>
                <TableHead>{t("ledger.colDateTime")}</TableHead>
                <TableHead>{t("ledger.colTarget")}</TableHead>
                <TableHead>{t("ledger.colMethod")}</TableHead>
                <TableHead className="text-right">{t("ledger.colAmountPaid")}</TableHead>
                <TableHead>{t("ledger.colCollectedBy")}</TableHead>
                <TableHead>{t("ledger.colAction")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledger.payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.ref || p.id.slice(0, 8)}</TableCell>
                  <TableCell className="whitespace-nowrap">{p.at ? formatDateTime(p.at, locale) : "—"}</TableCell>
                  <TableCell>{p.target}</TableCell>
                  <TableCell><Badge variant="outline">{METHOD_KEYS[p.method] ? t(METHOD_KEYS[p.method]) : p.method}</Badge></TableCell>
                  <TableCell className="text-right text-success">{money(p.amount, p.currencyCode)}</TableCell>
                  <TableCell>{p.by}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => setReceipt(p)}>
                      <Printer className="h-3 w-3 mr-1" /> {t("ledger.printReceipt")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {ledger.payments.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">{t("ledger.noPayments")}</TableCell></TableRow>
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
