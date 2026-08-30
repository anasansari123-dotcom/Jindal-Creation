"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import { formatProductDisplay } from "@/lib/product-display";
import { isKgProduct, isPieceProduct } from "@/lib/product-units";
import { piecePriceFromBox } from "@/lib/bill-pricing";
import {
  type BillFormProduct,
  type BillItemRow,
  billItemRowTotal,
  emptyBillItemRow,
  patchBillItemField,
} from "@/lib/dispatch-bill-form";
import { PackagePlus, Trash2 } from "lucide-react";

interface BillFormItemsEditorProps {
  items: BillItemRow[];
  products: BillFormProduct[];
  onItemsChange: (items: BillItemRow[]) => void;
  onOpenQuickAdd: () => void;
}

export function BillFormItemsEditor({
  items,
  products,
  onItemsChange,
  onOpenQuickAdd,
}: BillFormItemsEditorProps) {
  const updateItem = (index: number, field: keyof BillItemRow, value: string | number) => {
    onItemsChange(
      items.map((row, i) => {
        if (i !== index) return row;
        const product =
          field === "productId"
            ? products.find((p) => p._id === value)
            : products.find((p) => p._id === row.productId);
        return patchBillItemField(row, field, value, product);
      })
    );
  };

  const removeItem = (index: number) => {
    const next = items.filter((_, i) => i !== index);
    onItemsChange(next.length > 0 ? next : [emptyBillItemRow()]);
  };

  const filledRows = items.filter((row) => row.productId);

  if (filledRows.length === 0 && items.length === 1 && !items[0].productId) {
    return (
      <div className="border rounded-lg p-4 space-y-3">
        <p className="text-sm text-gray-500">
          <strong>Quick Add Products</strong> se ek saath kaafi products jodhein, ya neeche manually select karein.
        </p>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[200px]">
            <Select
              value={items[0].productId}
              onChange={(e) => updateItem(0, "productId", e.target.value)}
            >
              <option value="">Product select karein...</option>
              {products.map((pr) => (
                <option key={pr._id} value={pr._id}>
                  {formatProductDisplay(pr.name, pr.productId)}
                </option>
              ))}
            </Select>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onOpenQuickAdd}>
            <PackagePlus className="h-4 w-4" /> Naya Product
          </Button>
        </div>
      </div>
    );
  }

  const dash = <span className="text-gray-300 block text-center">—</span>;

  const rowProduct = (item: BillItemRow) =>
    products.find((x) => x._id === item.productId);

  const showBoxForRow = (item: BillItemRow, product?: BillFormProduct) => {
    if (!product || isKgProduct(product)) return false;
    if (item.boxQty > 0) return true;
    if (isPieceProduct(product)) return false;
    if (item.pieceQty > 0) return false;
    return item.boxQty === 0 && item.pieceQty === 0;
  };

  const showPieceForRow = (item: BillItemRow, product?: BillFormProduct) => {
    if (!product || isKgProduct(product)) return false;
    if (item.pieceQty > 0) return true;
    if (isPieceProduct(product)) return item.boxQty === 0;
    return false;
  };

  const showBoxColumn = items.some((item) => {
    const p = rowProduct(item);
    return p && showBoxForRow(item, p);
  });

  const showPieceColumn = items.some((item) => {
    const p = rowProduct(item);
    return p && showPieceForRow(item, p);
  });

  const showKgColumn = items.some((item) => {
    const p = rowProduct(item);
    return p && isKgProduct(p);
  });

  return (
    <div className="overflow-x-auto border rounded-lg">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50 text-left text-gray-500">
            <th className="p-3 font-medium min-w-[180px]">Product</th>
            {showBoxColumn && (
              <>
                <th className="p-3 font-medium text-right w-20">Box</th>
                <th className="p-3 font-medium text-right w-24">Box ₹</th>
              </>
            )}
            {showPieceColumn && (
              <>
                <th className="p-3 font-medium text-right w-20">Pc</th>
                <th className="p-3 font-medium text-right w-24">Pc ₹</th>
              </>
            )}
            {showKgColumn && (
              <>
                <th className="p-3 font-medium text-right w-20">Kg</th>
                <th className="p-3 font-medium text-right w-24">Kg ₹</th>
              </>
            )}
            <th className="p-3 font-medium text-right w-28">Total</th>
            <th className="p-3 w-10"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const p = rowProduct(item);
            const isKg = p ? isKgProduct(p) : false;
            const pieceDefault =
              p && !isKg ? piecePriceFromBox(p.sellingPrice, p.piecesPerBox) : 0;
            const total = p ? billItemRowTotal(item, p) : 0;
            const boxActive = p && showBoxForRow(item, p);
            const pieceActive = p && showPieceForRow(item, p);
            const boxRateDisplay =
              item.boxPrice > 0
                ? item.boxPrice
                : item.boxQty > 0 && p
                  ? p.sellingPrice
                  : "";
            const pieceRateDisplay =
              item.piecePrice > 0
                ? item.piecePrice
                : item.pieceQty > 0
                  ? pieceDefault
                  : "";
            const kgRateDisplay =
              item.kgPrice > 0
                ? item.kgPrice
                : item.kgQty > 0 && p
                  ? p.sellingPrice
                  : "";

            return (
              <tr key={item.id} className="border-b last:border-0 hover:bg-gray-50/50">
                <td className="p-2">
                  {p ? (
                    <div>
                      <p className="font-medium text-navy leading-tight">{p.name}</p>
                      <p className="text-xs text-gold">{p.productId}</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Select
                        value={item.productId}
                        onChange={(e) => updateItem(index, "productId", e.target.value)}
                      >
                        <option value="">Select...</option>
                        {products.map((pr) => (
                          <option key={pr._id} value={pr._id}>
                            {formatProductDisplay(pr.name, pr.productId)}
                          </option>
                        ))}
                      </Select>
                      <button
                        type="button"
                        className="text-xs text-gold hover:underline"
                        onClick={onOpenQuickAdd}
                      >
                        + Naya Product
                      </button>
                    </div>
                  )}
                </td>
                {showBoxColumn && (
                  <>
                    <td className="p-2">
                      {boxActive ? (
                        <Input
                          type="number"
                          min={0}
                          className="h-9 text-right"
                          value={item.boxQty > 0 ? item.boxQty : ""}
                          placeholder="0"
                          onChange={(e) =>
                            updateItem(index, "boxQty", Math.max(0, Number(e.target.value) || 0))
                          }
                        />
                      ) : (
                        dash
                      )}
                    </td>
                    <td className="p-2">
                      {boxActive ? (
                        <Input
                          type="number"
                          min={0}
                          className="h-9 text-right"
                          value={boxRateDisplay}
                          placeholder={String(p!.sellingPrice)}
                          onChange={(e) =>
                            updateItem(index, "boxPrice", Math.max(0, Number(e.target.value) || 0))
                          }
                        />
                      ) : (
                        dash
                      )}
                    </td>
                  </>
                )}
                {showPieceColumn && (
                  <>
                    <td className="p-2">
                      {pieceActive ? (
                        <Input
                          type="number"
                          min={0}
                          className="h-9 text-right"
                          value={item.pieceQty > 0 ? item.pieceQty : ""}
                          placeholder="0"
                          onChange={(e) =>
                            updateItem(index, "pieceQty", Math.max(0, Number(e.target.value) || 0))
                          }
                        />
                      ) : (
                        dash
                      )}
                    </td>
                    <td className="p-2">
                      {pieceActive ? (
                        <Input
                          type="number"
                          min={0}
                          className="h-9 text-right"
                          value={pieceRateDisplay}
                          placeholder={String(pieceDefault)}
                          onChange={(e) =>
                            updateItem(index, "piecePrice", Math.max(0, Number(e.target.value) || 0))
                          }
                        />
                      ) : (
                        dash
                      )}
                    </td>
                  </>
                )}
                {showKgColumn && (
                  <>
                    <td className="p-2">
                      {isKg ? (
                        <Input
                          type="number"
                          min={0}
                          step="0.001"
                          className="h-9 text-right"
                          value={item.kgQty > 0 ? item.kgQty : ""}
                          placeholder="0"
                          onChange={(e) =>
                            updateItem(index, "kgQty", Math.max(0, Number(e.target.value) || 0))
                          }
                        />
                      ) : (
                        dash
                      )}
                    </td>
                    <td className="p-2">
                      {isKg ? (
                        <Input
                          type="number"
                          min={0}
                          className="h-9 text-right"
                          value={kgRateDisplay}
                          placeholder={String(p!.sellingPrice)}
                          onChange={(e) =>
                            updateItem(index, "kgPrice", Math.max(0, Number(e.target.value) || 0))
                          }
                        />
                      ) : (
                        dash
                      )}
                    </td>
                  </>
                )}
                <td className="p-2 text-right font-medium text-green-700 whitespace-nowrap">
                  {p ? formatCurrency(total) : "—"}
                </td>
                <td className="p-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => removeItem(index)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
