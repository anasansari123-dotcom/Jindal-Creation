"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pagination } from "@/components/ui/pagination";
import { PageLoader } from "@/components/ui/loading";
import { StatusBadge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  DollarSign,
  ShoppingCart,
  Package,
  Box,
  Wallet,
  AlertTriangle,
} from "lucide-react";

interface SalesStats {
  totalSales: number;
  totalOrders: number;
  totalPieces: number;
  totalBoxes: number;
  totalAdvance: number;
  totalPending: number;
}

interface Order {
  _id: string;
  orderId: string;
  customerName: string;
  total: number;
  advance: number;
  pending: number;
  paymentStatus: string;
  status: string;
  fulfillmentLabel: string;
  orderDate: string;
  salespersonName: string;
  href: string;
}

const statCards = [
  { key: "totalSales", label: "Total Sales", icon: DollarSign, format: "currency" },
  { key: "totalOrders", label: "Orders", icon: ShoppingCart, format: "number" },
  { key: "totalPieces", label: "Pieces Sold", icon: Package, format: "number" },
  { key: "totalBoxes", label: "Boxes Sold", icon: Box, format: "number" },
  { key: "totalAdvance", label: "Customer Paid (Period)", icon: Wallet, format: "currency" },
  { key: "totalPending", label: "Bill Pending (Period)", icon: AlertTriangle, format: "currency" },
] as const;

export default function SalesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [stats, setStats] = useState<SalesStats | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("today");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const applyFilters = useCallback(
    (patch: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined || value === "") params.delete(key);
        else params.set(key, value);
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, pathname, router]
  );

  useEffect(() => {
    const f = searchParams.get("filter");
    if (f && ["today", "yesterday", "week", "month", "custom"].includes(f)) {
      setFilter(f);
    } else {
      setFilter("today");
    }
    setStartDate(searchParams.get("startDate") || "");
    setEndDate(searchParams.get("endDate") || "");
    setPage(parseInt(searchParams.get("page") || "1", 10));
  }, [searchParams]);

  const fetchSales = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ filter, page: String(page) });
    if (filter === "custom") {
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
    }
    const res = await fetch(`/api/sales?${params}`);
    const data = await res.json();
    setStats(data.stats || null);
    setOrders(data.orders || []);
    setTotalPages(data.pagination?.totalPages || 1);
    setTotal(data.pagination?.total || 0);
    setLoading(false);
  }, [filter, startDate, endDate, page]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  const formatValue = (key: string, format: string) => {
    if (!stats) return "-";
    const val = stats[key as keyof SalesStats];
    return format === "currency" ? formatCurrency(val) : val.toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-navy">Sales</h1>
          <p className="text-sm text-gray-500">Track sales performance</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Select
            value={filter}
            onChange={(e) => applyFilters({ filter: e.target.value, page: "1" })}
            className="w-full sm:w-40"
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="custom">Custom Range</option>
          </Select>
          {filter === "custom" && (
            <>
              <div>
                <Label className="sr-only">Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) =>
                    applyFilters({ filter: "custom", startDate: e.target.value, page: "1" })
                  }
                />
              </div>
              <div>
                <Label className="sr-only">End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) =>
                    applyFilters({ filter: "custom", endDate: e.target.value, page: "1" })
                  }
                />
              </div>
            </>
          )}
        </div>
      </div>

      {loading || !stats ? (
        <PageLoader />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {statCards.map(({ key, label, icon: Icon, format }) => (
              <Card key={key}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500">{label}</p>
                      <p className="text-xl font-bold text-navy mt-1">
                        {formatValue(key, format)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-gold/10 p-2">
                      <Icon className="h-5 w-5 text-gold" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Sales Bills</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-3 font-medium">Order ID</th>
                      <th className="pb-3 font-medium">Customer</th>
                      <th className="pb-3 font-medium">Total</th>
                      <th className="pb-3 font-medium">Customer Paid</th>
                      <th className="pb-3 font-medium">Pending</th>
                      <th className="pb-3 font-medium">Payment</th>
                      <th className="pb-3 font-medium">Bill Stage</th>
                      <th className="pb-3 font-medium">Date</th>
                      <th className="pb-3 font-medium">Salesperson</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order._id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-3">
                          <Link href={order.href} className="text-gold hover:underline font-medium">
                            {order.orderId}
                          </Link>
                        </td>
                        <td className="py-3">{order.customerName}</td>
                        <td className="py-3">{formatCurrency(order.total)}</td>
                        <td className="py-3">{formatCurrency(order.advance)}</td>
                        <td className="py-3">{formatCurrency(order.pending)}</td>
                        <td className="py-3"><StatusBadge status={order.paymentStatus} /></td>
                        <td className="py-3"><StatusBadge status={order.fulfillmentLabel} /></td>
                        <td className="py-3 text-gray-500">{formatDate(order.orderDate)}</td>
                        <td className="py-3 text-gray-500">{order.salespersonName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={page}
                totalPages={totalPages}
                total={total}
                onPageChange={(p) => applyFilters({ page: String(p) })}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
