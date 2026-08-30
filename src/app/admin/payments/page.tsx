"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { PageLoader, EmptyState } from "@/components/ui/loading";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { Plus, Eye, Users } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PAYMENT_METHODS } from "@/lib/constants";

type CustomerFilter = "paid" | "pending" | "credit" | null;

interface Payment {
  _id: string;
  paymentId: string;
  orderCode?: string;
  customerName: string;
  amount: number;
  date: string;
  method: string;
  creditAdded?: number;
  referenceNumber?: string;
  addedByName: string;
  notes?: string;
}

interface CustomerRow {
  _id: string;
  customerId: string;
  name: string;
  companyName?: string;
  phone?: string;
  city?: string;
  totalAdvance: number;
  totalPending: number;
  totalPurchase?: number;
  creditBalance?: number;
  paymentStatus: string;
}

interface CustomerOption {
  _id: string;
  name: string;
  customerId: string;
  totalPending: number;
  creditBalance?: number;
}

const FILTER_LABELS: Record<Exclude<CustomerFilter, null>, string> = {
  paid: "Fully Paid Clients",
  pending: "Pending Payment Clients",
  credit: "Advance Clients",
};

export default function PaymentsPage() {
  const searchParams = useSearchParams();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [allCustomers, setAllCustomers] = useState<CustomerRow[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeFilter, setActiveFilter] = useState<CustomerFilter>(() => {
    const f = searchParams.get("filter");
    if (f === "paid" || f === "pending" || f === "credit") return f;
    return null;
  });
  const [paymentSummary, setPaymentSummary] = useState({
    paidClients: 0,
    pendingClients: 0,
    creditClients: 0,
    totalAdvance: 0,
    totalPending: 0,
    totalCredit: 0,
  });

  const [form, setForm] = useState({
    customerId: "",
    amount: "",
    method: "Cash",
    date: "",
    referenceNumber: "",
    notes: "",
  });

  const fetchSummary = useCallback(async () => {
    const res = await fetch("/api/customers?all=true&includePortfolio=true");
    const data = await res.json();
    const clients: CustomerRow[] = data.customers || [];
    const portfolio = data.portfolio;
    setAllCustomers(clients);
    setPaymentSummary({
      paidClients: portfolio?.paidClients ?? clients.filter((c) => c.paymentStatus === "Fully Paid").length,
      pendingClients: portfolio?.pendingClients ?? clients.filter((c) => c.paymentStatus === "Pending").length,
      creditClients: portfolio?.advanceClients ?? clients.filter((c) => (c.creditBalance || 0) > 0).length,
      totalAdvance: portfolio?.totalPaid ?? clients.reduce((s, c) => s + (c.totalAdvance || 0), 0),
      totalPending: portfolio?.totalPending ?? clients.reduce((s, c) => s + (c.totalPending || 0), 0),
      totalCredit: portfolio?.totalAdvance ?? clients.reduce((s, c) => s + (c.creditBalance || 0), 0),
    });
  }, []);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  useEffect(() => {
    const f = searchParams.get("filter");
    if (f === "paid" || f === "pending" || f === "credit") {
      setActiveFilter(f);
    }
  }, [searchParams]);

  const filteredCustomers = useMemo(() => {
    if (!activeFilter) return [];
    if (activeFilter === "paid") {
      return allCustomers.filter((c) => c.paymentStatus === "Fully Paid");
    }
    if (activeFilter === "pending") {
      return allCustomers.filter((c) => c.paymentStatus === "Pending");
    }
    return allCustomers.filter((c) => (c.creditBalance || 0) > 0);
  }, [allCustomers, activeFilter]);

  const toggleFilter = (filter: Exclude<CustomerFilter, null>) => {
    setActiveFilter((prev) => (prev === filter ? null : filter));
  };

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/payments?page=${page}`);
    const data = await res.json();
    setPayments(data.payments || []);
    setTotalPages(data.pagination?.totalPages || 1);
    setTotal(data.pagination?.total || 0);
    setLoading(false);
  }, [page]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const openDialog = async () => {
    const res = await fetch("/api/customers?limit=500");
    const data = await res.json();
    setCustomers(data.customers || []);
    setForm({ customerId: "", amount: "", method: "Cash", date: "", referenceNumber: "", notes: "" });
    setDialogOpen(true);
  };

  const selectedCustomer = customers.find((c) => c._id === form.customerId);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (!form.customerId) { toast("Customer select karein", "error"); return; }
    if (!amount || amount <= 0) { toast("Valid amount enter karein", "error"); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: form.customerId,
          amount,
          method: form.method,
          date: form.date || undefined,
          referenceNumber: form.referenceNumber || undefined,
          notes: form.notes || undefined,
        }),
      });
      const result = await res.json();
      if (!res.ok) { toast(result.error, "error"); return; }

      const credit = result.payment?.creditAdded || 0;
      toast(
        credit > 0
          ? `Payment recorded — ₹${credit.toLocaleString("en-IN")} advance credit saved`
          : "Payment recorded & bills allocated",
        "success"
      );
      setDialogOpen(false);
      fetchPayments();
      fetchSummary();
    } catch {
      toast("Something went wrong", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-navy">Payments</h1>
          <p className="text-sm text-gray-500">
            Customer payment — FIFO allocation (purani pending pehle, zyada ho to advance credit)
          </p>
        </div>
        <Button variant="gold" onClick={openDialog}>
          <Plus className="h-4 w-4" /> Record Payment
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => toggleFilter("paid")}
          className="text-left"
        >
          <Card className={cn(
            "transition-all cursor-pointer hover:shadow-md",
            activeFilter === "paid"
              ? "border-2 border-green-500 ring-2 ring-green-200 bg-green-50/50"
              : "border-green-200 hover:border-green-400"
          )}>
            <CardContent className="p-4">
              <p className="text-xs text-gray-500 uppercase">Fully Paid Clients</p>
              <p className="text-2xl font-bold text-green-700 mt-1">{paymentSummary.paidClients}</p>
              <p className="text-sm text-green-600 mt-1">Bill Payments: {formatCurrency(paymentSummary.totalAdvance)}</p>
              <p className="text-xs text-gray-400 mt-2">Click karke list dekhein →</p>
            </CardContent>
          </Card>
        </button>
        <button
          type="button"
          onClick={() => toggleFilter("pending")}
          className="text-left"
        >
          <Card className={cn(
            "transition-all cursor-pointer hover:shadow-md",
            activeFilter === "pending"
              ? "border-2 border-red-500 ring-2 ring-red-200 bg-red-50/50"
              : "border-red-200 hover:border-red-400"
          )}>
            <CardContent className="p-4">
              <p className="text-xs text-gray-500 uppercase">Pending Payment</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{paymentSummary.pendingClients}</p>
              <p className="text-sm text-red-500 mt-1">Total Pending: {formatCurrency(paymentSummary.totalPending)}</p>
              <p className="text-xs text-gray-400 mt-2">Click karke list dekhein →</p>
            </CardContent>
          </Card>
        </button>
        <button
          type="button"
          onClick={() => toggleFilter("credit")}
          className="text-left"
        >
          <Card className={cn(
            "transition-all cursor-pointer hover:shadow-md",
            activeFilter === "credit"
              ? "border-2 border-gold ring-2 ring-gold/30 bg-gold/10"
              : "border-gold/30 hover:border-gold/60"
          )}>
            <CardContent className="p-4">
              <p className="text-xs text-gray-500 uppercase">Advance</p>
              <p className="text-2xl font-bold text-gold mt-1">{paymentSummary.creditClients}</p>
              <p className="text-sm text-gold mt-1">Total Advance: {formatCurrency(paymentSummary.totalCredit)}</p>
              <p className="text-xs text-gray-400 mt-2">Click karke list dekhein →</p>
            </CardContent>
          </Card>
        </button>
      </div>

      {activeFilter && (
        <Card className="border-navy/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-gold" />
              {FILTER_LABELS[activeFilter]} ({filteredCustomers.length})
            </CardTitle>
            <p className="text-sm text-gray-500 font-normal">
              Neeche sirf woh customers hain jo is category me aate hain
            </p>
          </CardHeader>
          <CardContent>
            {filteredCustomers.length === 0 ? (
              <EmptyState title="Is category me koi customer nahi" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-3 font-medium">Customer ID</th>
                      <th className="pb-3 font-medium">Name</th>
                      <th className="pb-3 font-medium">Phone</th>
                      <th className="pb-3 font-medium">Total Purchase</th>
                      <th className="pb-3 font-medium">Paid</th>
                      <th className="pb-3 font-medium">Pending</th>
                      <th className="pb-3 font-medium">Advance</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.map((c) => (
                      <tr key={c._id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-3 font-medium text-gold">{c.customerId}</td>
                        <td className="py-3">
                          <Link href={`/admin/customers/${c._id}`} className="font-medium text-navy hover:text-gold hover:underline">
                            {c.name}
                          </Link>
                          {c.companyName && <div className="text-xs text-gray-400">{c.companyName}</div>}
                        </td>
                        <td className="py-3 text-gray-500">{c.phone || "—"}</td>
                        <td className="py-3">{formatCurrency(c.totalPurchase || 0)}</td>
                        <td className="py-3 text-green-700">{formatCurrency(c.totalAdvance || 0)}</td>
                        <td className="py-3 text-red-600 font-medium">{formatCurrency(c.totalPending || 0)}</td>
                        <td className="py-3 text-gold">{(c.creditBalance || 0) > 0 ? formatCurrency(c.creditBalance!) : "—"}</td>
                        <td className="py-3"><StatusBadge status={c.paymentStatus} /></td>
                        <td className="py-3">
                          <Link href={`/admin/customers/${c._id}`}>
                            <Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button>
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
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Payment Records</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <PageLoader />
          ) : payments.length === 0 ? (
            <EmptyState title="No payments found" description="Payment records will appear here" />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-3 font-medium">Payment ID</th>
                      <th className="pb-3 font-medium">Customer</th>
                      <th className="pb-3 font-medium">Bill</th>
                      <th className="pb-3 font-medium">Amount</th>
                      <th className="pb-3 font-medium">Advance</th>
                      <th className="pb-3 font-medium">Method</th>
                      <th className="pb-3 font-medium">Date</th>
                      <th className="pb-3 font-medium">By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p._id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-3 font-medium text-gold">{p.paymentId}</td>
                        <td className="py-3">{p.customerName}</td>
                        <td className="py-3 text-gray-500">{p.orderCode || "Multi-bill"}</td>
                        <td className="py-3 font-medium">{formatCurrency(p.amount)}</td>
                        <td className="py-3 text-gold">
                          {(p.creditAdded || 0) > 0 ? formatCurrency(p.creditAdded!) : "—"}
                        </td>
                        <td className="py-3">{p.method}</td>
                        <td className="py-3 text-gray-500">{formatDate(p.date)}</td>
                        <td className="py-3 text-gray-500">{p.addedByName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Customer Payment</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label>Customer *</Label>
              <Select
                value={form.customerId}
                onChange={(e) => setForm({ ...form, customerId: e.target.value })}
              >
                <option value="">Select customer</option>
                {customers.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name} — Pending: {formatCurrency(c.totalPending || 0)}
                    {(c.creditBalance || 0) > 0 ? ` | Advance: ${formatCurrency(c.creditBalance!)}` : ""}
                  </option>
                ))}
              </Select>
            </div>
            {selectedCustomer && selectedCustomer.totalPending > 0 && (
              <p className="text-xs text-red-600 bg-red-50 rounded p-2">
                Pending: {formatCurrency(selectedCustomer.totalPending)} — payment purani bills se clear hogi
              </p>
            )}
            <div>
              <Label>Amount (₹) *</Label>
              <Input
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="e.g. 8000"
              />
            </div>
            <div>
              <Label>Method *</Label>
              <Select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <Label>Reference Number</Label>
              <Input value={form.referenceNumber} onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })} />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" variant="gold" disabled={submitting}>
                {submitting ? "Saving..." : "Record & Allocate"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
