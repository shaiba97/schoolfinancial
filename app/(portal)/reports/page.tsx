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
import type { LedgerRow, ReportSummary } from "@/lib/api/types";
import { ExportReportModal } from "@/components/finance/export-report-modal";

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
        <h1 className="text-2xl font-bold">Financial Reports</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={preset} onValueChange={(v) => { if (v) changePreset(v); }}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
          {preset === "custom" && (
            <>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
            </>
          )}
          <Button size="sm" onClick={() => setExportOpen(true)}>
            <Download className="h-4 w-4 mr-1" /> Export PDF / CSV
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => { if (v) changeTab(v); }} className="space-y-4">
        <TabsList>
          <TabsTrigger value="summary">Financial Summary</TabsTrigger>
          <TabsTrigger value="ledger">Master Transaction Ledger</TabsTrigger>
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
  if (!summary) {
    return <div className="space-y-3">{[1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>;
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Total Collections</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold text-green-600">{money(summary.collections)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Total Expenses</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold text-destructive">{money(summary.expenses)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Total Discounts</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold text-purple-600">{money(summary.discounts)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Net Cash Flow</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{money(summary.net)}</CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Payment Method Breakdown</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Channel</TableHead>
                <TableHead>Transactions</TableHead>
                <TableHead>Total Revenue</TableHead>
                <TableHead>% of Collections</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.byMethod.map((m) => (
                <TableRow key={m.method}>
                  <TableCell><Badge variant="secondary">{m.method}</Badge></TableCell>
                  <TableCell>{m.count}</TableCell>
                  <TableCell className="text-green-600">{money(m.total)}</TableCell>
                  <TableCell>{m.share}%</TableCell>
                </TableRow>
              ))}
              {summary.byMethod.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No collections in range.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function fmtAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const date = d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric", timeZone: "UTC" });
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });
  return `${date} - ${time}`;
}

function LedgerTab({ rows }: { rows: LedgerRow[] }) {
  const { money } = useCurrency();
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
          <SelectTrigger className="w-52"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="collections">Collections (Income)</SelectItem>
            <SelectItem value="expenses">Expenses / Payroll</SelectItem>
            <SelectItem value="discounts">Discounts Granted</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search student, voucher, payee, staff..."
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
                <TableHead>Date &amp; Time</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Recorded By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">{fmtAt(r.at)}</TableCell>
                  <TableCell>
                    {r.type === "COLLECTION" && <Badge className="bg-green-600">COLLECTION</Badge>}
                    {(r.type === "EXPENSE" || r.type === "PAYROLL") && <Badge variant="destructive">{r.type}</Badge>}
                    {r.type === "DISCOUNT" && <Badge className="bg-purple-600">DISCOUNT</Badge>}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{r.title}</p>
                    {r.ref && <p className="text-xs text-muted-foreground">{r.ref}</p>}
                  </TableCell>
                  <TableCell><Badge variant="outline">{r.channel}</Badge></TableCell>
                  <TableCell className={`text-right font-medium ${r.amount < 0 ? "text-destructive" : "text-green-600"}`}>
                    {money(r.amount)}
                  </TableCell>
                  <TableCell>{r.by}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No transactions in range.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
