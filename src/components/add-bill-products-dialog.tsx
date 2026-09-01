"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchInput } from "@/components/ui/search-input";
import { toast } from "@/components/ui/toast";
import { formatCurrency, cn } from "@/lib/utils";
import { formatProductDisplay, formatProductOptionLabel } from "@/lib/product-display";
import { formatProductStock, isKgProduct, formatRatePerUnitLabel } from "@/lib/product-units";
import { piecePriceFromBox } from "@/lib/bill-pricing";
import {
  type BillFormProduct,
  type BillItemRow,
  billItemRowHasQty,
  defaultPricesForProduct,
  emptyBillItemRow,
  newBillItemRowId,
  patchBillItemField,
} from "@/lib/dispatch-bill-form";
import {
  QuickProductDialog,
  type QuickProductResult,
} from "@/components/quick-product-dialog";
import { ArrowLeft, Check, PackagePlus, Plus, ShoppingCart, Trash2, X } from "lucide-react";

interface QueuedLine extends BillItemRow {
  queueId: string;
}

interface AddBillProductsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: BillFormProduct[];
  onProductsChange: (products: BillFormProduct[]) => void;
  onAdd: (rows: BillItemRow[]) => void;
  /** Dispatch: qty only. Final: rates visible */
  showPricing?: boolean;
  /** Open naya-product form immediately (e.g. from bill page "Naya Product" button) */
  startWithQuickCreate?: boolean;
}

function formatQueuedQty(row: BillItemRow, product: BillFormProduct, showPricing: boolean): string {
  if (isKgProduct(product)) {
    return showPricing
      ? `${row.kgQty} Kg @ ${formatCurrency(row.kgPrice || product.sellingPrice)}`
      : `${row.kgQty} Kg`;
  }
  const parts: string[] = [];
  if (row.boxQty > 0) {
    parts.push(
      showPricing
        ? `${row.boxQty} Box @ ${formatCurrency(row.boxPrice || product.sellingPrice)}`
        : `${row.boxQty} Box`
    );
  }
  if (row.pieceQty > 0) {
    const pp = row.piecePrice || piecePriceFromBox(product.sellingPrice, product.piecesPerBox);
    parts.push(
      showPricing ? `${row.pieceQty} Pc @ ${formatCurrency(pp)}` : `${row.pieceQty} Pc`
    );
  }
  return parts.join(" + ") || "—";
}

