"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem,
} from "@/components/ui/select";
import { financialApiFetch, ApiError } from "@/lib/api/client";
import type { DeductionValueType, DiscountRuleCategory, SiblingRelationType } from "@/lib/api/types";

interface RuleTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function RuleTemplateDialog({ open, onOpenChange, onSaved }: RuleTemplateDialogProps) {
  const [category, setCategory] = useState<DiscountRuleCategory>("SIBLING");
  const [name, setName] = useState("");
  const [relationType, setRelationType] = useState<SiblingRelationType>("SISTERS_AND_BROTHERS");
  const [minSiblingCount, setMinSiblingCount] = useState("2");
  const [valueType, setValueType] = useState<DeductionValueType>("PERCENTAGE");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setCategory("SIBLING"); setName(""); setValue("");
    setRelationType("SISTERS_AND_BROTHERS"); setMinSiblingCount("2");
    setValueType("PERCENTAGE"); setSaving(false); setError("");
  }, [open ]);

  const numeric = parseFloat(value);
  const canSave =
    name.trim() !== "" &&
    value.trim() !== "" &&
    !Number.isNaN(numeric) &&
    numeric >= 0 &&
    !(valueType === "PERCENTAGE" && numeric > 100) &&
    (category !== "SIBLING" || (minSiblingCount.trim() !== "" && Number.isInteger(Number(minSiblingCount)) && Number(minSiblingCount) >= 2)) &&
    !saving;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true); setError("");
    try {
      if (category === "SIBLING") {
        await financialApiFetch("/finance/sibling-discount-rules", {
          method: "POST",
          body: JSON.stringify({
            name: name.trim(),
            relationType,
            minSiblingCount: parseInt(minSiblingCount, 10),
            valueType,
            value: parseFloat(value),
          }),
        });
      } else if (category === "TOPPER") {
        await financialApiFetch("/finance/discounts/topper-rules", {
          method: "POST",
          body: JSON.stringify({ name: name.trim(), valueType, value: parseFloat(value) }),
        });
      } else {
        await financialApiFetch("/finance/discounts/types", {
          method: "POST",
          body: JSON.stringify({ name: name.trim(), kind: valueType === "PERCENTAGE" ? "percentage" : "fixed" }),
        });
      }
      onSaved();
      onOpenChange(false);
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Could not create the rule template.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Create Rule Template</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-4">
          {error && <p className="text-destructive text-sm" role="alert">{error}</p>}

          <div className="flex flex-col gap-2">
            <Label htmlFor="rt-category">Category</Label>
            <Select value={category} onValueChange={(v) => { if (v) setCategory(v as DiscountRuleCategory); }}>
              <SelectTrigger id="rt-category" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="SIBLING">Sibling / Family</SelectItem>
                  <SelectItem value="TOPPER">Class Topper</SelectItem>
                  <SelectItem value="MANUAL">Manual template</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="rt-name">Name</Label>
            <Input
              id="rt-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={category === "TOPPER" ? "Topper 10%" : "Rule name"}
            />
          </div>

          {category === "SIBLING" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="rt-rel">Relation</Label>
                <Select value={relationType} onValueChange={(v) => { if (v) setRelationType(v as SiblingRelationType); }}>
                  <SelectTrigger id="rt-rel" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="SISTERS">Sisters</SelectItem>
                      <SelectItem value="BROTHERS">Brothers</SelectItem>
                      <SelectItem value="SISTERS_AND_BROTHERS">Sisters &amp; Brothers</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="rt-min">Minimum siblings</Label>
                <Input id="rt-min" type="number" min={2} value={minSiblingCount} onChange={(e) => setMinSiblingCount(e.target.value)} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="rt-vt">Type</Label>
              <Select value={valueType} onValueChange={(v) => { if (v) setValueType(v as DeductionValueType); }}>
                <SelectTrigger id="rt-vt" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="PERCENTAGE">Percentage</SelectItem>
                    <SelectItem value="FIXED_AMOUNT">Fixed amount</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="rt-val">Value</Label>
              <Input id="rt-val" type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} />
            </div>
          </div>

          {category === "TOPPER" && (
            <p className="text-xs text-muted-foreground">
              Applies to the rank-1 student of every class, computed from the most recently published exam.
              Percentage is taken off the annual fee total.
            </p>
          )}

          <Button onClick={handleSave} disabled={!canSave}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
