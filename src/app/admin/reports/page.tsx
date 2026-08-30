"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLoader } from "@/components/ui/loading";
import { StatusBadge } from "@/components/ui/badge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

type ReportTab = "sales" | "inventory" | "customers" | "payments" | "oversales";

export default function ReportsPage() {
  const [tab, setTab] = useState<ReportTab>("sales");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ type: tab });
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    fetch(`/api/reports?${params}`)
      .then((r) => r.json())
      .then((d) => setReport(d.report || null))
      .finally(() => setLoading(false));
  }, [tab, startDate, endDate]);

  const tabs: { id: ReportTab; label: string }[] = [
    { id: "sales", label: "Sales" },
    { id: "inventory", label: "Inventory" },
    { id: "oversales", label: "Bina Purchase Sale" },
    { id: "customers", label: "Customers" },
    { id: "payments", label: "Payments" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold text-navy">Reports</h1>
        <p className="text-sm text-gray-500">Business analytics and insights</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
        <div className="flex gap-1 border-b w-full sm:w-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                tab === t.id
                  ? "border-gold text-navy"
                  : "border-transparent text-gray-500 hover:text-navy"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex gap-3">
          <div>
            <Label className="text-xs">From</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
      </div>

      {loading ? (
        <PageLoader />
      ) : !report ? (
        <p className="text-gray-500 text-center py-8">No report data available</p>
      ) : (
        <>
          {tab === "sales" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-gray-500">Total Sales</p>
                    <p className="text-2xl font-bold text-navy">{formatCurrency(report.totalSales as number)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-gray-500">Total Orders</p>
                    <p className="text-2xl font-bold text-navy">{report.totalOrders as number}</p>
                  </CardContent>
                </Card>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <ReportTable title="By Customer" headers={["Customer", "Orders", "Total"]} rows={
                  (report.byCustomer as Array<{ name: string; count: number; total: number }>)?.map((r) => [
                    r.name, r.count, formatCurrency(r.total),
                  ]) || []
                } />
                <ReportTable title="By Product" headers={["Product", "Qty", "Total"]} rows={
                  (report.byProduct as Array<{ name: string; qty: number; total: number }>)?.map((r) => [
                    r.name, r.qty, formatCurrency(r.total),
                  ]) || []
                } />
                <ReportTable title="By Salesperson" headers={["Salesperson", "Orders", "Total"]} rows={
                  (report.byAdmin as Array<{ name: string; count: number; total: number }>)?.map((r) => [
                    r.name, r.count, formatCurrency(r.total),
                  ]) || []
                } />
              </div>
            </div>
          )}

          {tab === "inventory" && (
            <div className="space-y-6">
              <Card>
                <CardHeader><CardTitle>Low Stock Products</CardTitle></CardHeader>
                <CardContent>
                  <ReportTable
                    title=""
                    headers={["Product ID", "Name", "Stock", "Status"]}
                    rows={
                      (report.lowStock as Array<{ productId: string; name: string; currentStock: number; minimumStock: number }>)?.map((p) => [
                        p.productId,
                        p.name,
                        p.currentStock,
                        <StatusBadge key={p.productId} status={p.currentStock <= 0 ? "Out of Stock" : "Low Stock"} />,
                      ]) || []
                    }
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Recent Movements</CardTitle></CardHeader>
                <CardContent>
                  <ReportTable
                    title=""
                    headers={["Date", "Product", "Type", "Qty", "By"]}
                    rows={
                      (report.movements as Array<{ createdAt: string; productName: string; type: string; quantity: number; createdByName: string }>)?.map((m) => [
                        formatDateTime(m.createdAt), m.productName, m.type.replace(/_/g, " "), m.quantity, m.createdByName,
                      ]) || []
                    }
                  />
                </CardContent>
              </Card>
            </div>
          )}

          {tab === "oversales" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-gray-500">Total Entries (bina purchase)</p>
                    <p className="text-2xl font-bold text-navy">{report.totalEntries as number}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-gray-500">Total Shortfall Qty</p>
                    <p className="text-2xl font-bold text-red-600">{report.totalShortfall as number}</p>
                  </CardContent>
                </Card>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>Bina Purchase ke Sell — Detail</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
                    Ye woh sales hain jahan stock kam tha ya 0 tha — Final Bill par stock (-) minus me gaya.
                    Purchase / Stock In ke baad ye list kam hoti jayegi.
                  </p>
                  <ReportTable
                    title=""
                    headers={[
                      "Date",
                      "Product",
                      "Bill",
                      "Customer",
                      "Sold Qty",
                      "Bina Purchase",
                      "Stock Before",
                      "Stock After",
                      "By",
                    ]}
                    rows={
                      (report.items as Array<{
                        date: string;
                        productName: string;
                        productCode: string;
                        billId?: string;
                        customerName: string;
                        qtySold: number;
                        shortfallQty: number;
                        stockBefore: number;
                        stockAfter: number;
                        sellingUnit?: string;
                        createdByName: string;
                      }>)?.map((row) => [
                        formatDateTime(row.date),
                        `${row.productName} (${row.productCode})`,
                        row.billId || "—",
                        row.customerName,
                        `${row.qtySold}${row.sellingUnit === "kg" ? " kg" : " pcs"}`,
                        <span key={`sf-${row.productCode}`} className="font-bold text-red-600">
                          (-) {row.shortfallQty}
                          {row.sellingUnit === "kg" ? " kg" : " pcs"}
                        </span>,
                        row.stockBefore,
                        <span key={`after-${row.productCode}`} className={row.stockAfter < 0 ? "text-red-600 font-bold" : ""}>
                          {row.stockAfter}
                        </span>,
                        row.createdByName,
                      ]) || []
                    }
                  />
                </CardContent>
              </Card>
            </div>
          )}

          {tab === "customers" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-gray-500">Total Customers</p>
                  <p className="text-2xl font-bold text-navy">{report.totalCustomers as number}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-gray-500">Active Customers</p>
                  <p className="text-2xl font-bold text-navy">{report.activeCustomers as number}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-gray-500">With Pending</p>
                  <p className="text-2xl font-bold text-navy">
                    {(report.pendingCustomers as unknown[])?.length || 0}
                  </p>
                </CardContent>
              </Card>
              <div className="sm:col-span-3">
                <Card>
                  <CardHeader><CardTitle>Pending by Customer</CardTitle></CardHeader>
                  <CardContent>
                    <ReportTable
                      title=""
                      headers={["Customer", "Pending Amount"]}
                      rows={
                        (report.pendingCustomers as Array<{ name: string; pending: number }>)?.map((c) => [
                          c.name, formatCurrency(c.pending),
                        ]) || []
                      }
                    />
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {tab === "payments" && (
            <div className="space-y-6">
              <p className="text-xs text-gray-500">
                {(report.scope as string) === "period"
                  ? "Selected date range — bills created in this period"
                  : "All customers — same totals as Customers & Payments pages"}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-gray-500">Customer Paid</p>
                    <p className="text-2xl font-bold text-navy">{formatCurrency((report.totalCashPaid ?? report.totalPaid) as number)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-gray-500">
                      {(report.scope as string) === "period" ? "Advance Saved (Period)" : "Account Advance"}
                    </p>
                    <p className="text-2xl font-bold text-navy">{formatCurrency(report.totalAdvance as number)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-gray-500">Bill Pending</p>
                    <p className="text-2xl font-bold text-navy">{formatCurrency(report.totalPending as number)}</p>
                  </CardContent>
                </Card>
              </div>
              <Card>
                <CardHeader><CardTitle>Payment Records</CardTitle></CardHeader>
                <CardContent>
                  <ReportTable
                    title=""
                    headers={["Payment ID", "Order", "Customer", "Amount", "Method", "Date"]}
                    rows={
                      (report.payments as Array<{ paymentId: string; orderCode: string; customerName: string; amount: number; method: string; date: string }>)?.map((p) => [
                        p.paymentId, p.orderCode, p.customerName, formatCurrency(p.amount), p.method, formatDateTime(p.date),
                      ]) || []
                    }
                  />
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ReportTable({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: string[];
  rows: (string | number | React.ReactNode)[][];
}) {
  return (
    <Card>
      {title && (
        <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      )}
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">No data</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  {headers.map((h) => (
                    <th key={h} className="pb-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b last:border-0">
                    {row.map((cell, j) => (
                      <td key={j} className="py-3">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
