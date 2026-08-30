"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader, EmptyState } from "@/components/ui/loading";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import {
  formatBillLineCalculation,
  formatLineRate,
  formatLineUnit,
  formatQtyDisplay,
  enrichBillLineItem,
} from "@/lib/bill-pricing";
import { ArrowLeft, History, Package } from "lucide-react";

interface HistoryEntry {
  date: string;
  customerId?: string;
  customerName: string;
  customerCode?: string;
  billId: string;
  billType: "Order" | "Dispatch" | "Final" | "Confirm";
  billLink?: string;
  pieces: number;
  boxes: number;
  fullBoxes: number;
  loosePieces: number;
  quantity: number;
  unitPrice: number;
  piecePrice: number;
  piecesPerBox: number;
  sellMode: "box" | "piece" | "mixed";
  total: number;
}

interface ProductInfo {
  _id: string;
  productId: string;
  name: string;
  category: string;
  piecesPerBox: number;
  currentStock: number;
}

export default function ProductHistoryDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [product, setProduct] = useState<ProductInfo | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [summary, setSummary] = useState({
    totalEntries: 0,
    totalPieces: 0,
    totalBoxes: 0,
    totalLoosePieces: 0,
    totalAmount: 0,
    uniqueCustomers: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/products/history/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.product) {
          setProduct(data.product);
          setHistory(data.history || []);
          if (data.summary) setSummary(data.summary);
        }
        setLoading(false);
      });
  }, [id]);

  if (loading) return <PageLoader />;
  if (!product) return <EmptyState title="Product not found" />;

  const billTypeStyle = (type: string) => {
    if (type === "Final" || type === "Confirm") return "bg-green-100 text-green-800";
    if (type === "Dispatch") return "bg-blue-100 text-blue-800";
    return "bg-gray-100 text-gray-700";
  };

  const stockBoxes = Math.floor(product.currentStock / (product.piecesPerBox || 1));
  const stockLoose = product.currentStock % (product.piecesPerBox || 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/products/history">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-serif font-bold text-navy">{product.name}</h1>
          <p className="text-sm text-gold">{product.productId} · {product.category}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-6 gap-4">
        {[
          ["Box Sold", summary.totalBoxes, "text-navy"],
          ["Loose Pcs Sold", summary.totalLoosePieces ?? 0, "text-navy"],
          ["Total Pieces", summary.totalPieces, "text-navy"],
          ["Customers", summary.uniqueCustomers, "text-gold"],
          ["Sales Amount", formatCurrency(summary.totalAmount), "text-green-700"],
          ["Current Stock", `${stockBoxes} Box · ${stockLoose} Pc`, "text-navy"],
        ].map(([label, value, color]) => (
          <Card key={label as string}>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-gray-500">{label}</p>
              <p className={`text-lg font-bold mt-1 ${color}`}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-gold/20 bg-gold/5">
        <CardContent className="py-3 px-4 text-sm text-gray-700 flex items-center gap-2">
          <Package className="h-4 w-4 text-gold" />
          1 Box = <strong>{product.piecesPerBox} pieces</strong>
          {" · "}
          Box rate & piece rate bill jaisa alag-alag dikhte hain
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="h-5 w-5 text-gold" />
            Customer-wise History ({history.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <EmptyState
              title="No history yet"
              description="Jab is product ki dispatch ya order bill banegi, yahan dikhegi"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500 bg-gray-50">
                    <th className="p-3 font-medium">Date</th>
                    <th className="p-3 font-medium">Customer</th>
                    <th className="p-3 font-medium">Bill ID</th>
                    <th className="p-3 font-medium">Type</th>
                    <th className="p-3 font-medium text-center">Unit</th>
                    <th className="p-3 font-medium text-right">Qty</th>
                    <th className="p-3 font-medium text-right">Rate</th>
                    <th className="p-3 font-medium">Calculation</th>
                    <th className="p-3 font-medium text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row, i) => {
                    const pricing = enrichBillLineItem({
                      pieces: row.pieces,
                      boxes: row.boxes,
                      fullBoxes: row.fullBoxes,
                      loosePieces: row.loosePieces,
                      piecesPerBox: row.piecesPerBox,
                      unitPrice: row.unitPrice,
                      piecePrice: row.piecePrice,
                      total: row.total,
                      sellMode: row.sellMode,
                      quantity: row.quantity,
                    });
                    return (
                      <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="p-3 text-gray-600 whitespace-nowrap">
                          {formatDateTime(row.date)}
                        </td>
                        <td className="p-3">
                          {row.customerId ? (
                            <Link
                              href={`/admin/customers/${row.customerId}`}
                              className="font-medium text-navy hover:text-gold hover:underline"
                            >
                              {row.customerName}
                            </Link>
                          ) : (
                            <span className="font-medium">{row.customerName}</span>
                          )}
                          {row.customerCode && (
                            <div className="text-xs text-gray-400">{row.customerCode}</div>
                          )}
                        </td>
                        <td className="p-3">
                          {row.billLink ? (
                            <Link href={row.billLink} className="text-gold hover:underline">
                              {row.billId}
                            </Link>
                          ) : (
                            <span className="text-gold">{row.billId}</span>
                          )}
                        </td>
                        <td className="p-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${billTypeStyle(row.billType)}`}>
                            {row.billType}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span className="inline-block text-xs font-medium px-2 py-0.5 rounded bg-navy/5 text-navy">
                            {formatLineUnit(pricing)}
                          </span>
                        </td>
                        <td className="p-3 text-right font-medium whitespace-nowrap">
                          {formatQtyDisplay(pricing.fullBoxes, pricing.loosePieces)}
                        </td>
                        <td className="p-3 text-right text-xs font-medium whitespace-nowrap">
                          {formatLineRate(pricing)}
                        </td>
                        <td className="p-3 text-xs text-gray-600">
                          {formatBillLineCalculation(pricing)}
                        </td>
                        <td className="p-3 text-right font-medium text-green-700">
                          {formatCurrency(pricing.total)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 bg-navy/5 font-bold">
                    <td className="p-3" colSpan={5}>Total</td>
                    <td className="p-3 text-right whitespace-nowrap">
                      {summary.totalBoxes} Box · {summary.totalLoosePieces ?? 0} Pc
                    </td>
                    <td className="p-3"></td>
                    <td className="p-3"></td>
                    <td className="p-3 text-right text-green-700">
                      {formatCurrency(summary.totalAmount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
