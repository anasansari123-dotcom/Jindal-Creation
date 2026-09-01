import { formatCurrency } from "@/lib/utils";
import {
  enrichBillLineItem,
  expandItemsForBillDisplay,
  formatBillLineCalculation,
  formatLineDetail,
  formatLineRate,
  formatLineUnit,
  formatQtyDisplay,
} from "@/lib/bill-pricing";

export interface BillItemRow {
  productName: string;
  productCode?: string;
  pieces: number;
  boxes?: number;
  fullBoxes?: number;
  loosePieces?: number;
  piecesPerBox?: number;
  unitPrice: number;
  piecePrice?: number;
  discount?: number;
  total: number;
  calculation?: string;
  sellMode?: "box" | "piece" | "mixed" | "kg";
  quantity?: number;
}

export function BillItemsTable({
  items,
  showPricing = true,
}: {
  items: BillItemRow[];
  showPricing?: boolean;
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-4 text-center">Is bill me koi product add nahi hua.</p>
    );
  }

  const displayItems = expandItemsForBillDisplay(items);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-sm border-collapse">
        <thead>
          <tr className="border-b bg-gray-50 text-left text-gray-500">
            <th className="px-3 py-2.5 font-medium">Product</th>
            <th className="px-3 py-2.5 font-medium">Item No.</th>
            <th className="px-3 py-2.5 font-medium text-center">Unit</th>
            <th className="px-3 py-2.5 font-medium text-right">Qty</th>
            {showPricing && (
              <>
                <th className="px-3 py-2.5 font-medium text-right">Rate</th>
                <th className="px-3 py-2.5 font-medium">Calculation</th>
                <th className="px-3 py-2.5 font-medium text-right">Discount</th>
                <th className="px-3 py-2.5 font-medium text-right">Total</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {displayItems.map((item, i) => {
            const pricing = enrichBillLineItem(item);
            const calculation = item.calculation ?? formatBillLineCalculation(pricing);
            return (
              <tr key={i} className="border-b last:border-0 hover:bg-gray-50/80">
                <td className="px-3 py-3 align-top">
                  <div className="font-medium text-navy">{item.productName || "—"}</div>
                  {showPricing && (
                    <div className="text-[11px] text-gray-500 mt-0.5">{formatLineDetail(pricing)}</div>
                  )}
                </td>
                <td className="px-3 py-3 text-gray-500 font-mono text-xs align-top">
                  {item.productCode || "—"}
                </td>
                <td className="px-3 py-3 text-center align-top">
                  <span className="inline-block text-xs font-medium px-2 py-0.5 rounded bg-navy/5 text-navy">
                    {formatLineUnit(pricing)}
                  </span>
                </td>
                <td className="px-3 py-3 text-right font-medium text-navy whitespace-nowrap align-top">
                  {formatQtyDisplay(pricing.fullBoxes, pricing.loosePieces, pricing.sellMode, pricing.kgQty)}
                </td>
                {showPricing && (
                  <>
                    <td className="px-3 py-3 text-right text-xs font-medium text-navy whitespace-nowrap align-top">
                      {formatLineRate(pricing)}
                    </td>
                    <td className="px-3 py-3 text-gray-600 text-xs align-top">{calculation}</td>
                    <td className="px-3 py-3 text-right text-red-600 align-top">
                      {(item.discount || 0) > 0 ? `-${formatCurrency(item.discount || 0)}` : "—"}
                    </td>
                    <td className="px-3 py-3 text-right font-medium text-green-700 align-top">
                      {formatCurrency(pricing.total)}
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
