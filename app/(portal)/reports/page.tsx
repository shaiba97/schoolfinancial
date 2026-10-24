"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCurrency } from "@/components/portal/currency-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Download, Search } from "lucide-react";
import { financialApiFetch } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/locale-provider";
import type { MessageKey } from "@/lib/i18n/locale-provider";
import { formatDateTime } from "@/lib/utils";
import type { LedgerRow, ReportSummary } from "@/lib/api/types";
import { ExportReportModal } from "@/components/finance/export-report-modal";

const METHOD_KEYS: Record<string, MessageKey> = {
  cash: "payments.methodCash",
  bankak: "payments.methodBankak",
  fawry: "payments.methodFawry",
  okash: "payments.methodOkash",
  al_mashriq: "payments.methodAlMashriq",
  CASH: "ledger.methodCash",
  BANKAK: "ledger.methodBankak",
  FAWRY: "ledger.methodFawry",
  OKASH: "ledger.methodOkash",
  AL_MASHRIQ: "ledger.methodAlMashriq",
};

type Preset = "today" | "week" | "month" | "custom";

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function presetRange(p: Preset): { from: string; to: string } {
  const now = new Date();
  if (p === "today") {
    const t = isoDay(now);
    return { from: t, to: t };
  }
  if (p === "week") {
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    return { from: isoDay(start), to: isoDay(now) };
  }
  return {
    from: `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`,
    to: isoDay(now),
  };
}

function rangeLabel(from: string, to: string): string {
  return from === to ? from : `${from} → ${to}`;
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>}>
      <ReportsContent />
    </Suspense>
  );
}

function ReportsContent() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const param = searchParams.get("tab");
  const paramTab = param === "ledger" ? "ledger" : "summary";
  const [tab, setTab] = useState(paramTab);
  const [preset, setPreset] = useState<Preset>("month");
  const [from, setFrom] = useState(() => presetRange("month").from);
  const [to, setTo] = useState(() => presetRange("month").to);
  const [exportOpen, setExportOpen] = useState(false);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [rows, setRows] = useState<LedgerRow[]>([]);

  useEffect(() => {
    const p = searchParams.get("tab");
    setTab(p === "ledger" ? "ledger" : "summary");
  }, [searchParams]);

  function changeTab(v: string | null) {
    if (!v) return;
    setTab(v);
    router.replace(`/reports?tab=${v}`);
  }

  function changePreset(v: string | null) {
    if (!v || (v !== "today" && v !== "week" && v !== "month" && v !== "custom")) return;
    setPreset(v);
    if (v !== "custom") {
      const r = presetRange(v);
      setFrom(r.from);
      setTo(r.to);
    }
  }

  const qs = useMemo(() => `from=${from}&to=${to}`, [from, to]);

  const loadSummary = useCallback(async () => {
    try {
      const data = await financialApiFetch<ReportSummary>(`/finance/reports/summary?${qs}`);
      setSummary(data);
    } catch {
      setSummary(null);
    }
  }, [qs]);

  const loadLedger = useCallback(async () => {
    try {
      const data = await financialApiFetch<LedgerRow[]>(`/finance/reports/ledger?${qs}`);
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
    }
  }, [qs]);

  useEffect(() => { loadSummary(); loadLedger(); }, [loadSummary, loadLedger]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{t("reports.title")}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={preset} onValueChange={(v) => { if (v) changePreset(v); }}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">{t("reports.presetToday")}</SelectItem>
              <SelectItem value="week">{t("reports.presetWeek")}</SelectItem>
              <SelectItem value="month">{t("reports.presetMonth")}</SelectItem>
              <SelectItem value="custom">{t("reports.presetCustom")}</SelectItem>
            </SelectContent>
          </Select>
          {preset === "custom" && (
            <>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
            </>
          )}
          <Button size="sm" onClick={() => setExportOpen(true)}>
            <Download className="h-4 w-4 mr-1" /> {t("reports.export")}
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => { if (v) changeTab(v); }} className="space-y-4">
        <TabsList>
          <TabsTrigger value="summary">{t("reports.tabSummary")}</TabsTrigger>
          <TabsTrigger value="ledger">{t("reports.tabLedger")}</TabsTrigger>
        </TabsList>
        <TabsContent value="summary"><SummaryTab summary={summary} /></TabsContent>
        <TabsContent value="ledger"><LedgerTab rows={rows} /></TabsContent>
      </Tabs>

      <ExportReportModal
        open={exportOpen}
        onOpenChange={setExportOpen}
        rangeLabel={rangeLabel(from, to)}
        summary={summary}
        rows={rows}
      />
    </div>
  );
}

