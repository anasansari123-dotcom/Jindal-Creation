"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchInput } from "@/components/ui/search-input";
import { Pagination } from "@/components/ui/pagination";
import { PageLoader, EmptyState } from "@/components/ui/loading";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/badge";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  Plus,
  Eye,
  Clock,
  CheckCircle2,
  History,
  ChevronDown,
  ChevronUp,
  ShoppingCart,
  CalendarDays,
} from "lucide-react";

type OrderPeriod = "today" | "yesterday" | "week" | "month" | "custom";

interface StatusHistoryEntry {
  status: "PENDING" | "COMPLETED";
  billStatus: "DISPATCH" | "FINAL";
  date: string;
  note: string;
  byName: string;
}

interface OrderEntry {
  _id: string;
  orderId: string;
  displayBillId: string;
  billStatus: "DISPATCH" | "FINAL";
  status: "PENDING" | "COMPLETED";
  customerName: string;
  total: number;
  advance: number;
  pending: number;
  paymentStatus: string;
  orderDate: string;
  completedDate?: string;
  salespersonName: string;
  finalBillId?: string;
  itemCount: number;
  statusHistory: StatusHistoryEntry[];
  href: string;
  fulfillmentLabel?: string;
}

interface DailyGroup {
  date: string;
  label: string;
  pending: number;
  completed: number;
  total: number;
  totalAmount: number;
  orders: OrderEntry[];
}

interface Summary {
  pending: number;
  completed: number;
  total: number;
  totalAmount: number;
  pendingAmount: number;
  completedAmount: number;
}

