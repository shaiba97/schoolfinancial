"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCurrency } from "@/components/portal/currency-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { AssignDiscountModal } from "@/components/finance/assign-discount-modal";
import { SiblingGroupsDialog } from "@/components/finance/sibling-groups-dialog";
import { RuleTemplateDialog } from "@/components/finance/rule-template-dialog";
import { financialApiFetch, ApiError } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/locale-provider";
import type { MessageKey } from "@/lib/i18n/locale-provider";
import type {
  AssignedDiscountRow, AssignedDiscountCategory, AssignedDiscountStatus,
  DiscountRuleRow, DiscountRuleCategory, TopperComputeResult,
} from "@/lib/api/types";
import { Plus, Trash2 } from "lucide-react";

const CATEGORY_KEYS: Record<AssignedDiscountCategory | DiscountRuleCategory, MessageKey> = {
  SIBLING: "discounts.catSibling",
  TOPPER: "discounts.catTopper",
  SPECIAL_DISCRETION: "discounts.catSpecial",
  MANUAL: "discounts.catManual",
};

const CATEGORY_TINT: Record<AssignedDiscountCategory | DiscountRuleCategory, string> = {
  SIBLING: "border-transparent bg-info-surface text-info",
  TOPPER: "border-transparent bg-secondary text-secondary-foreground",
  SPECIAL_DISCRETION: "border-transparent bg-warning-surface text-warning",
  MANUAL: "",
};

function CategoryBadge({ category }: { category: AssignedDiscountCategory | DiscountRuleCategory }) {
  const { t } = useI18n();
  return (
    <Badge variant="outline" className={CATEGORY_TINT[category]}>
      {t(CATEGORY_KEYS[category])}
    </Badge>
  );
}

function AssignedStatusBadge({ status }: { status: AssignedDiscountStatus }) {
  const { t } = useI18n();
  if (status === "pending") return <Badge variant="secondary">{t("discounts.statusPending")}</Badge>;
  if (status === "expired") return <Badge variant="outline">{t("discounts.statusExpired")}</Badge>;
  if (status === "rejected") return <Badge variant="destructive">{t("discounts.statusRevoked")}</Badge>;
  return <Badge>{t("discounts.statusActive")}</Badge>;
}

export default function DiscountsPage() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t("discounts.title")}</h1>
      <Suspense fallback={<div className="flex flex-col gap-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>}>
        <DiscountsTabs />
      </Suspense>
    </div>
  );
}

function DiscountsTabs() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [tab, setTab] = useState(searchParams.get("tab") === "rules" ? "rules" : "assigned");

  // Keep the tab in sync with back/forward navigation.
  useEffect(() => {
    setTab(searchParams.get("tab") === "rules" ? "rules" : "assigned");
  }, [searchParams]);

  function change(v: string) {
    setTab(v);
    router.replace(`/discounts?tab=${v}`, { scroll: false });
  }

  return (
    <Tabs value={tab} onValueChange={change} className="flex flex-col gap-4">
      <TabsList>
        <TabsTrigger value="assigned">{t("discounts.tabAssigned")}</TabsTrigger>
        <TabsTrigger value="rules">{t("discounts.tabRules")}</TabsTrigger>
      </TabsList>
      <TabsContent value="assigned"><AssignedDiscountsTab /></TabsContent>
      <TabsContent value="rules"><DiscountRulesTab /></TabsContent>
    </Tabs>
  );
}

