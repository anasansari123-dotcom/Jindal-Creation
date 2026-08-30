"use client";

import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader, EmptyState } from "@/components/ui/loading";
import { formatCurrency } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { useEffect, useState } from "react";
import { Select } from "@/components/ui/select";
import Link from "next/link";
import {
  DollarSign,
  ShoppingCart,
  Package,
  Box,
  Wallet,
  AlertTriangle,
  Warehouse,
} from "lucide-react";

const DashboardChart = dynamic(
  () =>
    import("@/components/admin/dashboard-chart").then((m) => m.DashboardChart),
  {
    loading: () => <PageLoader message="Loading chart" />,
    ssr: false,
  }
);

interface DashboardData {
  periodLabel?: string;
  stats: {
    todaySales: number;
    todayOrders: number;
    todayPieces: number;
    todayBoxes: number;
    periodCashPaid: number;
    periodBillPending: number;
    inventoryValue: number;
    lowStockCount: number;
  };
  portfolio?: {
    totalAdvance: number;
    totalPending: number;
    totalPaid: number;
  };
  recentOrders: Array<{
    _id: string;
    orderId: string;
    customerName: string;
    total: number;
    paymentStatus: string;
    status: string;
    orderDate: string;
    href: string;
  }>;
  lowStockProducts: Array<{
    _id: string;
    productId: string;
    name: string;
    currentStock: number;
    minimumStock: number;
    stockStatus: string;
  }>;
  chartData: Array<{ date: string; sales: number }>;
}

function periodToFilter(period: string) {
  if (period === "today") return "today";
  if (period === "30days") return "month";
  return "week";
}

function statCardLinks(period: string) {
  const filter = periodToFilter(period);
  return {
    todaySales: `/admin/sales?filter=${filter}`,
    todayOrders: `/admin/dispatch`,
    todayPieces: `/admin/sales?filter=${filter}`,
    todayBoxes: `/admin/sales?filter=${filter}`,
    periodCashPaid: `/admin/sales?filter=${filter}`,
    periodBillPending: `/admin/sales?filter=${filter}`,
    inventoryValue: `/admin/inventory`,
    lowStockCount: `/admin/inventory?status=${encodeURIComponent("Low Stock")}`,
  } as const;
}

