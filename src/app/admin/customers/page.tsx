"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SearchInput } from "@/components/ui/search-input";
import { Pagination } from "@/components/ui/pagination";
import { PageLoader, EmptyState } from "@/components/ui/loading";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils";
import { Plus, Eye } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { customerSchema, type CustomerInput } from "@/lib/validations";

interface Customer {
  _id: string;
  customerId: string;
  name: string;
  companyName?: string;
  phone: string;
  city?: string;
  totalAdvance?: number;
  totalCashPaid?: number;
  totalAppliedToBills?: number;
  totalPending: number;
  totalPurchase?: number;
  creditBalance?: number;
  paymentStatus: string;
  createdAt: string;
}

export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CustomerInput>({
    resolver: zodResolver(customerSchema),
  });

  const onSubmit = async (data: CustomerInput) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) { toast(result.error, "error"); return; }
      toast("Customer created", "success");
      setDialogOpen(false);
      reset();
      fetchCustomers();
    } catch {
      toast("Something went wrong", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ search, page: String(page) });
    if (paymentFilter) params.set("paymentFilter", paymentFilter);
    const res = await fetch(`/api/customers?${params}`);
    const data = await res.json();
    setCustomers(data.customers || []);
    setTotalPages(data.pagination?.totalPages || 1);
    setTotal(data.pagination?.total || 0);
    setLoading(false);
  }, [search, page, paymentFilter]);

  useEffect(() => {
    const timer = setTimeout(fetchCustomers, 300);
    return () => clearTimeout(timer);
  }, [fetchCustomers]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-navy">Customers</h1>
          <p className="text-sm text-gray-500">Track advance & pending payments per client</p>
        </div>
        <Button variant="gold" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" /> Add Customer
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row gap-3">
          <SearchInput
            value={search}
            onChange={(v) => { setSearch(v); setPage(1); }}
            placeholder="Search by name, ID, phone..."
            className="flex-1"
          />
          <Select
            value={paymentFilter}
            onChange={(e) => { setPaymentFilter(e.target.value); setPage(1); }}
            className="w-full sm:w-48"
          >
            <option value="">All Clients</option>
            <option value="advance">Advance Received</option>
            <option value="pending">Pending Payment</option>
          </Select>
        </CardHeader>
        <CardContent>
          {loading ? (
            <PageLoader />
          ) : customers.length === 0 ? (
            <EmptyState title="No customers found" />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-3 font-medium">Customer ID</th>
                      <th className="pb-3 font-medium">Name</th>
                      <th className="pb-3 font-medium">Phone</th>
                    <th className="pb-3 font-medium">Bill Amount</th>
                    <th className="pb-3 font-medium">Client Paid</th>
                    <th className="pb-3 font-medium">Pending</th>
                    <th className="pb-3 font-medium">Advance</th>
                    <th className="pb-3 font-medium">Payment Status</th>
                      <th className="pb-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((c) => (
                      <tr key={c._id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-3 font-medium text-gold">{c.customerId}</td>
                        <td className="py-3">
                          <Link
                            href={`/admin/customers/${c._id}`}
                            className="font-medium text-navy hover:text-gold hover:underline"
                          >
                            {c.name}
                          </Link>
                          {c.companyName && (
                            <div className="text-xs text-gray-400">{c.companyName}</div>
                          )}
                        </td>
                        <td className="py-3">{c.phone}</td>
                        <td className="py-3 font-medium">{formatCurrency(c.totalPurchase || 0)}</td>
                        <td className="py-3 text-green-700 font-medium">
                          {formatCurrency(
                            c.totalCashPaid ??
                              (c.totalPurchase || 0) - (c.totalPending || 0) + (c.creditBalance || 0)
                          )}
                        </td>
                        <td className="py-3 text-red-600 font-medium">{formatCurrency(c.totalPending || 0)}</td>
                        <td className="py-3 text-gold font-medium">{formatCurrency(c.creditBalance || 0)}</td>
                        <td className="py-3">
                          <StatusBadge
                            status={
                              c.paymentStatus === "Fully Paid" || c.paymentStatus === "Advance"
                                ? "PAID"
                                : c.paymentStatus === "Pending"
                                  ? "PARTIAL"
                                  : "UNPAID"
                            }
                          />
                        </td>
                        <td className="py-3">
                          <Button variant="ghost" size="sm" onClick={() => router.push(`/admin/customers/${c._id}`)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </td>
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
        <DialogContent>
          <DialogHeader><DialogTitle>Add Customer</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input {...register("name")} />
              {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
            </div>
            <div>
              <Label>Phone *</Label>
              <Input {...register("phone")} />
              {errors.phone && <p className="text-xs text-red-500">{errors.phone.message}</p>}
            </div>
            <div>
              <Label>Company</Label>
              <Input {...register("companyName")} />
            </div>
            <div>
              <Label>WhatsApp</Label>
              <Input {...register("whatsappNumber")} />
            </div>
            <div>
              <Label>Email</Label>
              <Input {...register("email")} />
            </div>
            <div>
              <Label>Address</Label>
              <Input {...register("address")} />
            </div>
            <div>
              <Label>City</Label>
              <Input {...register("city")} />
            </div>
            <div>
              <Label>State</Label>
              <Input {...register("state")} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" variant="gold" disabled={submitting}>{submitting ? "Creating..." : "Create"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
