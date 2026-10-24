"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCurrency } from "@/components/portal/currency-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Search, Plus, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { financialApiFetch, ApiError } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/locale-provider";
import { formatDate } from "@/lib/utils";
import type {
  PayrollRegisterRow, Position, ShortageRates, DeductionRule, DeductionValueType,
} from "@/lib/api/types";
import { ConfirmSalaryModal } from "@/components/finance/confirm-salary-modal";
import { AssignPositionSalaryModal } from "@/components/finance/assign-position-salary-modal";

const VALID_TABS = ["disbursements", "positions", "deductions"] as const;

export default function PayrollPage() {
  return (
    <Suspense fallback={<div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>}>
      <PayrollContent />
    </Suspense>
  );
}

function PayrollContent() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const param = searchParams.get("tab");
  const paramTab = param && (VALID_TABS as readonly string[]).includes(param) ? param : "disbursements";
  const [tab, setTab] = useState(paramTab);

  useEffect(() => {
    const p = searchParams.get("tab");
    setTab(p && (VALID_TABS as readonly string[]).includes(p) ? p : "disbursements");
  }, [searchParams]);

  function changeTab(v: string | null) {
    if (!v) return;
    setTab(v);
    router.replace(`/payroll?tab=${v}`);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("payroll.title")}</h1>
      <Tabs value={tab} onValueChange={(v) => { if (v) changeTab(v); }} className="space-y-4">
        <TabsList>
          <TabsTrigger value="disbursements">{t("payroll.tabRegister")}</TabsTrigger>
          <TabsTrigger value="positions">{t("payroll.tabPositions")}</TabsTrigger>
          <TabsTrigger value="deductions">{t("payroll.tabDeductions")}</TabsTrigger>
        </TabsList>
        <TabsContent value="disbursements"><DisbursementsTab /></TabsContent>
        <TabsContent value="positions"><PositionsTab /></TabsContent>
        <TabsContent value="deductions"><DeductionsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

const ErrorBlock = ({ message, onRetry }: { message: string; onRetry?: () => void }) => {
  const { t } = useI18n();
  return (
    <div className="text-center py-12 space-y-3">
      <p className="text-destructive text-sm">{message}</p>
      {onRetry && <Button variant="outline" size="sm" onClick={onRetry}>{t("common.retry")}</Button>}
    </div>
  );
};

function fmtDate(iso: string | null, locale: string): string {
  if (!iso) return "-";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-u-nu-latn" : "en-GB", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "UTC",
  }).format(d);
}