function AssignedDiscountsTab() {
  const { money } = useCurrency();
  const { t } = useI18n();
  const [rows, setRows] = useState<AssignedDiscountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const [acting, setActing] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await financialApiFetch<AssignedDiscountRow[]>("/finance/discounts/assigned");
      setRows(Array.isArray(data) ? data : []);
      setError("");
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function act(row: AssignedDiscountRow, action: "approve" | "reject") {
    const base = row.source === "FAMILY_CONDITION"
      ? `/finance/family-condition-discounts/${row.id}`
      : `/finance/student-discounts/${row.id}`;
    setActing(`${action}:${row.id}`);
    try {
      await financialApiFetch(`${base}/${action}`, { method: "POST", body: "{}" });
      await load();
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
    } finally {
      setActing("");
    }
  }

  if (loading) return <div className="flex flex-col gap-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t("discounts.tabAssigned")}</CardTitle>
        <Button size="sm" onClick={() => setAssignOpen(true)}>
          <Plus className="size-4 mr-1" />{t("discounts.assignButton")}
        </Button>
      </CardHeader>
      <CardContent>
        {error && <p className="text-destructive text-sm mb-3" role="alert">{error}</p>}
        {rows.length === 0 ? (
          <div className="text-center py-12"><p className="text-sm text-muted-foreground">{t("discounts.noneAssigned")}</p></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("discounts.colStudentGrade")}</TableHead>
                <TableHead>{t("discounts.colCategory")}</TableHead>
                <TableHead>{t("discounts.colValue")}</TableHead>
                <TableHead>{t("discounts.colNotes")}</TableHead>
                <TableHead>{t("discounts.colAcademicYear")}</TableHead>
                <TableHead>{t("discounts.colStatus")}</TableHead>
                <TableHead className="text-right">{t("discounts.colActions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={`${r.source}:${r.id}`}>
                  <TableCell>
                    <div className="font-medium">{r.studentName}</div>
                    {r.grade && <div className="text-xs text-muted-foreground">{r.grade}</div>}
                  </TableCell>
                  <TableCell><CategoryBadge category={r.category} /></TableCell>
                  <TableCell className="tabular-nums">
                    {r.valueType === "PERCENTAGE" ? `${r.value}%` : money(r.value)}
                  </TableCell>
                  <TableCell>
                    {r.notes ? (
                      <Popover>
                        <PopoverTrigger
                          render={
                            <button
                              type="button"
                              className="max-w-56 truncate text-left text-sm text-muted-foreground underline decoration-dotted underline-offset-4"
                            />
                          }
                        >
                          {r.notes}
                        </PopoverTrigger>
                        <PopoverContent className="max-w-80 text-sm" align="start">
                          {r.notes}
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {r.academicYear
                      ? <Badge variant="outline">{r.academicYear}</Badge>
                      : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell><AssignedStatusBadge status={r.status} /></TableCell>
                  <TableCell className="text-right">
                    {r.actions.includes("approve") && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={acting !== ""}
                        onClick={() => act(r, "approve")}
                      >
                        {acting === `approve:${r.id}` ? t("discounts.approving") : t("discounts.approve")}
                      </Button>
                    )}
                    {r.actions.includes("reject") && (
                      <Button
                        size="sm"
                        variant="destructive"
                        className="ml-2"
                        disabled={acting !== ""}
                        onClick={() => act(r, "reject")}
                      >
                        {acting === `reject:${r.id}` ? t("discounts.rejecting") : t("discounts.reject")}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <AssignDiscountModal open={assignOpen} onOpenChange={setAssignOpen} onAssigned={load} />
    </Card>
  );
}

function DiscountRulesTab() {
  const { money } = useCurrency();
  const { t } = useI18n();
  const [rules, setRules] = useState<DiscountRuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [templateOpen, setTemplateOpen] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [computing, setComputing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await financialApiFetch<DiscountRuleRow[]>("/finance/discounts/rules");
      setRules(Array.isArray(data) ? data : []);
      setError("");
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function remove(row: DiscountRuleRow) {
    if (!confirm(t("discounts.confirmDelete", { name: row.name }))) return;
    const path = row.source === "SIBLING_RULE"
      ? `/finance/sibling-discount-rules/${row.id}`
      : `/finance/discounts/topper-rules/${row.id}`;
    try {
      await financialApiFetch(path, { method: "DELETE" });
      await load();
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
    }
  }

  async function toggleTopper(row: DiscountRuleRow) {
    try {
      await financialApiFetch(`/finance/discounts/topper-rules/${row.id}`, {
        method: "PUT",
        body: JSON.stringify({ isActive: !row.isActive }),
      });
      await load();
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
    }
  }

  async function runCompute() {
    setComputing(true);
    setNotice("");
    try {
      const res = await financialApiFetch<TopperComputeResult>(
        "/finance/discounts/topper-rules/compute",
        { method: "POST" },
      );
      setNotice(t("discounts.computeNotice", { exam: res.examName, awarded: String(res.awarded), skipped: String(res.skipped) }));
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
    } finally {
      setComputing(false);
    }
  }

  if (loading) return <div className="flex flex-col gap-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t("discounts.tabRules")}</CardTitle>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setGroupsOpen(true)}>{t("discounts.groupsButton")}</Button>
          <Button size="sm" variant="outline" onClick={runCompute} disabled={computing}>
            {computing ? t("discounts.computing") : t("discounts.computeButton")}
          </Button>
          <Button size="sm" onClick={() => setTemplateOpen(true)}>
            <Plus className="size-4 mr-1" />{t("discounts.templateButton")}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && <p className="text-destructive text-sm mb-3" role="alert">{error}</p>}
        {notice && <p className="text-sm mb-3">{notice}</p>}
        {rules.length === 0 ? (
          <div className="text-center py-12"><p className="text-sm text-muted-foreground">{t("discounts.noneRules")}</p></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("discounts.colRuleName")}</TableHead>
                <TableHead>{t("discounts.colCategory")}</TableHead>
                <TableHead>{t("discounts.colValueType")}</TableHead>
                <TableHead>{t("discounts.colValue")}</TableHead>
                <TableHead>{t("discounts.colDescription")}</TableHead>
                <TableHead className="text-right">{t("discounts.colActions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((r) => (
                <TableRow key={`${r.source}:${r.id}`}>
                  <TableCell className="font-medium">
                    {r.name}
                    {!r.isActive && <Badge variant="secondary" className="ml-2">{t("discounts.statusInactive")}</Badge>}
                  </TableCell>
                  <TableCell><CategoryBadge category={r.category} /></TableCell>
                  <TableCell>
                    {r.valueType
                      ? <Badge variant="outline">{r.valueType === "PERCENTAGE" ? t("discounts.typePercentage") : t("discounts.typeFixed")}</Badge>
                      : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {r.valueType == null || r.value == null
                      ? <span className="text-muted-foreground">—</span>
                      : r.valueType === "PERCENTAGE" ? `${r.value}%` : money(r.value)}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-56 truncate">
                    {r.description ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.source === "TOPPER_RULE" && (
                      <Button variant="ghost" size="sm" onClick={() => toggleTopper(r)}>
                        <Badge variant={r.isActive ? "default" : "secondary"}>
                          {r.isActive ? t("discounts.statusActive") : t("discounts.statusInactive")}
                        </Badge>
                      </Button>
                    )}
                    {r.source !== "DISCOUNT_TYPE" && (
                      <Button variant="ghost" size="icon" aria-label={t("discounts.deleteAria", { name: r.name })} onClick={() => remove(r)}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <RuleTemplateDialog open={templateOpen} onOpenChange={setTemplateOpen} onSaved={load} />
      <SiblingGroupsDialog open={groupsOpen} onOpenChange={setGroupsOpen} />
    </Card>
  );
}
