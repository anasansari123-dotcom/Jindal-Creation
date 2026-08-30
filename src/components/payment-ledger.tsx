"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  type PaymentSummary,
  getPaymentStatusLabel,
} from "@/lib/payment-ledger";
import Link from "next/link";

interface PaymentLedgerProps {
  summary: PaymentSummary;
  customerName?: string;
  customerId?: string;
  showLedger?: boolean;
  showSummary?: boolean;
  highlightBillId?: string;
}

export function PaymentSummaryCard({
  summary,
  customerName,
  customerId,
  showLedger = true,
  showSummary = true,
  highlightBillId,
}: PaymentLedgerProps) {
  const statusLabel = getPaymentStatusLabel(summary);

  return (
    <div className="space-y-4">
      {showSummary && (
      <Card className="border-2 border-gold/30 bg-gradient-to-br from-white to-gold/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-navy">
            Bill & Payment Summary
            {customerName && (
              <span className="block text-sm font-normal text-gray-500 mt-1">
                {customerName} {customerId && `· ${customerId}`}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4">
            <div className="rounded-lg bg-navy/5 p-4 text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Total Bill Amount</p>
              <p className="text-2xl font-bold text-navy mt-1">
                {formatCurrency(summary.totalBillAmount)}
              </p>
              <p className="text-xs text-gray-400 mt-1">{summary.totalOrders} bill(s)</p>
            </div>
            <div className="rounded-lg bg-green-50 p-4 text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Customer Paid</p>
              <p className="text-2xl font-bold text-green-700 mt-1">
                {formatCurrency(summary.totalClientPaid)}
              </p>
              <p className="text-xs text-green-600 mt-1">
                {summary.totalClientPaid > 0 ? "✓ Payment received" : "No payment yet"}
              </p>
            </div>
            <div className="rounded-lg bg-red-50 p-4 text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Pending Amount</p>
              <p className="text-2xl font-bold text-red-600 mt-1">
                {formatCurrency(summary.totalPending)}
              </p>
              <p className="text-xs text-red-500 mt-1">
                {summary.hasPending ? "⚠ Payment pending" : "✓ No pending"}
              </p>
            </div>
            <div className="rounded-lg bg-gold/10 p-4 text-center border border-gold/20">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Advance</p>
              <p className="text-2xl font-bold text-gold mt-1">
                {formatCurrency(summary.creditBalance || 0)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {(summary.creditBalance || 0) > 0 ? "Account me advance" : "No extra credit"}
              </p>
            </div>
          </div>

          {/* Clear calculation formula */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm">
            <p className="font-medium text-navy mb-2">Calculation:</p>
            <div className="flex flex-wrap items-center gap-2 font-mono text-base">
              <span className="text-navy font-semibold">{formatCurrency(summary.totalBillAmount)}</span>
              <span className="text-gray-400">(Bill)</span>
              <span className="text-gray-400">−</span>
              <span className="text-green-700 font-semibold">{formatCurrency(summary.totalClientPaid)}</span>
              <span className="text-gray-400">(Paid)</span>
              <span className="text-gray-400">=</span>
              <span className={`font-bold ${summary.hasPending ? "text-red-600" : "text-green-700"}`}>
                {formatCurrency(summary.totalPending)}
              </span>
              <span className="text-gray-400">(Net Pending)</span>
            </div>
            {(summary.creditAppliedToPending || 0) > 0 && (
              <p className="text-xs text-gold mt-2">
                Advance credit {formatCurrency(summary.creditAppliedToPending!)} pending par adjust hua
                — bacha advance {formatCurrency(summary.creditBalance || 0)}
              </p>
            )}
            <div className="mt-3 flex items-center gap-2">
              <span className="text-gray-500">Status:</span>
              <StatusBadge
                status={
                  summary.isFullyPaid ? "PAID" : summary.totalClientPaid > 0 ? "PARTIAL" : "UNPAID"
                }
              />
              <span className="text-sm text-gray-600">{statusLabel}</span>
            </div>
          </div>
        </CardContent>
      </Card>
      )}

      {showLedger && summary.ledger.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bill-wise Payment History (Cumulative)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="table-scroll">
              <table className="w-full min-w-[1100px] text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500 bg-gray-50">
                    <th className="p-2 font-medium">Date</th>
                    <th className="p-2 font-medium">Type</th>
                    <th className="p-2 font-medium">Bill ID</th>
                    <th className="p-2 font-medium text-right">Bill Amount</th>
                    <th className="p-2 font-medium text-right">Customer Paid</th>
                    <th className="p-2 font-medium text-right">Pending</th>
                    <th className="p-2 font-medium text-right bg-navy/5">Total Bills</th>
                    <th className="p-2 font-medium text-right bg-green-50">Total Paid</th>
                    <th className="p-2 font-medium text-right bg-red-50">Total Pending</th>
                    <th className="p-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[...summary.ledger].reverse().map((row, i) => {
                    const isCurrent = highlightBillId && row.billId === highlightBillId;
                    return (
                    <tr
                      key={i}
                      className={`border-b hover:bg-gray-50 ${isCurrent ? "bg-gold/10 ring-1 ring-gold/30" : ""}`}
                    >
                      <td className="p-2 text-gray-600">{formatDate(row.date)}</td>
                      <td className="p-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          row.billType === "Final" ? "bg-green-100 text-green-800" :
                          row.billType === "Dispatch" ? "bg-blue-100 text-blue-800" :
                          row.billType === "Confirm" ? "bg-green-100 text-green-800" :
                          "bg-gray-100 text-gray-700"
                        }`}>
                          {row.billType}
                        </span>
                      </td>
                      <td className="p-2">
                        {row.linkPath ? (
                          <Link href={row.linkPath} className="text-gold hover:underline font-medium">
                            {row.billId}
                          </Link>
                        ) : row.orderId ? (
                          <Link href={`/admin/orders/${row.orderId}`} className="text-gold hover:underline font-medium">
                            {row.billId}
                          </Link>
                        ) : row.dispatchId ? (
                          <Link href={`/admin/dispatch/${row.dispatchId}`} className="text-gold hover:underline font-medium">
                            {row.billId}
                          </Link>
                        ) : (
                          <span className="font-medium text-gold">{row.billId}</span>
                        )}
                      </td>
                      <td className="p-2 text-right font-medium text-navy">
                        {formatCurrency(row.billAmount)}
                      </td>
                      <td className="p-2 text-right text-green-700">
                        {formatCurrency(row.clientPaid)}
                      </td>
                      <td className="p-2 text-right text-red-600">
                        {formatCurrency(row.pending)}
                      </td>
                      <td className="p-2 text-right bg-navy/5 font-semibold text-navy">
                        {formatCurrency(row.cumulativeBillTotal)}
                      </td>
                      <td className="p-2 text-right bg-green-50 font-semibold text-green-700">
                        {formatCurrency(row.cumulativeClientPaid)}
                      </td>
                      <td className="p-2 text-right bg-red-50 font-semibold text-red-600">
                        {formatCurrency(row.cumulativePending)}
                      </td>
                      <td className="p-2">
                        <StatusBadge status={row.paymentStatus} />
                        {isCurrent && (
                          <span className="ml-1 text-xs text-gold font-medium">← Current</span>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-navy/20 bg-navy/5 font-bold">
                    <td className="p-3" colSpan={3}>Grand Total</td>
                    <td className="p-3 text-right text-navy">{formatCurrency(summary.totalBillAmount)}</td>
                    <td className="p-3 text-right text-green-700">{formatCurrency(summary.totalClientPaid)}</td>
                    <td className="p-3 text-right text-red-600">{formatCurrency(summary.totalPending)}</td>
                    <td className="p-3 text-right text-navy">{formatCurrency(summary.totalBillAmount)}</td>
                    <td className="p-3 text-right text-green-700">{formatCurrency(summary.totalClientPaid)}</td>
                    <td className="p-3 text-right text-red-600">{formatCurrency(summary.totalPending)}</td>
                    <td className="p-3">
                      {summary.hasPending ? (
                        <span className="text-red-600 text-sm">Pending</span>
                      ) : (
                        <span className="text-green-700 text-sm">All Paid ✓</span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/** Compact single-bill breakdown for order/dispatch/confirm pages */
export function SingleBillPaymentBox({
  billAmount,
  clientPaid,
  pending,
  paymentStatus,
  label = "Bill Payment Details",
}: {
  billAmount: number;
  clientPaid: number;
  pending: number;
  paymentStatus: string;
  label?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
      <p className="font-medium text-navy text-sm">{label}</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-xs text-gray-500">Bill Amount</p>
          <p className="text-lg font-bold text-navy">{formatCurrency(billAmount)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Customer Paid</p>
          <p className="text-lg font-bold text-green-700">{formatCurrency(clientPaid)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Pending</p>
          <p className="text-lg font-bold text-red-600">{formatCurrency(pending)}</p>
        </div>
      </div>
      <div className="text-center text-sm font-mono border-t pt-2">
        {formatCurrency(billAmount)} − {formatCurrency(clientPaid)} ={" "}
        <span className={pending > 0 ? "text-red-600 font-bold" : "text-green-700 font-bold"}>
          {formatCurrency(pending)}
        </span>
      </div>
      <div className="flex justify-center">
        <StatusBadge status={paymentStatus} />
      </div>
    </div>
  );
}
