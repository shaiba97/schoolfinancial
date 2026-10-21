"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from "@/components/ui/command";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { financialApiFetch, ApiError } from "@/lib/api/client";
import type { AcademicYear, DeductionValueType, DiscountRuleRow } from "@/lib/api/types";
import { ChevronsUpDown } from "lucide-react";

type ModalCategory = "SIBLING" | "TOPPER" | "SPECIAL_DISCRETION";

interface Candidate {
  id: string;
  name: string;
  displayLabel: string;
  roleNumber?: string;
}

interface AssignDiscountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssigned: () => void;
}

const CATEGORY_LABEL: Record<ModalCategory, string> = {
  SIBLING: "Sibling / Family",
  TOPPER: "Class Topper",
  SPECIAL_DISCRETION: "Special Family Condition (Verbal Agreement)",
};

function templatesFor(category: ModalCategory, templates: DiscountRuleRow[]) {
  if (category === "SPECIAL_DISCRETION") return templates.filter((t) => t.category === "MANUAL");
  const want = category === "SIBLING" ? "SIBLING" : "TOPPER";
  return templates.filter((t) => t.category === want || t.category === "MANUAL");
}

export function AssignDiscountModal({ open, onOpenChange, onAssigned }: AssignDiscountModalProps) {
  const [studentId, setStudentId] = useState("");
  const [studentLabel, setStudentLabel] = useState("");
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [category, setCategory] = useState<ModalCategory>("SIBLING");
  const [templates, setTemplates] = useState<DiscountRuleRow[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [valueType, setValueType] = useState<DeductionValueType>("PERCENTAGE");
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [yearId, setYearId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    setStudentId(""); setStudentLabel(""); setQuery(""); setCandidates([]); setPickerOpen(false);
    setCategory("SIBLING"); setTemplateId(""); setValueType("PERCENTAGE");
    setValue(""); setNotes(""); setSaving(false); setError("");
    financialApiFetch<DiscountRuleRow[]>("/finance/discounts/rules")
      .then((list) => setTemplates(Array.isArray(list) ? list : []))
      .catch(() => setTemplates([]));
    financialApiFetch<AcademicYear[]>("/fees/academic-years")
      .then((list) => {
        const rows = Array.isArray(list) ? list : [];
        setYears(rows);
        setYearId(rows.find((y) => y.isCurrent)?.id ?? rows[0]?.id ?? "");
      })
      .catch(() => { setYears([]); setYearId(""); });
  }, [open ]);

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

  function pick(c: Candidate) {
    setStudentId(c.id);
    setStudentLabel(c.displayLabel);
    setCandidates([]); setPickerOpen(false); setQuery("");
    setError("");
  }

  function pickTemplate(id: string) {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (t?.valueType) setValueType(t.valueType);
    if (t?.value != null) setValue(String(t.value));
    setError("");
  }

  const numeric = parseFloat(value);
  const needsNotes = category === "SPECIAL_DISCRETION";
  const canSave =
    !!studentId &&
    value.trim() !== "" &&
    !Number.isNaN(numeric) &&
    numeric >= 0 &&
    !(valueType === "PERCENTAGE" && numeric > 100) &&
    (!needsNotes || notes.trim() !== "") &&
    !saving;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true); setError("");
    try {
      if (category === "SPECIAL_DISCRETION") {
        await financialApiFetch("/finance/family-condition-discounts", {
          method: "POST",
          body: JSON.stringify({ studentId, valueType, value: numeric, reason: notes.trim() }),
        });
      } else {
        const template = templates.find((x) => x.id === templateId);
        await financialApiFetch("/finance/discounts/assign", {
          method: "POST",
          body: JSON.stringify({
            studentId,
            category,
            valueType,
            value: numeric,
            ...(template ? { name: template.name } : {}),
          }),
        });
      }
      onAssigned();
      onOpenChange(false);
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Could not assign the discount.");
    } finally {
      setSaving(false);
    }
  }

  const visibleTemplates = templatesFor(category, templates);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Assign Student Discount</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-4">
          {error && <p className="text-destructive text-sm" role="alert">{error}</p>}

          <div className="flex flex-col gap-2">
            <Label htmlFor="assign-student">Student</Label>
            {studentId ? (
              <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span className="font-medium truncate">{studentLabel}</span>
                <Button type="button" size="sm" variant="ghost" onClick={() => { setStudentId(""); setStudentLabel(""); }}>
                  Change
                </Button>
              </div>
            ) : (
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger
                  render={
                    <Button
                      id="assign-student"
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
                          <CommandItem key={c.id} value={c.id} onSelect={() => pick(c)}>
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
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="assign-category">Category</Label>
            <Select value={category} onValueChange={(v) => { if (v) { setCategory(v as ModalCategory); setTemplateId(""); setError(""); } }}>
              <SelectTrigger id="assign-category" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {(Object.keys(CATEGORY_LABEL) as ModalCategory[]).map((c) => (
                    <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {visibleTemplates.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="assign-template">Rule template (optional)</Label>
                {templateId && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => setTemplateId("")}>
                    Clear
                  </Button>
                )}
              </div>
              <Select value={templateId} onValueChange={(v) => { if (v) pickTemplate(v); }}>
                <SelectTrigger id="assign-template" className="w-full">
                  <SelectValue placeholder="No template — enter manually" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {visibleTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}{t.valueType && t.value != null ? ` — ${t.valueType === "PERCENTAGE" ? `${t.value}%` : t.value}` : ""}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label>Value type</Label>
              <ToggleGroup
                value={[valueType]}
                onValueChange={(v) => { const last = v[v.length - 1]; if (last) setValueType(last as DeductionValueType); }}
                variant="outline"
              >
                <ToggleGroupItem value="PERCENTAGE">% Percentage</ToggleGroupItem>
                <ToggleGroupItem value="FIXED_AMOUNT">$ Fixed</ToggleGroupItem>
              </ToggleGroup>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="assign-value">Value</Label>
              <Input
                id="assign-value"
                type="number"
                min={0}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={valueType === "PERCENTAGE" ? "15" : "200"}
              />
            </div>
          </div>

          {needsNotes && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="assign-notes">Verbal agreement notes (required)</Label>
              <Textarea
                id="assign-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Concession approved by Principal during parent consultation on Oct 14"
              />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="assign-year">Academic Year</Label>
            <Select value={yearId} onValueChange={(v) => { if (v) setYearId(v); }}>
              <SelectTrigger id="assign-year" className="w-full">
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {years.map((y) => (
                    <SelectItem key={y.id} value={y.id}>
                      {y.name}{y.isCurrent ? " (active)" : ""}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Assignments apply to the active session.</p>
          </div>

          <Button onClick={handleSave} disabled={!canSave}>
            {saving ? "Assigning..." : "Assign Discount"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
