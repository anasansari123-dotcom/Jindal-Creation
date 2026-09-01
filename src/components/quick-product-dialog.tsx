"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { PackagePlus } from "lucide-react";
import {
  formatRatePerUnitLabel,
  formatSellingUnitLabel,
  type SellingUnit,
} from "@/lib/product-units";

export interface QuickProductResult {
  _id: string;
  productId: string;
  name: string;
  sellingPrice: number;
  piecesPerBox: number;
  currentStock: number;
  sellingUnit?: string;
  unit?: string;
}

interface QuickProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (product: QuickProductResult) => void;
  defaultCategory?: string;
  /** Stay open after create so multiple products can be added in one session */
  continuous?: boolean;
}

function unitDisplayName(unit: SellingUnit): string {
  return formatSellingUnitLabel(unit);
}

export function QuickProductDialog({
  open,
  onOpenChange,
  onCreated,
  defaultCategory = "",
  continuous = false,
}: QuickProductDialogProps) {
  const [categories, setCategories] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    productId: "",
    category: defaultCategory,
    sellingUnit: "box" as SellingUnit,
    sellingPrice: 0,
  });

  useEffect(() => {
    if (open) {
      setForm((f) => ({
        ...f,
        category: defaultCategory || f.category,
      }));
      fetch("/api/categories")
        .then((r) => r.json())
        .then((d) => setCategories(d.categories || []))
        .catch(() => {});
    }
  }, [open, defaultCategory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.productId.trim() || !form.category) {
      toast("Name, number aur category required hai", "error");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/products/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          productId: form.productId,
          category: form.category,
          sellingUnit: form.sellingUnit,
          sellingPrice: form.sellingPrice,
          piecesPerBox: 1,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Product create failed", "error");
        return;
      }
      toast(
        continuous
          ? "Product ban gaya — qty daalein aur Add to bill karein"
          : "Naya product ban gaya",
        "success"
      );
      const sellingUnit = (data.product.sellingUnit || form.sellingUnit) as SellingUnit;
      onCreated({
        ...data.product,
        sellingUnit,
        unit: data.product.unit || unitDisplayName(sellingUnit),
      });
      setForm({
        name: "",
        productId: "",
        category: defaultCategory,
        sellingUnit: form.sellingUnit,
        sellingPrice: 0,
      });
      if (!continuous) {
        onOpenChange(false);
      }
    } catch {
      toast("Something went wrong", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const unitLabel = formatSellingUnitLabel(form.sellingUnit);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-serif">
            <PackagePlus className="h-5 w-5 text-gold" />
            Naya product
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-gray-600 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
            Product <strong>{unitLabel}</strong> unit me banega. Stock <strong>0</strong> se start —
            bina purchase sell karoge to minus me jayega.
          </p>

          <div>
            <Label>Category *</Label>
            <Select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              required
            >
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Product Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. New Item"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Same naam se multiple products ho sakte hain</p>
            </div>
            <div>
              <Label>Product Number *</Label>
              <Input
                value={form.productId}
                onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))}
                placeholder="e.g. 2200"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Same number multiple products me ho sakta hai</p>
            </div>
          </div>

          <div>
            <Label>Sell Unit *</Label>
            <Select
              value={form.sellingUnit}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  sellingUnit: e.target.value as SellingUnit,
                }))
              }
            >
              <option value="box">Box</option>
              <option value="piece">Piece</option>
              <option value="kg">Kg</option>
            </Select>
          </div>

          <div>
            <Label>{formatRatePerUnitLabel(form.sellingUnit)} *</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.sellingPrice || ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, sellingPrice: Number(e.target.value) || 0 }))
              }
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="gold" disabled={submitting}>
              {submitting
                ? "Saving..."
                : continuous
                  ? "Create & Add Another"
                  : "Create Product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