const PERIOD_OPTIONS: { id: OrderPeriod; label: string }[] = [
  { id: "today", label: "Aaj" },
  { id: "yesterday", label: "Kal" },
  { id: "week", label: "Is Week" },
  { id: "month", label: "Is Month" },
];

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function OrderRow({ order }: { order: OrderEntry }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <tr className="border-b last:border-0 hover:bg-gray-50 align-top">
        <td className="py-3">
          <Link href={order.href} className="text-gold hover:underline font-medium">
            {order.displayBillId}
          </Link>
          <div className="text-xs text-gray-400">{order.orderId}</div>
        </td>
        <td className="py-3">{order.customerName}</td>
        <td className="py-3">{formatCurrency(order.total)}</td>
        <td className="py-3">{formatCurrency(order.pending)}</td>
        <td className="py-3">
          <StatusBadge status={order.paymentStatus} />
        </td>
        <td className="py-3">
          <StatusBadge status={order.fulfillmentLabel || order.status} />
        </td>
        <td className="py-3 text-gray-500 whitespace-nowrap">{formatDate(order.orderDate)}</td>
        <td className="py-3 text-gray-500">{order.salespersonName}</td>
        <td className="py-3">
          <div className="flex gap-1">
            <Link href={order.href}>
              <Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={() => setOpen(!open)} title="History">
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </td>
      </tr>
      {open && (
        <tr className="bg-gray-50/80">
          <td colSpan={9} className="px-4 py-3">
            <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
              <History className="h-3.5 w-3.5" /> Order History
            </p>
            <div className="space-y-2">
              {order.statusHistory.map((h, i) => (
                <div key={i} className="flex flex-wrap items-start gap-2 text-sm">
                  <StatusBadge status={h.status} />
                  <span className="text-gray-600">{formatDateTime(h.date)}</span>
                  <span className="text-navy">{h.note}</span>
                  <span className="text-gray-400">— {h.byName}</span>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function OrdersTable({ orders, emptyTitle }: { orders: OrderEntry[]; emptyTitle?: string }) {
  if (orders.length === 0) {
    return (
      <EmptyState
        title={emptyTitle || "Is period me koi order nahi"}
        description="Dispatch bill banate hi yahan pending me dikhegi"
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-gray-500">
            <th className="pb-3 font-medium">Bill ID</th>
            <th className="pb-3 font-medium">Customer</th>
            <th className="pb-3 font-medium">Total</th>
            <th className="pb-3 font-medium">Pending</th>
            <th className="pb-3 font-medium">Payment</th>
            <th className="pb-3 font-medium">Order Status</th>
            <th className="pb-3 font-medium">Date</th>
            <th className="pb-3 font-medium">Bill By</th>
            <th className="pb-3 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <OrderRow key={order._id} order={order} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function OrdersPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [orders, setOrders] = useState<OrderEntry[]>([]);
  const [dailyGroups, setDailyGroups] = useState<DailyGroup[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [periodLabel, setPeriodLabel] = useState("Aaj");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [period, setPeriod] = useState<OrderPeriod>("today");
  const [customDate, setCustomDate] = useState(todayStr());
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
    const p = searchParams.get("period");
    if (p && ["today", "yesterday", "week", "month", "custom"].includes(p)) {
      setPeriod(p as OrderPeriod);
    } else {
      setPeriod("today");
    }
    setStatus(searchParams.get("status") || "");
    const d = searchParams.get("date");
    if (d) setCustomDate(d);
    setPage(parseInt(searchParams.get("page") || "1", 10));
  }, [searchParams]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      search,
      page: String(page),
      period,
    });
    if (status) params.set("status", status);
    if (period === "custom") params.set("date", customDate);

    const res = await fetch(`/api/orders?${params}`);
    const data = await res.json();
    setOrders(data.orders || []);
    setDailyGroups(data.dailyGroups || []);
    setSummary(data.summary || null);
    setPeriodLabel(data.periodLabel || "Aaj");
    setTotalPages(data.pagination?.totalPages || 1);
    setTotal(data.pagination?.total || 0);
    setLoading(false);
  }, [search, status, period, customDate, page]);

  useEffect(() => {
    const timer = setTimeout(fetchOrders, 300);
    return () => clearTimeout(timer);
  }, [fetchOrders]);

  const toggleOrderFilter = (filter: "pending" | "completed" | "all") => {
    if (filter === "all") {
      applyFilters({ status: undefined, page: "1" });
    } else if (filter === "pending") {
      const next = status === "PENDING" ? undefined : "PENDING";
      applyFilters({ status: next, page: "1" });
    } else {
      const next = status === "COMPLETED" ? undefined : "COMPLETED";
      applyFilters({ status: next, page: "1" });
    }
  };

  const filterListTitle =
    status === "PENDING"
      ? `Pending Orders (${summary?.pending ?? 0}) — Dispatch bills`
      : status === "COMPLETED"
        ? `Completed Orders (${summary?.completed ?? 0}) — Final bills`
        : null;

  const showDailyBreakdown = (period === "week" || period === "month") && !status;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-navy">Bills & Orders</h1>
          <p className="text-sm text-gray-500">
            Dispatch Bill = Pending stage · Final Bill = Complete ·{" "}
            <Link href="/admin/dispatch" className="text-gold hover:underline">
              All bills list
            </Link>
          </p>
        </div>
        <Link href="/admin/dispatch/new">
          <Button variant="gold">
            <Plus className="h-4 w-4" /> Create Bill (New Order)
          </Button>
        </Link>
      </div>

      {/* Date period filter */}
      <Card className="border-gold/20">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-navy">
            <CalendarDays className="h-4 w-4 text-gold" />
            Date Filter — <span className="text-gold">{periodLabel}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {PERIOD_OPTIONS.map((opt) => (
              <Button
                key={opt.id}
                variant={period === opt.id ? "gold" : "outline"}
                size="sm"
                onClick={() => applyFilters({ period: opt.id, page: "1" })}
              >
                {opt.label}
              </Button>
            ))}
            <Button
              variant={period === "custom" ? "gold" : "outline"}
              size="sm"
              onClick={() => applyFilters({ period: "custom", page: "1" })}
            >
              Custom Date
            </Button>
            {period === "custom" && (
              <input
                type="date"
                value={customDate}
                onChange={(e) =>
                  applyFilters({ period: "custom", date: e.target.value, page: "1" })
                }
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Top summary boxes — click to filter list */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button type="button" onClick={() => toggleOrderFilter("pending")} className="text-left">
            <Card className={cn(
              "transition-all cursor-pointer hover:shadow-md h-full",
              status === "PENDING"
                ? "border-2 border-amber-500 ring-2 ring-amber-200 bg-amber-50/50"
                : "border-2 border-amber-200 hover:border-amber-400"
            )}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-amber-800">Pending Orders</p>
                    <p className="text-xs text-gray-500 mt-0.5">{periodLabel} · Dispatch bills</p>
                  </div>
                  <div className="rounded-full bg-amber-100 p-2 shrink-0">
                    <Clock className="h-5 w-5 text-amber-700" />
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4 border-t border-amber-100 pt-4">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Orders</p>
                    <p className="text-3xl font-bold text-navy tabular-nums leading-tight mt-1">
                      {summary.pending}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Amount</p>
                    <p className="text-xl font-bold text-amber-800 tabular-nums leading-tight mt-1">
                      {formatCurrency(summary.pendingAmount)}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-3">Click karke list dekhein →</p>
              </CardContent>
            </Card>
          </button>

          <button type="button" onClick={() => toggleOrderFilter("completed")} className="text-left">
            <Card className={cn(
              "transition-all cursor-pointer hover:shadow-md h-full",
              status === "COMPLETED"
                ? "border-2 border-green-500 ring-2 ring-green-200 bg-green-50/50"
                : "border-2 border-green-200 hover:border-green-400"
            )}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-green-800">Completed Orders</p>
                    <p className="text-xs text-gray-500 mt-0.5">{periodLabel} · Final bills</p>
                  </div>
                  <div className="rounded-full bg-green-100 p-2 shrink-0">
                    <CheckCircle2 className="h-5 w-5 text-green-700" />
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4 border-t border-green-100 pt-4">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Orders</p>
                    <p className="text-3xl font-bold text-navy tabular-nums leading-tight mt-1">
                      {summary.completed}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Amount</p>
                    <p className="text-xl font-bold text-green-700 tabular-nums leading-tight mt-1">
                      {formatCurrency(summary.completedAmount)}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-3">Click karke list dekhein →</p>
              </CardContent>
            </Card>
          </button>

          <button type="button" onClick={() => toggleOrderFilter("all")} className="text-left">
            <Card className={cn(
              "transition-all cursor-pointer hover:shadow-md h-full",
              status === ""
                ? "border-2 border-navy ring-2 ring-navy/20 bg-navy/10"
                : "border-2 border-navy/20 bg-navy/5 hover:border-navy/40"
            )}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-navy">Total Orders</p>
                    <p className="text-xs text-gray-500 mt-0.5">{periodLabel} · Pending + Complete</p>
                  </div>
                  <div className="rounded-full bg-navy/10 p-2 shrink-0">
                    <ShoppingCart className="h-5 w-5 text-navy" />
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4 border-t border-navy/10 pt-4">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Orders</p>
                    <p className="text-3xl font-bold text-navy tabular-nums leading-tight mt-1">
                      {summary.total}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Amount</p>
                    <p className="text-xl font-bold text-navy tabular-nums leading-tight mt-1">
                      {formatCurrency(summary.totalAmount)}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-3">Click karke sab orders dekhein →</p>
              </CardContent>
            </Card>
          </button>
        </div>
      )}

      <Card>
        <CardHeader>
          {filterListTitle && (
            <CardTitle className="text-lg mb-3 flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-gold" />
              {filterListTitle}
              <span className="text-sm font-normal text-gray-500">— {periodLabel}</span>
            </CardTitle>
          )}
          <div className="flex flex-col sm:flex-row gap-3">
            <SearchInput
              value={search}
              onChange={(v) => { setSearch(v); setPage(1); }}
              placeholder="Bill ID, customer search..."
            />
            <Select
              value={status}
              onChange={(e) =>
                applyFilters({ status: e.target.value || undefined, page: "1" })
              }
              className="w-full sm:w-52"
            >
              <option value="">All Orders</option>
              <option value="PENDING">Sirf Pending</option>
              <option value="COMPLETED">Sirf Complete</option>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <PageLoader />
          ) : showDailyBreakdown && dailyGroups.length > 0 ? (
            <div className="space-y-8">
              {dailyGroups.map((group) => (
                <div key={group.date}>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b">
                    <CardTitle className="text-base">{group.label}</CardTitle>
                    <div className="flex gap-3 text-xs">
                      <span className="text-amber-700 font-medium">Pending: {group.pending}</span>
                      <span className="text-green-700 font-medium">Complete: {group.completed}</span>
                      <span className="text-navy font-bold">Total: {group.total}</span>
                      <span className="text-gray-500">{formatCurrency(group.totalAmount)}</span>
                    </div>
                  </div>
                  <OrdersTable orders={group.orders} />
                </div>
              ))}
              <Pagination
                page={page}
                totalPages={totalPages}
                total={total}
                onPageChange={(p) => applyFilters({ page: String(p) })}
              />
            </div>
          ) : (
            <>
              <OrdersTable orders={orders} emptyTitle={`${periodLabel} — koi order nahi`} />
              <Pagination
                page={page}
                totalPages={totalPages}
                total={total}
                onPageChange={(p) => applyFilters({ page: String(p) })}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
