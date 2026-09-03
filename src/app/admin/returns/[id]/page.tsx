"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader, EmptyState } from "@/components/ui/loading";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { ArrowLeft, RotateCcw, ExternalLink } from "lucide-react";

interface ReturnDetail {
  _id: string;
  returnId: string;
  dispatchMongoId: string;
  dispatchId: string;
  finalBillId?: string;
  customerName: string;
  customerCode?: string;
  refundAmount: number;
  refundMethod: string;
  refundMethodDetail?: string;
  notes?: string;
  returnDate: string;
  processedByName: string;
  items: Array<{
    productName: string;
    productCode: string;
    soldPieces: number;
    returnPieces: number;
    lineReturnAmount: number;
    reason?: string;
    sellMode?: string;
  }>;
}

const REFUND_LABELS: Record<string, string> = {
  credit: "Account Credit",
  cash: "Cash / UPI Refund",
  adjust_pending: "Pending Adjusted",
};

export default function ReturnDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<ReturnDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/returns/${id}`)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok || !json.return) {
          setNotFound(true);
          return;
        }
        setData(json.return);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <PageLoader />;
  if (notFound || !data) {
    return (
      <EmptyState
        title="Return not found"
        action={
          <Link href="/admin/returns">
            <Button variant="outline">Back to Returns</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Link href="/admin/returns">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-serif font-bold text-navy flex items-center gap-2">
            <RotateCcw className="h-6 w-6 text-gold" />
            {data.returnId}
          </h1>
          <p className="text-sm text-gray-500">{formatDateTime(data.returnDate)} · {data.processedByName}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Return Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Customer</p>
            <p className="font-medium">{data.customerName}</p>
            {data.customerCode && <p className="text-xs text-gold">{data.customerCode}</p>}
          </div>
          <div>
            <p className="text-gray-500">Original Bill</p>
            <Link
              href={`/admin/dispatch/${data.dispatchMongoId}`}
              className="font-medium text-gold hover:underline inline-flex items-center gap-1"
            >
              {data.finalBillId || data.dispatchId}
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
          <div>
            <p className="text-gray-500">Return Amount</p>
            <p className="font-bold text-red-600 text-lg">{formatCurrency(data.refundAmount)}</p>
          </div>
          <div>
            <p className="text-gray-500">Refund Method</p>
            <p className="font-medium">{REFUND_LABELS[data.refundMethod] || data.refundMethod}</p>
            {data.refundMethodDetail && (
              <p className="text-xs text-gray-500">via {data.refundMethodDetail}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Returned Products ({data.items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-gray-500">
                  <th className="py-2 pr-4">Product</th>
                  <th className="py-2 pr-4">Sold</th>
                  <th className="py-2 pr-4">Returned</th>
                  <th className="py-2 pr-4 text-right">Amount</th>
                  <th className="py-2">Reason</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-3 pr-4">
                      <p className="font-medium">{item.productName}</p>
                      <p className="text-xs text-gray-500">{item.productCode}</p>
                    </td>
                    <td className="py-3 pr-4">
                      {item.soldPieces}
                      {item.sellMode === "kg" ? " Kg" : " pc"}
                    </td>
                    <td className="py-3 pr-4 font-medium text-amber-700">
                      {item.returnPieces}
                      {item.sellMode === "kg" ? " Kg" : " pc"}
                    </td>
                    <td className="py-3 pr-4 text-right font-medium">
                      {formatCurrency(item.lineReturnAmount)}
                    </td>
                    <td className="py-3 text-gray-500">{item.reason || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {data.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700">{data.notes}</p>
          </CardContent>
        </Card>
      )}

      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
        Stock restore ho chuka hai · Bill amount adjust ho gaya hai · Inventory history me RETURN entry dikhegi
      </div>
    </div>
  );
}