function SummaryTab({ summary }: { summary: ReportSummary | null }) {
  const { money } = useCurrency();
  const { t } = useI18n();
  if (!summary) {
    return <div className="space-y-3">{[1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>;
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">{t("reports.totalCollections")}</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold text-success">{money(summary.collections)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">{t("reports.totalExpenses")}</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold text-destructive">{money(summary.expenses)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">{t("reports.totalDiscounts")}</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold text-secondary">{money(summary.discounts)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">{t("reports.netCashFlow")}</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{money(summary.net)}</CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle>{t("reports.methodBreakdown")}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("reports.colChannel")}</TableHead>
                <TableHead>{t("reports.colTransactions")}</TableHead>
                <TableHead>{t("reports.colTotalRevenue")}</TableHead>
                <TableHead>{t("reports.colShare")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.byMethod.map((m) => (
                <TableRow key={m.method}>
                  <TableCell><Badge variant="secondary">{METHOD_KEYS[m.method] ? t(METHOD_KEYS[m.method]) : m.method}</Badge></TableCell>
                  <TableCell>{m.count}</TableCell>
                  <TableCell className="text-success">{money(m.total)}</TableCell>
                  <TableCell>{m.share}%</TableCell>
                </TableRow>
              ))}
              {summary.byMethod.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">{t("reports.noneInRange")}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function LedgerTab({ rows }: { rows: LedgerRow[] }) {
  const { money } = useCurrency();
  const { t, locale } = useI18n();
  const [type, setType] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => rows.filter((r) => {
    if (type === "collections" && r.type !== "COLLECTION") return false;
    if (type === "expenses" && r.type !== "EXPENSE" && r.type !== "PAYROLL") return false;
    if (type === "discounts" && r.type !== "DISCOUNT") return false;
    if (search) {
      const hay = `${r.title} ${r.ref} ${r.by}`.toLowerCase();
      if (!hay.includes(search.toLowerCase())) return false;
    }
    return true;
  }), [rows, type, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Select value={type} onValueChange={(v) => { if (v) setType(v); }}>
          <SelectTrigger className="w-52"><SelectValue placeholder={t("reports.type")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("reports.allTypes")}</SelectItem>
            <SelectItem value="collections">{t("reports.typeCollections")}</SelectItem>
            <SelectItem value="expenses">{t("reports.typeExpenses")}</SelectItem>
            <SelectItem value="discounts">{t("reports.typeDiscounts")}</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={t("reports.ledgerSearch")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("reports.colDateTime")}</TableHead>
                <TableHead>{t("reports.colType")}</TableHead>
                <TableHead>{t("reports.colDescription")}</TableHead>
                <TableHead>{t("reports.colChannel")}</TableHead>
                <TableHead className="text-right">{t("reports.colAmount")}</TableHead>
                <TableHead>{t("reports.colRecordedBy")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">{formatDateTime(r.at, locale)}</TableCell>
                  <TableCell>
                    {r.type === "COLLECTION" && <Badge variant="success">COLLECTION</Badge>}
                    {(r.type === "EXPENSE") && <Badge variant="destructive">{r.type}</Badge>}
                    {r.type === "PAYROLL" && <Badge variant="info">PAYROLL</Badge>}
                    {r.type === "DISCOUNT" && <Badge variant="secondary">DISCOUNT</Badge>}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{r.title}</p>
                    {r.ref && <p className="text-xs text-muted-foreground">{r.ref}</p>}
                  </TableCell>
                  <TableCell><Badge variant="outline">{r.channel}</Badge></TableCell>
                  <TableCell className={`text-right font-medium ${r.amount < 0 ? "text-destructive" : "text-success"}`}>
                    {money(r.amount)}
                  </TableCell>
                  <TableCell>{r.by}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{t("reports.noneTransactions")}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
