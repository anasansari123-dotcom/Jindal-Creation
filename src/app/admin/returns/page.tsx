"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { PageLoader, EmptyState } from "@/components/ui/loading";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Plus, Eye, RotateCcw } from "lucide-react";

interface ReturnRecord {
  _id: string;
  returnId: string;
  dispatchMongoId: string;
  dispatchId: string;
  finalBillId?: string;
  customerName: string;
  refundAmount: number;
  refundMethod: string;
  returnDate: string;
  processedByName: string;
  items: Array<{ productName: string; returnPieces: number }>;
}

const REFUND_LABELS: Record<string, string> = {
  credit: "Account Credit",
  cash: "Cash Refund",
  adjust_pending: "Pending Adjust",
};

export default function ReturnsPage() {
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/returns?page=${page}`);
    const data = await res.json();
    setReturns(data.returns || []);
    setTotalPages(data.pagination?.totalPages || 1);
    setTotal(data.pagination?.total || 0);
    setLoading(false);
  }, [page]);

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns]);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-navy flex items-center gap-2">
            <RotateCcw className="h-7 w-7 text-gold" />
            Product Returns
          </h1>
          <p className="text-sm text-gray-500">
            Final Bill se return — stock restore, bill amount adjust, refund/credit
          </p>
        </div>
        <Link href="/admin/returns/new">
          <Button variant="gold">
            <Plus className="h-4 w-4" /> New Return
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-0">
          {returns.length === 0 ? (
            <EmptyState
              title="No returns yet"
              description="Jab customer maal wapas kare, Final Bill se return record karein."
              action={
                <Link href="/admin/returns/new">
                  <Button variant="gold">Create Return</Button>
                </Link>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left text-xs text-gray-500 uppercase">
                    <th className="py-3 px-4">Return ID</th>
                    <th className="py-3 px-4">Bill</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Items</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4">Refund</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {returns.map((r) => (
                    <tr key={r._id} className="border-b last:border-0 hover:bg-gray-50/50">
                      <td className="py-3 px-4 font-medium text-gold">{r.returnId}</td>
                      <td className="py-3 px-4">
                        <Link
                          href={`/admin/dispatch/${r.dispatchMongoId}`}
                          className="text-navy hover:text-gold hover:underline"
                        >
                          {r.finalBillId || r.dispatchId}
                        </Link>
                      </td>
                      <td className="py-3 px-4">{r.customerName}</td>
                      <td className="py-3 px-4 text-gray-600">
                        {r.items.length} product{r.items.length !== 1 ? "s" : ""}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-red-600">
                        {formatCurrency(r.refundAmount)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="rounded-full bg-navy/5 px-2 py-0.5 text-xs text-navy">
                          {REFUND_LABELS[r.refundMethod] || r.refundMethod}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-500">{formatDateTime(r.returnDate)}</td>
                      <td className="py-3 px-4">
                        <Link href={`/admin/returns/${r._id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      )}

      <p className="text-xs text-gray-400 text-center">{total} return(s) total</p>
    </div>
  );
}
