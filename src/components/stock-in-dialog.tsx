"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { Plus, Trash2, Truck } from "lucide-react";
import { formatAvailableStockFromPieces } from "@/lib/stock-display";
import { formatProductOptionLabel } from "@/lib/product-display";
import { formatKgQty, formatProductStock, isKgProduct } from "@/lib/product-units";

export interface StockInProduct {
  _id: string;
  productId: string;
  name: string;
  category?: string;
  piecesPerBox: number;
  currentStock: number;
  sellingUnit?: string;
  unit?: string;
}

interface DeliveryRow {
  id: string;
  label: string;
  quantity: number;
  stockUnit: "boxes" | "pieces" | "kg";
}

function newRow(index: number, isKg = false): DeliveryRow {
  return {
    id: crypto.randomUUID(),
    label: `Gadi ${index}`,
    quantity: 0,
    stockUnit: isKg ? "kg" : "boxes",
  };
}

interface StockInDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: StockInProduct | null;
  products?: StockInProduct[];
  onSuccess?: () => void;
}

export function StockInDialog({
  open,
  onOpenChange,
  product,
  products = [],
  onSuccess,
}: StockInDialogProps) {
  const formKey = product?._id ?? "picker";

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <StockInDialogForm
        key={formKey}
        product={product}
        products={products}
        onSuccess={onSuccess}
        onClose={() => onOpenChange(false)}
      />
    </Dialog>
  );
}

function StockInDialogForm({
  product,
  products,
  onSuccess,
  onClose,
}: {
  product: StockInProduct | null;
  products: StockInProduct[];
  onSuccess?: () => void;
  onClose: () => void;
}) {
  const [selectedId, setSelectedId] = useState(product?._id || "");
  const [rows, setRows] = useState<DeliveryRow[]>([newRow(1), newRow(2)]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const activeProduct = useMemo(() => {
    if (product) return product;
    return products.find((p) => p._id === selectedId) || null;
  }, [product, products, selectedId]);

  const ppb = activeProduct?.piecesPerBox || 1;
  const isKg = activeProduct ? isKgProduct(activeProduct) : false;

  const totalPreview = useMemo(() => {
    if (!activeProduct) return null;
    let added = 0;
    for (const row of rows) {
      if (row.quantity <= 0) continue;
      if (row.stockUnit === "kg") added += row.quantity;
      else if (row.stockUnit === "boxes") added += row.quantity * ppb;
      else added += row.quantity;
    }
    if (isKg) {
      return {
        summary: `${formatKgQty(activeProduct.currentStock + added)} available`,
      };
    }
    return formatAvailableStockFromPieces(activeProduct.currentStock + added, ppb);
  }, [rows, ppb, activeProduct, isKg]);

  const addRow = () => {
    setRows((prev) => [...prev, newRow(prev.length + 1, isKg)]);
  };

  const removeRow = (id: string) => {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)));
  };

  const updateRow = (id: string, patch: Partial<DeliveryRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const handleSubmit = async () => {
    if (!activeProduct) {
      toast("Pehle product select karein", "error");
      return;
    }

    const deliveries = rows
      .filter((r) => r.quantity > 0)
      .map((r) => ({
        label: r.label.trim() || undefined,
        quantity: r.quantity,
        stockUnit: r.stockUnit,
      }));

    if (deliveries.length === 0) {
      toast("Kam se kam ek delivery me quantity daalein", "error");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/inventory/stock-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: activeProduct._id,
          deliveries,
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Stock in failed", "error");
        return;
      }
      toast(
        `${deliveries.length} gadi/delivery save — stock update ho gaya`,
        "success"
      );
      onClose();
      onSuccess?.();
    } catch {
      toast("Something went wrong", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const currentStock = activeProduct
    ? isKg
      ? { summary: `${formatKgQty(activeProduct.currentStock)} available` }
      : formatAvailableStockFromPieces(activeProduct.currentStock, ppb)
    : null;

  return (
    <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-serif">
            <Truck className="h-5 w-5 text-gold" />
            Stock In — Gadi / Delivery
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-gray-600 rounded-lg bg-gold/10 border border-gold/30 px-3 py-2">
            Ek din me <strong>2 ya zyada gadi</strong> aaye to har gadi alag row me likhein.
            Har entry alag history me save hogi (jaise Gadi 1: 100 box, Gadi 2: 150 box).
          </p>

          {!product && products.length > 0 && (
            <div>
              <Label>Product *</Label>
              <Select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
                <option value="">Select product</option>
                {products.map((p) => (
                  <option key={p._id} value={p._id}>
                    {formatProductOptionLabel(p)}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {activeProduct && (
            <div className="rounded-lg border bg-gray-50 px-3 py-2 text-sm">
              <p className="font-medium text-navy">
                {formatProductOptionLabel(activeProduct)}
              </p>
              <p className="text-gray-500 mt-1">
                Abhi available: <strong>{currentStock?.summary}</strong>
                {!isKg && ppb > 1 && <> · 1 Box = {ppb} pcs</>}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Deliveries (Gadi / Truck)</Label>
            {rows.map((row, index) => (
              <div
                key={row.id}
                className="flex flex-col sm:grid sm:grid-cols-[1fr_auto_auto_auto] gap-2 sm:items-end rounded-lg border p-3 bg-white"
              >
                <div>
                  <Label className="text-xs text-gray-500">Label</Label>
                  <Input
                    value={row.label}
                    onChange={(e) => updateRow(row.id, { label: e.target.value })}
                    placeholder={`Gadi ${index + 1}`}
                  />
                </div>
                <div className="w-24">
                  <Label className="text-xs text-gray-500">Unit</Label>
                  <Select
                    value={isKg ? "kg" : row.stockUnit}
                    onChange={(e) =>
                      updateRow(row.id, {
                        stockUnit: e.target.value as "boxes" | "pieces" | "kg",
                      })
                    }
                    disabled={isKg}
                  >
                    {isKg ? (
                      <option value="kg">Kg</option>
                    ) : (
                      <>
                        <option value="boxes">Box</option>
                        <option value="pieces">Piece</option>
                      </>
                    )}
                  </Select>
                </div>
                <div className="w-24">
                  <Label className="text-xs text-gray-500">Qty</Label>
                  <Input
                    type="number"
                    min={0}
                    step={isKg ? "0.001" : "1"}
                    value={row.quantity || ""}
                    onChange={(e) =>
                      updateRow(row.id, { quantity: Number(e.target.value) || 0 })
                    }
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRow(row.id)}
                  disabled={rows.length <= 1}
                  title="Remove row"
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addRow}>
              <Plus className="h-4 w-4" /> Add Gadi / Delivery
            </Button>
          </div>

          {activeProduct && totalPreview && (
            <p className="text-sm text-navy rounded-md border border-navy/10 bg-navy/5 px-3 py-2">
              Save ke baad total available: <strong>{totalPreview.summary}</strong>
            </p>
          )}

          <div>
            <Label>Common Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Supplier name, date, invoice no."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="gold" disabled={submitting} onClick={handleSubmit}>
            {submitting ? "Saving..." : "Save All Deliveries"}
          </Button>
        </DialogFooter>
      </DialogContent>
  );
}