function statCardsForPeriod(periodLabel?: string) {
  const prefix = periodLabel && periodLabel !== "Today" ? periodLabel : "Today's";
  return [
    { key: "todaySales", label: `${prefix} Sales`, icon: DollarSign, format: "currency" },
    { key: "todayOrders", label: `${prefix} Bills`, icon: ShoppingCart, format: "number" },
    { key: "todayPieces", label: "Loose Pcs Sold", icon: Package, format: "number" },
    { key: "todayBoxes", label: "Boxes Sold", icon: Box, format: "number" },
    { key: "periodCashPaid", label: `${prefix} Customer Paid`, icon: Wallet, format: "currency" },
    { key: "periodBillPending", label: `${prefix} Bill Pending`, icon: AlertTriangle, format: "currency" },
    { key: "inventoryValue", label: "Inventory Value", icon: Warehouse, format: "currency" },
    { key: "lowStockCount", label: "Low Stock Products", icon: AlertTriangle, format: "number" },
  ] as const;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [portfolio, setPortfolio] = useState<DashboardData["portfolio"]>();
  const [period, setPeriod] = useState("7days");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/portfolio/summary")
      .then((r) => r.json())
      .then((d) => {
        if (d.portfolio) {
          setPortfolio({
            totalAdvance: d.portfolio.totalAdvance,
            totalPending: d.portfolio.totalPending,
            totalPaid: d.portfolio.totalPaid,
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`/api/dashboard?period=${period}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok || !d.stats) {
          setError(d.error || "Dashboard load nahi ho paya");
          setData(null);
          return;
        }
        setData(d);
      })
      .catch(() => setError("Network error — dubara try karein"))
      .finally(() => setLoading(false));
  }, [period]);

  if (loading) return <PageLoader />;
  if (error || !data) {
    return (
      <EmptyState
        title="Dashboard unavailable"
        description={error || "Data load nahi ho paya"}
      />
    );
  }

  const links = statCardLinks(period);

  const formatValue = (key: string, format: string) => {
    const val = data.stats[key as keyof typeof data.stats];
    return format === "currency" ? formatCurrency(val) : val.toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold text-navy">Dashboard</h1>
        <p className="text-sm text-gray-500">Welcome to Jindal Creation CRM</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCardsForPeriod(data.periodLabel).map(({ key, label, icon: Icon, format }) => (
          <Link key={key} href={links[key]} className="block">
            <Card className="h-full transition-all hover:shadow-md hover:border-gold/40 cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className="text-xl font-bold text-navy mt-1">
                      {formatValue(key, format)}
                    </p>
                    <p className="text-xs text-gray-400 mt-2">Click karke dekhein →</p>
                  </div>
                  <div className="rounded-lg bg-gold/10 p-2">
                    <Icon className="h-5 w-5 text-gold" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {portfolio && (
        <Card className="border-navy/10 bg-navy/[0.02]">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-gray-500 mb-3">All Customers — Portfolio Summary</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <Link href="/admin/payments?filter=credit" className="rounded-lg bg-gold/10 border border-gold/20 p-3 hover:border-gold/40 transition-colors">
                <p className="text-xs text-gray-500">Account Advance</p>
                <p className="text-lg font-bold text-gold">{formatCurrency(portfolio.totalAdvance)}</p>
              </Link>
              <Link href="/admin/payments?filter=pending" className="rounded-lg bg-red-50 border border-red-100 p-3 hover:border-red-200 transition-colors">
                <p className="text-xs text-gray-500">Total Pending</p>
                <p className="text-lg font-bold text-red-600">{formatCurrency(portfolio.totalPending)}</p>
              </Link>
              <Link href="/admin/customers" className="rounded-lg bg-green-50 border border-green-100 p-3 hover:border-green-200 transition-colors">
                <p className="text-xs text-gray-500">Total Customer Paid</p>
                <p className="text-lg font-bold text-green-700">{formatCurrency(portfolio.totalPaid)}</p>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Sales Overview</CardTitle>
            <Select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-32"
            >
              <option value="today">Today</option>
              <option value="7days">7 Days</option>
              <option value="30days">30 Days</option>
            </Select>
          </CardHeader>
          <CardContent>
            <DashboardChart data={data.chartData} />
          </CardContent>
        </Card>

        <Link href={`/admin/inventory?status=${encodeURIComponent("Low Stock")}`}>
          <Card className="h-full transition-all hover:shadow-md hover:border-gold/40 cursor-pointer">
            <CardHeader>
              <CardTitle>Low Stock</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[280px] overflow-y-auto">
                {data.lowStockProducts.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">All stock levels OK</p>
                ) : (
                  data.lowStockProducts.map((p) => (
                    <div key={p._id} className="flex items-center justify-between text-sm">
                      <div>
                        <p className="font-medium text-navy">{p.name}</p>
                        <p className="text-xs text-gray-400">{p.productId}</p>
                      </div>
                      <div className="text-right">
                        <StatusBadge status={p.stockStatus} />
                        <p className="text-xs text-gray-400 mt-1">{p.currentStock} left</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <p className="text-xs text-gray-400 mt-3 text-center">Click karke inventory dekhein →</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Bills</CardTitle>
          <Link
            href={`/admin/dispatch`}
            className="text-sm text-gold hover:underline"
          >
            Sab dekhein →
          </Link>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Recent bills</caption>
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th scope="col" className="pb-3 font-medium">Order ID</th>
                  <th scope="col" className="pb-3 font-medium">Customer</th>
                  <th scope="col" className="pb-3 font-medium">Amount</th>
                  <th scope="col" className="pb-3 font-medium">Payment</th>
                  <th scope="col" className="pb-3 font-medium">Status</th>
                  <th scope="col" className="pb-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {data.recentOrders.map((order) => (
                  <tr key={order._id} className="border-b last:border-0">
                    <td className="py-3">
                      <Link href={order.href} className="text-wood hover:underline font-medium">
                        {order.orderId}
                      </Link>
                    </td>
                    <td className="py-3">{order.customerName}</td>
                    <td className="py-3">{formatCurrency(order.total)}</td>
                    <td className="py-3"><StatusBadge status={order.paymentStatus} /></td>
                    <td className="py-3"><StatusBadge status={(order as { fulfillmentLabel?: string }).fulfillmentLabel || order.status} /></td>
                    <td className="py-3 text-gray-500">{formatDate(order.orderDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