function DisbursementsTab() {
  const { money } = useCurrency();
  const { t, locale } = useI18n();
  const [rows, setRows] = useState<PayrollRegisterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [paying, setPaying] = useState<PayrollRegisterRow | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await financialApiFetch<PayrollRegisterRow[]>("/finance/payroll/register");
      setRows(Array.isArray(data) ? data : []);
      setError("");
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const roles = useMemo(() => [...new Set(rows.map((r) => r.roleLabel))].sort(), [rows]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (search && !`${r.name} ${r.staffNumber}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (role !== "all" && r.roleLabel !== role) return false;
    if (status !== "all" && r.status !== status) return false;
    return true;
  }), [rows, search, role, status]);

  const total = rows.reduce((s, r) => s + r.netPay, 0);
  const paid = rows.filter((r) => r.status === "paid").reduce((s, r) => s + r.netPay, 0);
  const cycle = rows[0]?.cycleLabel ?? "";

  if (loading) return <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  if (error) return <ErrorBlock message={error} onRetry={load} />;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">{cycle ? t("payroll.totalMonthly") + t("payroll.cycleSuffix", { cycle }) : t("payroll.totalMonthly")}</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{money(total)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">{t("payroll.paidThisMonth")}</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold text-success">{money(paid)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">{t("payroll.pendingPayouts")}</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold text-warning">{money(total - paid)}</CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder={t("payroll.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={role} onValueChange={(v) => { if (v) setRole(v); }}>
          <SelectTrigger className="w-44"><SelectValue placeholder={t("payroll.role")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("payroll.allRoles")}</SelectItem>
            {roles.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => { if (v) setStatus(v); }}>
          <SelectTrigger className="w-36"><SelectValue placeholder={t("payroll.status")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("payroll.allStatuses")}</SelectItem>
            <SelectItem value="pending">{t("payroll.statusPending")}</SelectItem>
            <SelectItem value="paid">{t("payroll.statusPaid")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("payroll.colStaffMember")}</TableHead>
                <TableHead>{t("payroll.colBaseSalary")}</TableHead>
                <TableHead>{t("payroll.colDeductions")}</TableHead>
                <TableHead>{t("payroll.colNetPayable")}</TableHead>
                <TableHead>{t("payroll.colLastPaid")}</TableHead>
                <TableHead>{t("payroll.colNextEligible")}</TableHead>
                <TableHead>{t("payroll.colAction")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.userId}>
                  <TableCell>
                    <p className="font-medium">{r.name}</p>
                    <Badge variant="secondary" className="mt-1">{r.roleLabel}</Badge>
                  </TableCell>
                  <TableCell>
                    {r.baseSalary > 0 ? (
                      money(r.baseSalary, r.currencyCode)
                    ) : (
                      <span className="text-warning text-sm">{t("payroll.setSalaryHint")}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {r.deductionAmount > 0 ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <span className="text-destructive cursor-help">
                                -{money(r.deductionAmount, r.currencyCode)}
                              </span>
                            }
                          />
                          <TooltipContent>
                            {r.absentDays > 0 && <p>{t(r.absentDays === 1 ? "payroll.absentDaysOne" : "payroll.absentDaysMany", { n: String(r.absentDays) })}</p>}
                            {r.lateDays > 0 && <p>{t(r.lateDays === 1 ? "payroll.lateDaysOne" : "payroll.lateDaysMany", { n: String(r.lateDays) })}</p>}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="font-bold">{money(r.netPay, r.currencyCode)}</TableCell>
                  <TableCell>{fmtDate(r.lastPaidAt, locale)}</TableCell>
                  <TableCell>{fmtDate(r.nextEligibleDate, locale)}</TableCell>
                  <TableCell>
                    {r.status === "paid" ? (
                      <Badge variant="success">{r.cycleLabel ? t("payroll.paidBadge") + t("payroll.cycleSuffix", { cycle: r.cycleLabel }) : t("payroll.paidBadge")}</Badge>
                    ) : (
                      <Button
                        size="sm"
                        disabled={!r.payable}
                        title={r.payable ? undefined : t("payroll.setSalaryHint")}
                        onClick={() => setPaying(r)}
                      >
                        {t("payroll.paySalary")}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">{t("payroll.noStaff")}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ConfirmSalaryModal row={paying} onClose={() => setPaying(null)} onPaid={load} />
    </div>
  );
}

function PositionsTab() {
  const { money } = useCurrency();
  const { t } = useI18n();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Position | null>(null);
  const [resetting, setResetting] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await financialApiFetch<Position[]>("/finance/positions");
      setPositions(Array.isArray(data) ? data : []);
      setError("");
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function resetSalary(p: Position) {
    setResetting(p.id);
    try {
      await financialApiFetch(`/finance/positions/${p.id}`, {
        method: "PUT",
        body: JSON.stringify({ baseSalary: 0 }),
      });
      await load();
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
    } finally {
      setResetting(null);
    }
  }

  if (loading) return <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  if (error && positions.length === 0) return <ErrorBlock message={error} onRetry={load} />;

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> {t("payroll.setPositionSalary")}
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("payroll.colPositionTitle")}</TableHead>
                <TableHead>{t("payroll.colAssignedBase")}</TableHead>
                <TableHead>{t("payroll.colStaffCount")}</TableHead>
                <TableHead>{t("payroll.colActions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {positions.filter((p) => p.isActive).map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.title}</TableCell>
                  <TableCell>{money(p.baseSalary, p.currencyCode)}</TableCell>
                  <TableCell>{p.staffCount}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => { setEditing(p); setModalOpen(true); }}>
                        <Pencil className="h-3 w-3 mr-1" /> {t("payroll.editSalary")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={resetting === p.id || p.baseSalary === 0}
                        onClick={() => resetSalary(p)}
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        {resetting === p.id ? t("payroll.resetting") : t("payroll.reset")}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {positions.filter((p) => p.isActive).length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">{t("payroll.noPositions")}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <AssignPositionSalaryModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSaved={load}
        positions={positions}
        initial={editing}
      />
    </div>
  );
}

function DeductionsTab() {
  const { money } = useCurrency();
  const { t } = useI18n();
  const [rules, setRules] = useState<DeductionRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [valueType, setValueType] = useState<DeductionValueType>("FIXED_AMOUNT");
  const [value, setValue] = useState("");
  const [rateDraft, setRateDraft] = useState({ absentDaily: "0", lateRate: "0" });
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [rl, rt] = await Promise.all([
        financialApiFetch<DeductionRule[]>("/finance/deduction-rules"),
        financialApiFetch<ShortageRates>("/finance/payroll/shortage-rates"),
      ]);
      setRules(Array.isArray(rl) ? rl : []);
      setRateDraft({ absentDaily: String(rt.absentDaily), lateRate: String(rt.lateRate) });
      setError("");
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createRule() {
    const v = Number(value);
    if (name.trim() === "" || !Number.isFinite(v) || v < 0) return;
    if (valueType === "PERCENTAGE" && v > 100) return;
    setSaving("new");
    try {
      await financialApiFetch("/finance/deduction-rules", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), valueType, value: v }),
      });
      setName(""); setValue("");
      await load();
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
    } finally {
      setSaving(null);
    }
  }

  async function toggleRule(r: DeductionRule) {
    setSaving(r.id);
    try {
      await financialApiFetch(`/finance/deduction-rules/${r.id}`, {
        method: "PUT",
        body: JSON.stringify({ isActive: !r.isActive }),
      });
      await load();
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
    } finally {
      setSaving(null);
    }
  }

  async function deleteRule(r: DeductionRule) {
    setSaving(r.id);
    try {
      await financialApiFetch(`/finance/deduction-rules/${r.id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
    } finally {
      setSaving(null);
    }
  }

  async function saveRates() {
    const absentDaily = Number(rateDraft.absentDaily);
    const lateRate = Number(rateDraft.lateRate);
    if (!Number.isFinite(absentDaily) || absentDaily < 0 || !Number.isFinite(lateRate) || lateRate < 0) return;
    setSaving("rates");
    try {
      const rt = await financialApiFetch<ShortageRates>("/finance/payroll/shortage-rates", {
        method: "PUT",
        body: JSON.stringify({ absentDaily, lateRate }),
      });
      setRateDraft({ absentDaily: String(rt.absentDaily), lateRate: String(rt.lateRate) });
      setError("");
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
    } finally {
      setSaving(null);
    }
  }

  if (loading) return <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  if (error && rules.length === 0) return <ErrorBlock message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader><CardTitle>{t("payroll.deductionsCard")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-2">
              <Label htmlFor="rule-name">{t("payroll.ruleName")}</Label>
              <Input id="rule-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("payroll.rulePlaceholder")} className="w-52" />
            </div>
            <div className="space-y-2">
              <Label>{t("payroll.type")}</Label>
              <Select value={valueType} onValueChange={(v) => { if (v) setValueType(v as DeductionValueType); }}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FIXED_AMOUNT">{t("payroll.typeFixed")}</SelectItem>
                  <SelectItem value="PERCENTAGE">{t("payroll.typePercentage")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rule-value">{t("payroll.value")}</Label>
              <Input id="rule-value" type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} placeholder="0" className="w-32" />
            </div>
            <Button onClick={createRule} disabled={saving === "new"}>
              <Plus className="h-4 w-4 mr-1" /> {saving === "new" ? t("payroll.adding") : t("payroll.addRule")}
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("payroll.colName")}</TableHead>
                <TableHead>{t("payroll.colType")}</TableHead>
                <TableHead>{t("payroll.colValue")}</TableHead>
                <TableHead>{t("payroll.colStatus")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.valueType === "PERCENTAGE" ? t("payroll.typePercentage") : t("payroll.typeFixed")}</TableCell>
                  <TableCell>{r.valueType === "PERCENTAGE" ? `${r.value}%` : money(r.value)}</TableCell>
                  <TableCell>
                    <Badge variant={r.isActive ? "default" : "secondary"}>{r.isActive ? t("discounts.statusActive") : t("discounts.statusInactive")}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" disabled={saving === r.id} onClick={() => toggleRule(r)}>
                        {r.isActive ? t("payroll.deactivate") : t("payroll.activate")}
                      </Button>
                      <Button size="sm" variant="ghost" disabled={saving === r.id} onClick={() => deleteRule(r)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {rules.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">{t("payroll.noRules")}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("payroll.shortageCard")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rate-absent">{t("payroll.absentPenalty")}</Label>
              <Input
                id="rate-absent"
                type="number"
                min={0}
                value={rateDraft.absentDaily}
                onChange={(e) => setRateDraft((d) => ({ ...d, absentDaily: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">{t("payroll.absentPenaltyNote")}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rate-late">{t("payroll.latePenalty")}</Label>
              <Input
                id="rate-late"
                type="number"
                min={0}
                value={rateDraft.lateRate}
                onChange={(e) => setRateDraft((d) => ({ ...d, lateRate: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">{t("payroll.latePenaltyNote")}</p>
            </div>
          </div>
          <Button onClick={saveRates} disabled={saving === "rates"}>
            {saving === "rates" ? t("common.saving") : t("payroll.saveShortage")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
