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
import { useI18n } from "@/lib/i18n/locale-provider";
import type { DeductionValueType, DiscountRuleCategory, SiblingRelationType } from "@/lib/api/types";

interface RuleTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function RuleTemplateDialog({ open, onOpenChange, onSaved }: RuleTemplateDialogProps) {
  const { t } = useI18n();
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
      else setError(t("ruleTpl.saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("ruleTpl.title")}</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-4">
          {error && <p className="text-destructive text-sm" role="alert">{error}</p>}

          <div className="flex flex-col gap-2">
            <Label htmlFor="rt-category">{t("ruleTpl.category")}</Label>
            <Select value={category} onValueChange={(v) => { if (v) setCategory(v as DiscountRuleCategory); }}>
              <SelectTrigger id="rt-category" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="SIBLING">{t("ruleTpl.catSibling")}</SelectItem>
                  <SelectItem value="TOPPER">{t("ruleTpl.catTopper")}</SelectItem>
                  <SelectItem value="MANUAL">{t("ruleTpl.catManual")}</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="rt-name">{t("ruleTpl.name")}</Label>
            <Input
              id="rt-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={category === "TOPPER" ? t("ruleTpl.nameTopperPlaceholder") : t("ruleTpl.namePlaceholder")}
            />
          </div>

          {category === "SIBLING" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="rt-rel">{t("ruleTpl.relation")}</Label>
                <Select value={relationType} onValueChange={(v) => { if (v) setRelationType(v as SiblingRelationType); }}>
                  <SelectTrigger id="rt-rel" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="SISTERS">{t("ruleTpl.relSisters")}</SelectItem>
                      <SelectItem value="BROTHERS">{t("ruleTpl.relBrothers")}</SelectItem>
                      <SelectItem value="SISTERS_AND_BROTHERS">{t("ruleTpl.relBoth")}</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="rt-min">{t("ruleTpl.minSiblings")}</Label>
                <Input id="rt-min" type="number" min={2} value={minSiblingCount} onChange={(e) => setMinSiblingCount(e.target.value)} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="rt-vt">{t("ruleTpl.type")}</Label>
              <Select value={valueType} onValueChange={(v) => { if (v) setValueType(v as DeductionValueType); }}>
                <SelectTrigger id="rt-vt" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="PERCENTAGE">{t("ruleTpl.typePercentage")}</SelectItem>
                    <SelectItem value="FIXED_AMOUNT">{t("ruleTpl.typeFixed")}</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="rt-val">{t("ruleTpl.value")}</Label>
              <Input id="rt-val" type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} />
            </div>
          </div>

          {category === "TOPPER" && (
            <p className="text-xs text-muted-foreground">
              {t("ruleTpl.topperNote")}
            </p>
          )}

          <Button onClick={handleSave} disabled={!canSave}>
            {saving ? t("common.saving") : t("ruleTpl.save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
