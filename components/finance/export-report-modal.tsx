"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useCurrency } from "@/components/portal/currency-provider";
import { useI18n } from "@/lib/i18n/locale-provider";
import type { MessageKey } from "@/lib/i18n/locale-provider";
import type { LedgerRow, ReportKind, ReportSummary } from "@/lib/api/types";

interface ExportReportModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rangeLabel: string;
  summary: ReportSummary | null;
  rows: LedgerRow[];
}

const KIND_KEYS: { value: ReportKind; key: MessageKey }[] = [
  { value: "summary", key: "repModal.kindSummary" },
  { value: "collections", key: "repModal.kindCollections" },
  { value: "expenses", key: "repModal.kindExpenses" },
  { value: "discounts", key: "repModal.kindDiscounts" },
];

function filteredRows(kind: ReportKind, rows: LedgerRow[]): LedgerRow[] {
  if (kind === "summary") return rows;
  if (kind === "collections") return rows.filter((r) => r.type === "COLLECTION");
  if (kind === "expenses") return rows.filter((r) => r.type === "EXPENSE" || r.type === "PAYROLL");
  return rows.filter((r) => r.type === "DISCOUNT");
}

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function ExportReportModal({ open, onOpenChange, rangeLabel, summary, rows }: ExportReportModalProps) {
  const { money } = useCurrency();
  const { t } = useI18n();
  const [kind, setKind] = React.useState<ReportKind>("summary");
  const [format, setFormat] = React.useState<"pdf" | "csv">("pdf");

  React.useEffect(() => {
    if (open) {
      setKind("summary");
      setFormat("pdf");
    }
  }, [open ]);

  function buildCsv(): string {
    const data = filteredRows(kind, rows);
    if (kind === "summary" && summary) {
      const lines = [
        ["Metric", "Amount"].map(csvCell).join(","),
        ["Total Collections", summary.collections].map(csvCell).join(","),
        ["Total Expenses", summary.expenses].map(csvCell).join(","),
        ["Total Discounts", summary.discounts].map(csvCell).join(","),
        ["Net Cash Flow", summary.net].map(csvCell).join(","),
        [],
        ["Channel", "Count", "Total", "Share %"].map(csvCell).join(","),
        ...summary.byMethod.map((m) => [m.method, m.count, m.total, m.share].map(csvCell).join(",")),
      ];
      return lines.join("\n");
    }
    const lines = [
      ["Date", "Type", "Title", "Channel", "Amount", "Reference", "Recorded By"].map(csvCell).join(","),
      ...data.map((r) => [r.at, r.type, r.title, r.channel, r.amount, r.ref, r.by].map(csvCell).join(",")),
    ];
    return lines.join("\n");
  }

  function download() {
    const blob = new Blob([buildCsv()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `financial-report-${kind}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onOpenChange(false);
  }

  function printRows(): LedgerRow[] {
    return filteredRows(kind, rows);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("repModal.title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("repModal.reportType")}</Label>
            <RadioGroup value={kind} onValueChange={(v) => { if (v) setKind(v as ReportKind); }}>
              {KIND_KEYS.map((k) => (
                <div key={k.value} className="flex items-center gap-2">
                  <RadioGroupItem value={k.value} id={`rep-${k.value}`} />
                  <Label htmlFor={`rep-${k.value}`} className="font-normal">{t(k.key)}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rep-range">{t("repModal.dateRange")}</Label>
            <Input id="rep-range" value={rangeLabel} readOnly />
          </div>
          <div className="space-y-2">
            <Label>{t("repModal.format")}</Label>
            <div className="flex gap-2">
              <Button
                variant={format === "pdf" ? "default" : "outline"}
                onClick={() => setFormat("pdf")}
              >
                {t("repModal.pdfStatement")}
              </Button>
              <Button
                variant={format === "csv" ? "default" : "outline"}
                onClick={() => setFormat("csv")}
              >
                {t("repModal.csvSpreadsheet")}
              </Button>
            </div>
          </div>
          {/* Print-only rendering: hidden on screen, visible to the printer. */}
          <div className="hidden print:block">
            <h2 className="text-lg font-bold">{t("repModal.printTitle", { label: t(KIND_KEYS.find((k) => k.value === kind)!.key) })}</h2>
            <p className="text-sm">{rangeLabel}</p>
            {kind === "summary" && summary ? (
              <table className="mt-2 w-full text-sm">
                <tbody>
                  <tr><td>{t("repMetric.totalCollections")}</td><td>{money(summary.collections)}</td></tr>
                  <tr><td>{t("repMetric.totalExpenses")}</td><td>{money(summary.expenses)}</td></tr>
                  <tr><td>{t("repMetric.totalDiscounts")}</td><td>{money(summary.discounts)}</td></tr>
                  <tr><td><strong>{t("repMetric.netCashFlow")}</strong></td><td><strong>{money(summary.net)}</strong></td></tr>
                </tbody>
              </table>
            ) : (
              <table className="mt-2 w-full text-sm" dir="ltr">
                <thead>
                  <tr><th className="text-left">{t("repModal.colDate")}</th><th className="text-left">{t("repModal.colType")}</th><th className="text-left">{t("repModal.colTitle")}</th><th className="text-right">{t("repModal.colAmount")}</th></tr>
                </thead>
                <tbody>
                  {printRows().map((r) => (
                    <tr key={r.id}>
                      <td>{r.at}</td><td>{r.type}</td><td>{r.title}</td><td className="text-right">{money(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="flex justify-end gap-2 print:hidden">
            <Button variant="outline" onClick={() => window.print()}>{t("repModal.printDirect")}</Button>
            <Button onClick={format === "csv" ? download : () => window.print()}>{t("repModal.download")}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
