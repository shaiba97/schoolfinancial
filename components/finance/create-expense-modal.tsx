"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from "@/components/ui/command";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem,
} from "@/components/ui/select";
import { financialApiFetch, ApiError } from "@/lib/api/client";
import type { Expense, ExpenseCategoryKey } from "@/lib/api/types";
import { ChevronsUpDown } from "lucide-react";

export const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategoryKey, string> = {
  MAINTENANCE: "Maintenance",
  SALARIES: "Salaries",
  UTILITIES: "Utilities",
  SUPPLIES: "Supplies",
  STUDENT_PAYOUT: "Student Payout / Fee Return",
  OTHER: "Other",
};

const CATEGORY_KEYS = Object.keys(EXPENSE_CATEGORY_LABEL) as ExpenseCategoryKey[];

/** Map a stored category name back to its key (case/punctuation-insensitive). */
export function categoryKeyForName(name: string): ExpenseCategoryKey {
  const norm = name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
  return (CATEGORY_KEYS as string[]).includes(norm) ? (norm as ExpenseCategoryKey) : "OTHER";
}

interface Candidate {
  id: string;
  name: string;
  displayLabel: string;
  roleNumber?: string;
}

interface CreateExpenseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  initial?: Expense | null;
}

const today = () => new Date().toISOString().slice(0, 10);

export function CreateExpenseModal({ open, onOpenChange, onSaved, initial }: CreateExpenseModalProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ExpenseCategoryKey>("MAINTENANCE");
  const [amount, setAmount] = useState("");
  const [vendor, setVendor] = useState("");
  const [date, setDate] = useState(today());
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? "");
    setCategory(initial ? categoryKeyForName(initial.categoryName) : "MAINTENANCE");
    setAmount(initial ? String(initial.amount) : "");
    setVendor(initial?.vendor ?? "");
    setDate(initial ? initial.incurredAt.slice(0, 10) : today());
    setQuery(""); setCandidates([]); setPickerOpen(false);
    setSaving(false); setError("");
  }, [open, initial]);

  function search(q: string) {
    if (debounce.current) clearTimeout(debounce.current);
    const term = q.trim();
    if (!term) { setCandidates([]); return; }
    debounce.current = setTimeout(async () => {
      try {
        const res = await financialApiFetch<{ data: Candidate[] }>(
          `/fees/students?q=${encodeURIComponent(term)}&pageSize=20`,
        );
        setCandidates(res.data ?? []);
      } catch {
        setCandidates([]);
      }
    }, 250);
  }

  const numeric = parseFloat(amount);
  const canSave =
    title.trim() !== "" &&
    !Number.isNaN(numeric) &&
    numeric > 0 &&
    date !== "" &&
    !saving;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true); setError("");
    try {
      const body = JSON.stringify({
        category: EXPENSE_CATEGORY_LABEL[category],
        amount: numeric,
        title: title.trim(),
        vendor: vendor.trim(),
        date,
      });
      if (initial) {
        await financialApiFetch(`/finance/expenses/${initial.id}`, { method: "PUT", body });
      } else {
        await financialApiFetch("/finance/expenses", { method: "POST", body });
      }
      onSaved();
      onOpenChange(false);
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Could not save the expense.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Expense" : "Record Expense"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {error && <p className="text-destructive text-sm" role="alert">{error}</p>}

          <div className="flex flex-col gap-2">
            <Label htmlFor="exp-title">Title / Description</Label>
            <Input
              id="exp-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Generator Fuel Purchase"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="exp-category">Category</Label>
              <Select value={category} onValueChange={(v) => { if (v) setCategory(v as ExpenseCategoryKey); }}>
                <SelectTrigger id="exp-category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {CATEGORY_KEYS.map((c) => (
                      <SelectItem key={c} value={c}>{EXPENSE_CATEGORY_LABEL[c]}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="exp-amount">Amount</Label>
              <Input
                id="exp-amount"
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="exp-vendor">Vendor / Payee Name</Label>
            <Input
              id="exp-vendor"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder="Nile Fuel Co."
            />
          </div>

          {category === "STUDENT_PAYOUT" && (
            <div className="flex flex-col gap-2">
              <Label>Pick student as payee (optional)</Label>
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-between font-normal"
                    />
                  }
                >
                  <span className="truncate text-muted-foreground">Type student name or roll number…</span>
                  <ChevronsUpDown />
                </PopoverTrigger>
                <PopoverContent className="w-[--anchor-width] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Type student name or roll number…"
                      value={query}
                      onValueChange={(v) => { setQuery(v); search(v); }}
                    />
                    <CommandList>
                      <CommandEmpty>
                        {query.trim() ? `No students found for “${query.trim()}”.` : "Type to search students."}
                      </CommandEmpty>
                      <CommandGroup>
                        {candidates.map((c) => (
                          <CommandItem
                            key={c.id}
                            value={c.id}
                            onSelect={() => {
                              setVendor(c.displayLabel);
                              setCandidates([]); setPickerOpen(false); setQuery("");
                            }}
                          >
                            <span className="min-w-0 flex-1 truncate">
                              {c.displayLabel}
                              {c.roleNumber && (
                                <span className="ml-2 text-xs text-muted-foreground tabular-nums">
                                  #{c.roleNumber}
                                </span>
                              )}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="exp-date">Expense Date</Label>
            <Input
              id="exp-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <Button onClick={handleSave} disabled={!canSave}>
            {saving ? "Saving..." : initial ? "Save Changes" : "Record Expense"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