export function AddBillProductsDialog({
  open,
  onOpenChange,
  products,
  onProductsChange,
  onAdd,
  showPricing = true,
  startWithQuickCreate = false,
}: AddBillProductsDialogProps) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<BillItemRow>(emptyBillItemRow());
  const [queue, setQueue] = useState<QueuedLine[]>([]);
  const [quickOpen, setQuickOpen] = useState(false);
  const [mobileStep, setMobileStep] = useState<"list" | "detail">("list");

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setSelectedId("");
    setDraft(emptyBillItemRow());
    setQueue([]);
    setQuickOpen(startWithQuickCreate);
    setMobileStep("list");
  }, [open, startWithQuickCreate]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.productId.toLowerCase().includes(q)
    );
  }, [products, search]);

  const selected = products.find((p) => p._id === selectedId);
  const isKg = selected ? isKgProduct(selected) : false;
  const pieceRate =
    selected && !isKg
      ? piecePriceFromBox(selected.sellingPrice, selected.piecesPerBox)
      : 0;

  const selectProduct = (id: string) => {
    const product = products.find((p) => p._id === id);
    if (!product) return;
    setSelectedId(id);
    setDraft({
      ...emptyBillItemRow(),
      productId: id,
      ...defaultPricesForProduct(product),
    });
    setMobileStep("detail");
  };

  const updateDraft = (field: keyof BillItemRow, value: number) => {
    setDraft((prev) => patchBillItemField(prev, field, value, selected));
  };

  const addDraftToQueue = () => {
    if (!selected) {
      toast("Pehle product select karein", "error");
      return;
    }
    if (!billItemRowHasQty(draft, selected)) {
      toast("Box, piece ya kg qty daalein", "error");
      return;
    }

    setQueue((prev) => [
      ...prev,
      {
        ...draft,
        productId: selected._id,
        id: newBillItemRowId(),
        queueId: newBillItemRowId(),
      },
    ]);
    setDraft(emptyBillItemRow());
    setSelectedId("");
    setMobileStep("list");
    toast(`${selected.name} bill me joda`, "success");
  };

  const handleQuickCreated = (product: QuickProductResult) => {
    const next: BillFormProduct = {
      _id: product._id,
      productId: product.productId,
      name: product.name,
      sellingPrice: product.sellingPrice,
      piecesPerBox: product.piecesPerBox,
      currentStock: product.currentStock,
      sellingUnit: product.sellingUnit || "box",
      unit: product.unit || "Box",
    };
    onProductsChange(
      products.some((p) => p._id === next._id) ? products : [...products, next]
    );

    setSelectedId(next._id);
    setDraft({
      ...emptyBillItemRow(),
      productId: next._id,
      ...defaultPricesForProduct(next),
    });
    setQuickOpen(false);
    toast(`${next.name} ban gaya — qty daalein aur Add to bill karein`, "success");
  };

  const finish = () => {
    if (queue.length === 0) {
      toast("Kam se kam ek product add karein", "error");
      return;
    }
    onAdd(queue.map(({ queueId: _q, ...row }) => row));
    toast(`${queue.length} product bill me add ho gaye`, "success");
    onOpenChange(false);
  };

  if (!open) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl w-[min(100vw-1rem,56rem)] max-h-[100dvh] sm:max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0 top-[50%] translate-y-[-50%]">
          <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-2 shrink-0">
            <DialogTitle className="flex items-center gap-2 font-serif text-lg sm:text-xl">
              <ShoppingCart className="h-5 w-5 text-gold shrink-0" aria-hidden="true" />
              Bill me products jodhein
            </DialogTitle>
            <p className="text-xs sm:text-sm text-gray-600 font-normal leading-snug">
              <span className="hidden sm:inline">
                Product select karein, qty aur rate daalein,{" "}
                <strong>Add to bill</strong> dabate rahein. Sab add hone ke baad{" "}
                <strong>Done</strong> karein.
              </span>
              <span className="sm:hidden">
                Product choose karein → qty daalein → Add to bill → Done
              </span>
            </p>
          </DialogHeader>

          <div className="px-4 sm:px-6 pb-2 shrink-0">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Product name ya number search karein..."
              label="Search products for bill"
            />
          </div>

          <div className="flex-1 min-h-0 flex flex-col gap-2 sm:gap-3 px-4 sm:px-6 overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 min-h-0 flex-1 overflow-hidden">
              {/* Product list — full width on mobile when on list step */}
              <div
                className={cn(
                  "border rounded-lg flex flex-col min-h-0 overflow-hidden md:flex-1",
                  mobileStep === "detail" ? "hidden md:flex" : "flex max-h-[38vh] md:max-h-none"
                )}
              >
                <div className="px-3 py-2 border-b bg-gray-50 text-xs font-medium text-gray-600 shrink-0">
                  Products ({filteredProducts.length})
                </div>
                <div className="overflow-y-auto flex-1 min-h-0 divide-y overscroll-contain">
                  {filteredProducts.length === 0 ? (
                    <p className="p-4 text-sm text-gray-500 text-center">
                      Koi product nahi mila
                    </p>
                  ) : (
                    filteredProducts.map((p) => (
                      <button
                        key={p._id}
                        type="button"
                        onClick={() => selectProduct(p._id)}
                        className={`w-full text-left px-3 py-2.5 hover:bg-gold/5 transition-colors ${
                          selectedId === p._id ? "bg-gold/10 border-l-2 border-l-gold" : ""
                        }`}
                      >
                        <p className="font-medium text-navy text-sm leading-tight">{p.name}</p>
                        <p className="text-xs text-gray-600 mt-0.5">
                          #{p.productId} · Stock: {formatProductStock(p)}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Qty / rate panel */}
              <div
                className={cn(
                  "border rounded-lg flex-col min-h-0 overflow-hidden md:flex md:flex-1",
                  selected && mobileStep === "detail" ? "flex flex-1" : "hidden md:flex"
                )}
              >
                {!selected ? (
                  <div className="flex-1 min-h-[100px] md:min-h-[160px] flex flex-col items-center justify-center text-center text-gray-500 px-4 py-6">
                    <ShoppingCart className="h-8 w-8 mb-2 opacity-40" aria-hidden="true" />
                    <p className="text-sm">
                      <span className="md:hidden">Upar se product select karein</span>
                      <span className="hidden md:inline">Left se product select karein</span>
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="md:hidden shrink-0 flex items-center gap-2 px-3 py-2 border-b bg-gray-50">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => setMobileStep("list")}
                        aria-label="Back to product list"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Products
                      </Button>
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pt-3 sm:pt-4 pb-2 space-y-2.5">
                      <div className="shrink-0">
                        <p className="font-semibold text-navy leading-tight">{selected.name}</p>
                        <p className="text-xs text-gold">#{selected.productId}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Stock: {formatProductStock(selected)}
                        </p>
                      </div>

                      {isKg ? (
                        <div className={showPricing ? "grid grid-cols-2 gap-2 shrink-0" : "shrink-0"}>
                          <div>
                            <Label className="text-xs">Qty (Kg)</Label>
                            <Input
                              type="number"
                              min={0}
                              step="0.001"
                              value={draft.kgQty || ""}
                              placeholder="0"
                              className="h-9"
                              onChange={(e) =>
                                updateDraft("kgQty", Math.max(0, Number(e.target.value) || 0))
                              }
                            />
                          </div>
                          {showPricing && (
                          <div>
                            <Label className="text-xs">Rate / Kg (₹)</Label>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              value={draft.kgPrice || ""}
                              placeholder={String(selected.sellingPrice)}
                              className="h-9"
                              onChange={(e) =>
                                updateDraft("kgPrice", Math.max(0, Number(e.target.value) || 0))
                              }
                            />
                          </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2 shrink-0">
                          <div className={showPricing ? "grid grid-cols-2 gap-2" : ""}>
                            <div>
                              <Label className="text-xs">Box Qty</Label>
                            <Input
                              type="number"
                              min={0}
                              step={1}
                              value={draft.boxQty || ""}
                                placeholder="0"
                                className="h-9"
                                onChange={(e) =>
                                  updateDraft("boxQty", Math.max(0, Number(e.target.value) || 0))
                                }
                              />
                            </div>
                            {showPricing && (
                            <div>
                              <Label className="text-xs">{formatRatePerUnitLabel("box")}</Label>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              value={draft.boxPrice || ""}
                                placeholder={String(selected.sellingPrice)}
                                className="h-9"
                                onChange={(e) =>
                                  updateDraft("boxPrice", Math.max(0, Number(e.target.value) || 0))
                                }
                              />
                            </div>
                            )}
                          </div>
                          <div className={showPricing ? "grid grid-cols-2 gap-2" : ""}>
                            <div>
                              <Label className="text-xs">Piece Qty</Label>
                            <Input
                              type="number"
                              min={0}
                              step={1}
                              value={draft.pieceQty || ""}
                                placeholder="0"
                                className="h-9"
                                onChange={(e) =>
                                  updateDraft("pieceQty", Math.max(0, Number(e.target.value) || 0))
                                }
                              />
                            </div>
                            {showPricing && (
                            <div>
                              <Label className="text-xs">{formatRatePerUnitLabel("piece")}</Label>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              value={draft.piecePrice || ""}
                              placeholder={String(pieceRate)}
                                className="h-9"
                                onChange={(e) =>
                                  updateDraft("piecePrice", Math.max(0, Number(e.target.value) || 0))
                                }
                              />
                            </div>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-500 leading-snug">
                            Box aur Piece alag-alag — dono bill me alag lines.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="shrink-0 px-4 py-3 border-t bg-white">
                      <Button
                        type="button"
                        variant="gold"
                        className="w-full"
                        onClick={addDraftToQueue}
                      >
                        <Plus className="h-4 w-4" />
                        Add to bill
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div
              className={cn(
                "shrink-0 border rounded-lg bg-gray-50 flex flex-col",
                queue.length === 0 ? "min-h-0" : "max-h-[min(160px,22vh)]"
              )}
            >
              <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50 shrink-0">
                <p className="text-sm font-medium text-navy">
                  Bill me add ho chuke ({queue.length})
                </p>
                {queue.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-red-600 h-8"
                    onClick={() => setQueue([])}
                  >
                    <Trash2 className="h-4 w-4 inline mr-1" />
                    Sab hatao
                  </Button>
                )}
              </div>
              {queue.length === 0 ? (
                <p className="text-xs text-gray-500 px-3 py-2">Abhi kuch add nahi</p>
              ) : (
                <div className="overflow-y-auto flex-1 min-h-0 overscroll-contain px-3 py-2 space-y-1.5">
                  {queue.map((row) => {
                    const p = products.find((x) => x._id === row.productId);
                    if (!p) return null;
                    return (
                      <div
                        key={row.id}
                        className="flex items-center justify-between gap-2 rounded-md bg-white border px-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <span className="font-medium text-navy truncate block">
                            {formatProductOptionLabel(p)}
                          </span>
                          <span className="text-xs text-gray-500">{formatQueuedQty(row, p, showPricing)}</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="shrink-0 h-8 w-8 p-0"
                          aria-label={`Remove ${p.name} from bill`}
                          onClick={() =>
                            setQueue((prev) => prev.filter((q) => q.id !== row.id))
                          }
                        >
                          <X className="h-4 w-4 text-red-500" aria-hidden="true" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0 border-t bg-white px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto order-2 sm:order-1"
              onClick={() => setQuickOpen(true)}
            >
              <PackagePlus className="h-4 w-4" aria-hidden="true" />
              Naya Product
            </Button>
            <div className="grid grid-cols-2 sm:flex gap-2 order-1 sm:order-2 w-full sm:w-auto">
              <Button type="button" variant="outline" className="w-full sm:min-w-[100px]" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="gold"
                className="w-full sm:min-w-[140px]"
                disabled={queue.length === 0}
                onClick={finish}
              >
                <Check className="h-4 w-4" aria-hidden="true" />
                Done ({queue.length})
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <QuickProductDialog
        open={quickOpen}
        onOpenChange={setQuickOpen}
        onCreated={handleQuickCreated}
        continuous
      />
    </>
  );
}
