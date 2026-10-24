"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useCurrency } from "@/components/portal/currency-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { financialApiFetch, ApiError } from "@/lib/api/client";
import type { DashboardStats, Position } from "@/lib/api/types";
import { useFinanceRealtimeEvent } from "@/lib/realtime/socket";
import { useI18n } from "@/lib/i18n/locale-provider";
import {
  TrendingUp, TrendingDown, Wallet, GraduationCap, Users, ArrowRight,
} from "lucide-react";

function fmtAt(iso: string | null, locale: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString(locale === "ar" ? "ar-u-nu-latn" : "en-GB", { month: "short", day: "2-digit", year: "numeric", timeZone: "UTC" });
}

export default function DashboardPage() {
  const router = useRouter();
  const { money } = useCurrency();
  const { t, locale } = useI18n();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // True when the backend predates the outflows/headcount extension — the
  // numbers below are partial, and no code on this page can fill them in.
  const [staleBackend, setStaleBackend] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, p] = await Promise.all([
        financialApiFetch<Partial<DashboardStats>>("/finance/dashboard"),
        financialApiFetch<Position[]>("/finance/positions").catch(() => []),
      ]);
      // Merge over a complete fallback so an old backend (three-field shape)
      // renders zeros instead of throwing on missing fields — and say so.
      setStaleBackend(s.payroll === undefined || s.totalStudents === undefined);
      const expenses = s.expenses ?? 0;
      setStats({
        ...(s.tenant ? { tenant: s.tenant } : {}),
        totalCollected: s.totalCollected ?? 0,
        expenses,
        netCashFlow: s.netCashFlow ?? 0,
        payroll: s.payroll ?? 0,
        outflows: s.outflows ?? expenses,
        collectionsLastMonth: s.collectionsLastMonth ?? 0,
        collectionsChangePct: s.collectionsChangePct ?? null,
        totalStudents: s.totalStudents ?? 0,
        totalTeachers: s.totalTeachers ?? 0,
        recentActivity: Array.isArray(s.recentActivity) ? s.recentActivity : [],
      });
      setPositions(Array.isArray(p) ? p.filter((x) => x.isActive) : []);
      setError("");
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // A payment recorded anywhere in the school changes the numbers on this
  // page (total collected, net liquidity, recent activity); refetch on the
  // broadcast instead of requiring a refresh.
  useFinanceRealtimeEvent("payment.recorded", {
    onEvent: () => load(),
    onReconnect: () => load(),
  });

  if (loading) return <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>;
  if (error && !stats) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-destructive text-sm">{error}</p>
        <Button variant="outline" size="sm" onClick={load}>{t("common.retry")}</Button>
      </div>
    );
  }
  if (!stats) return null;

  const netPositive = stats.netCashFlow >= 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline gap-2">
        <h1 className="text-2xl font-bold">{t("dashboard.title")}</h1>
        {stats.tenant?.name && (
          <span className="text-sm text-muted-foreground">· {stats.tenant.name}</span>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {staleBackend && (
        <div className="rounded-md bg-warning-surface p-3 text-sm text-warning">
          {t("dashboard.staleBackend")}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("dashboard.totalCollections")}</CardTitle>
            <TrendingUp className="h-5 w-5 text-success" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{money(stats.totalCollected)}</p>
            <p className="text-xs text-muted-foreground">
              {stats.collectionsChangePct == null
                ? t("dashboard.vsLastMonthNone")
                : t("dashboard.vsLastMonth", { pct: `${stats.collectionsChangePct >= 0 ? "+" : ""}${stats.collectionsChangePct}` })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("dashboard.totalOutflows")}</CardTitle>
            <TrendingDown className="h-5 w-5 text-destructive" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{money(stats.outflows)}</p>
            <p className="text-xs text-muted-foreground">
              {t("dashboard.outflowBreakdown", { expenses: money(stats.expenses), payroll: money(stats.payroll) })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("dashboard.netLiquidity")}</CardTitle>
            <Wallet className={`h-5 w-5 ${netPositive ? "text-success" : "text-destructive"}`} />
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${netPositive ? "text-success" : "text-destructive"}`}>
              {money(stats.netCashFlow)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("dashboard.totalStudents")}</CardTitle>
            <GraduationCap className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.totalStudents}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("dashboard.totalTeachers")}</CardTitle>
            <Users className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.totalTeachers}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-3">
          <CardHeader><CardTitle>{t("dashboard.recentActivity")}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("dashboard.type")}</TableHead>
                  <TableHead>{t("dashboard.subject")}</TableHead>
                  <TableHead className="text-right">{t("dashboard.amount")}</TableHead>
                  <TableHead>{t("dashboard.method")}</TableHead>
                  <TableHead>{t("dashboard.date")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.recentActivity.map((a, i) => (
                  <TableRow key={`${a.type}-${i}`}>
                    <TableCell>
                      {a.type === "COLLECTION" && <Badge variant="success">COLLECTION</Badge>}
                      {a.type === "EXPENSE" && <Badge variant="destructive">EXPENSE</Badge>}
                      {a.type === "PAYROLL" && <Badge variant="info">PAYROLL</Badge>}
                    </TableCell>
                    <TableCell className="font-medium">{a.title}</TableCell>
                    <TableCell className={`text-right font-medium ${a.amount < 0 ? "text-destructive" : "text-success"}`}>
                      {money(a.amount)}
                    </TableCell>
                    <TableCell><Badge variant="outline">{a.method}</Badge></TableCell>
                    <TableCell className="whitespace-nowrap">{fmtAt(a.at, locale)}</TableCell>
                  </TableRow>
                ))}
                {stats.recentActivity.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">{t("dashboard.noActivity")}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>{t("dashboard.positionsCard")}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("dashboard.positionRole")}</TableHead>
                  <TableHead className="text-right">{t("dashboard.baseSalary")}</TableHead>
                  <TableHead className="text-right">{t("dashboard.staffCount")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {positions.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.title}</TableCell>
                    <TableCell className="text-right">{money(p.baseSalary, p.currencyCode)}</TableCell>
                    <TableCell className="text-right">{p.staffCount}</TableCell>
                  </TableRow>
                ))}
                {positions.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">{t("dashboard.noPositions")}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
            <div className="p-4">
              <Button variant="outline" size="sm" className="w-full" onClick={() => router.push("/payroll?tab=positions")}>
                {t("dashboard.managePositions")} <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
