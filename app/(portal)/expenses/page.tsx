"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem,
} from "@/components/ui/select";
import { financialApiFetch, ApiError } from "@/lib/api/client";
import type { Expense, ExpenseCategoryKey } from "@/lib/api/types";
import { CreateExpenseModal, EXPENSE_CATEGORY_LABEL, categoryKeyForName } from "@/components/finance/create-expense-modal";
import { Pencil, Plus, Trash2 } from "lucide-react";

const CATEGORY_KEYS = Object.keys(EXPENSE_CATEGORY_LABEL) as ExpenseCategoryKey[];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "-"
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function ExpenseStatusBadge({ status }: { status: Expense["status"] }) {
  if (status === "pending") {
    return (
      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
        Pending
      </Badge>
    );
  }
  if (status === "rejected") return <Badge variant="destructive">Rejected</Badge>;
  if (status === "paid") return <Badge>Paid</Badge>;
  return <Badge>Approved</Badge>;
}

export default function ExpensesPage() {
  return (
    <Suspense fallback={<div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>}>
      <ExpensesContent />
    </Suspense>
  );
}

function ExpensesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramTab = searchParams.get("tab") === "approvals" ? "approvals" : "all";
  const [tab, setTab] = useState(paramTab);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setTab(searchParams.get("tab") === "approvals" ? "approvals" : "all");
  }, [searchParams]);

  function changeTab(v: string) {
    if (!v) return;
    setTab(v);
    router.replace(`/expenses?tab=${v}`);
  }

  const load = useCallback(async () => {
    try {
      const data = await financialApiFetch<Expense[]>("/finance/expenses");
      setExpenses(Array.isArray(data) ? data : []);
      setError("");
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const pendingCount = useMemo(() => expenses.filter((e) => e.status === "pending").length, [expenses]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Expenses</h1>
      {error && <p className="text-destructive text-sm" role="alert">{error}</p>}
      <Tabs value={tab} onValueChange={(v) => { if (v) changeTab(v); }} className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Expenses</TabsTrigger>
          <TabsTrigger value="approvals">
            Approval Queue{pendingCount > 0 ? ` (${pendingCount})` : ""}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="all">
          {loading
            ? <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            : <AllExpensesTab expenses={expenses} onChanged={load} />}
        </TabsContent>
        <TabsContent value="approvals">
          {loading
            ? <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            : <ApprovalQueueTab expenses={expenses} onChanged={load} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AllExpensesTab({ expenses, onChanged }: { expenses: Expense[]; onChanged: () => Promise<void> }) {
  const { money } = useCurrency();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState<Expense | null>(null);
  const [actionError, setActionError] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return expenses.filter((e) => {
      if (category !== "ALL" && categoryKeyForName(e.categoryName) !== category) return false;
      if (!term) return true;
      return (
        e.title.toLowerCase().includes(term) ||
        e.vendor.toLowerCase().includes(term) ||
        e.categoryName.toLowerCase().includes(term)
      );
    });
  }, [expenses, search, category]);

  async function confirmDelete() {
    if (!deleting) return;
    setActionError("");
    try {
      await financialApiFetch(`/finance/expenses/${deleting.id}`, { method: "DELETE" });
      setDeleting(null);
      await onChanged();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "Could not delete the expense.");
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center gap-3 justify-between">
        <CardTitle>All Expenses</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, payee, category…"
            className="w-56"
          />
          <Select value={category} onValueChange={(v) => { if (v) setCategory(v); }}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="ALL">All categories</SelectItem>
                {CATEGORY_KEYS.map((c) => (
                  <SelectItem key={c} value={c}>{EXPENSE_CATEGORY_LABEL[c]}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" />Record Expense
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {actionError && <p className="text-destructive text-sm mb-3" role="alert">{actionError}</p>}
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">
              {expenses.length === 0 ? "No expenses recorded" : "No expenses match the current filters"}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Expense Title &amp; Payee</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Expense Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((exp) => (
                <TableRow key={exp.id}>
                  <TableCell>
                    <div className="font-medium">{exp.title || "—"}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-xs">{exp.vendor || "—"}</div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{exp.categoryName}</Badge></TableCell>
                  <TableCell className="tabular-nums">{money(exp.amount, exp.currencyCode)}</TableCell>
                  <TableCell>{formatDate(exp.incurredAt)}</TableCell>
                  <TableCell><ExpenseStatusBadge status={exp.status} /></TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit ${exp.title}`}
                        disabled={exp.status !== "pending"}
                        title={exp.status !== "pending" ? "Only pending expenses can be edited" : "Edit"}
                        onClick={() => { setEditing(exp); setModalOpen(true); }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${exp.title}`}
                        disabled={exp.status !== "pending"}
                        title={exp.status !== "pending" ? "Only pending expenses can be deleted" : "Delete"}
                        onClick={() => setDeleting(exp)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <CreateExpenseModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSaved={onChanged}
        initial={editing}
      />

      <AlertDialog open={!!deleting} onOpenChange={(open) => { if (!open) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this expense?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting ? `“${deleting.title}” (${deleting.vendor}) will be permanently removed.` : ""}
              {" "}Only pending expenses can be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function ApprovalQueueTab({ expenses, onChanged }: { expenses: Expense[]; onChanged: () => Promise<void> }) {
  const { money } = useCurrency();
  const [rejecting, setRejecting] = useState<Expense | null>(null);
  const [reason, setReason] = useState("");
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState("");

  const pending = useMemo(() => expenses.filter((e) => e.status === "pending"), [expenses]);

  async function approve(id: string) {
    setActionError("");
    try {
      await financialApiFetch(`/finance/expenses/${id}/approve`, { method: "POST", body: "{}" });
      await onChanged();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "Could not approve the expense.");
    }
  }

  async function confirmReject() {
    if (!rejecting || reason.trim() === "") return;
    setWorking(true); setActionError("");
    try {
      await financialApiFetch(`/finance/expenses/${rejecting.id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim() }),
      });
      setRejecting(null); setReason("");
      await onChanged();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "Could not reject the expense.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Approval Queue</CardTitle></CardHeader>
      <CardContent>
        {actionError && <p className="text-destructive text-sm mb-3" role="alert">{actionError}</p>}
        {pending.length === 0 ? (
          <div className="text-center py-12"><p className="text-sm text-muted-foreground">No pending approvals</p></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title / Reason</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Payee</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending.map((exp) => (
                <TableRow key={exp.id}>
                  <TableCell className="font-medium max-w-xs truncate">{exp.title || "—"}</TableCell>
                  <TableCell><Badge variant="outline">{exp.categoryName}</Badge></TableCell>
                  <TableCell className="text-muted-foreground max-w-xs truncate">{exp.vendor || "—"}</TableCell>
                  <TableCell>{formatDate(exp.incurredAt)}</TableCell>
                  <TableCell className="tabular-nums">{money(exp.amount, exp.currencyCode)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => approve(exp.id)}>Approve</Button>
                    <Button size="sm" variant="destructive" className="ml-2" onClick={() => { setRejecting(exp); setReason(""); }}>Reject</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={!!rejecting} onOpenChange={(open) => { if (!open) { setRejecting(null); setReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject expense{rejecting ? ` — ${rejecting.title}` : ""}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="reject-reason">Rejection reason (required)</Label>
            <Textarea
              id="reject-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this expense being rejected?"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejecting(null); setReason(""); }}>Cancel</Button>
            <Button variant="destructive" onClick={confirmReject} disabled={working || reason.trim() === ""}>
              {working ? "Rejecting..." : "Reject Expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
