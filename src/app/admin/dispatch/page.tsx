"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { PageLoader, EmptyState } from "@/components/ui/loading";
import { StatusBadge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { BillExportActions } from "@/components/bill-export-actions";
import { dispatchToBillData } from "@/lib/bill-export";
import { DEFAULT_WHATSAPP_NUMBER } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus, Eye, FileText, CheckCircle, Truck, CalendarClock } from "lucide-react";
import { advanceDueLabel, getAdvanceDueStatus, isAdvanceOrder } from "@/lib/advance-order";
import type { BillData } from "@/components/bill-preview";

interface DispatchRecord {
  _id: string;
  dispatchId: string;
  billStatus: "DISPATCH" | "FINAL";
  finalBillId?: string;
  customerName: string;
  customerCode?: string;
  customerCompany?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerCity?: string;
  dispatchDate: string;
  orderType?: "immediate" | "advance";
  readyByDate?: string;
  subtotal: number;
  discount: number;
  total: number;
  advance: number;
  pending: number;
  paymentStatus: string;
  paymentMode?: string;
  inventoryDeducted: boolean;
  salespersonName: string;
  notes?: string;
  items: BillData["items"];
}

export default function DispatchPage() {
  const [dispatches, setDispatches] = useState<DispatchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [orderTypeFilter, setOrderTypeFilter] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState(DEFAULT_WHATSAPP_NUMBER);

  const fetchDispatches = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (statusFilter) params.set("status", statusFilter);
    if (orderTypeFilter) params.set("orderType", orderTypeFilter);
    const res = await fetch(`/api/dispatch?${params}`);
    const data = await res.json();
    setDispatches(data.dispatches || []);
    setTotalPages(data.pagination?.totalPages || 1);
    setTotal(data.pagination?.total || 0);
    setLoading(false);
  }, [page, statusFilter, orderTypeFilter]);

  useEffect(() => {
    fetchDispatches();
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setWhatsappNumber(d.settings?.whatsappNumber || DEFAULT_WHATSAPP_NUMBER))
      .catch(() => {});
  }, [fetchDispatches]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-navy">Create Bill</h1>
          <p className="text-sm text-gray-500">
            Dispatch Bill (stock minus nahi) · Final Bill (stock minus hoga)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/dispatch/new">
            <Button variant="gold">
              <Truck className="h-4 w-4" /> Dispatch Bill
            </Button>
          </Link>
          <Link href="/admin/dispatch/new?type=advance">
            <Button variant="outline" className="border-gold text-navy hover:bg-gold/10">
              <CalendarClock className="h-4 w-4" /> Advance Order
            </Button>
          </Link>
          <Link href="/admin/dispatch/final">
            <Button variant="outline" className="border-gold text-navy hover:bg-gold/10">
              <CheckCircle className="h-4 w-4" /> Final Bill
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-lg border border-navy/10 bg-white p-4 text-sm">
          <p className="font-semibold text-navy flex items-center gap-2">
            <Truck className="h-4 w-4 text-gold" /> Dispatch Bill
          </p>
          <p className="text-gray-500 mt-1">
            PDF download ya WhatsApp share — stock minus <strong>nahi</strong> hoga.
          </p>
        </div>
        <div className="rounded-lg border border-gold/30 bg-gold/5 p-4 text-sm">
          <p className="font-semibold text-navy flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-gold" /> Final Bill
          </p>
          <p className="text-gray-600 mt-1">
            Dispatch bill se convert karo — tab stock inventory se minus hoga.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="w-48"
        >
          <option value="">All Bills</option>
          <option value="DISPATCH">Dispatch Only</option>
          <option value="FINAL">Final Bills</option>
        </Select>
        <Select
          value={orderTypeFilter}
          onChange={(e) => { setOrderTypeFilter(e.target.value); setPage(1); }}
          className="w-48"
        >
          <option value="">All Order Types</option>
          <option value="advance">Advance Orders Only</option>
          <option value="immediate">Normal Bills Only</option>
        </Select>
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <PageLoader />
          ) : dispatches.length === 0 ? (
            <EmptyState
              title="No bills yet"
              description="Pehle Dispatch Bill banayein, phir Final Bill convert karein"
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-3 font-medium">Bill ID</th>
                      <th className="pb-3 font-medium">Type</th>
                      <th className="pb-3 font-medium">Customer</th>
                      <th className="pb-3 font-medium">Total</th>
                      <th className="pb-3 font-medium">Payment</th>
                      <th className="pb-3 font-medium">Stock</th>
                      <th className="pb-3 font-medium">Date</th>
                      <th className="pb-3 font-medium">Ready By</th>
                      <th className="pb-3 font-medium">PDF / WhatsApp</th>
                      <th className="pb-3 font-medium">More</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dispatches.map((d) => {
                      const dueStatus = getAdvanceDueStatus(d.readyByDate, d.billStatus);
                      return (
                      <tr key={d._id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-3">
                          <div className="font-medium text-gold">{d.dispatchId}</div>
                          {d.finalBillId && (
                            <div className="text-xs text-gray-400">Final: {d.finalBillId}</div>
                          )}
                        </td>
                        <td className="py-3">
                          <div className="flex flex-col gap-1">
                            <StatusBadge
                              status={d.billStatus === "FINAL" ? "COMPLETED" : "DISPATCHED"}
                            />
                            {isAdvanceOrder(d.orderType) && (
                              <span className="text-xs font-medium text-gold">
                                Advance · {advanceDueLabel(dueStatus)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3">
                          <div>{d.customerName}</div>
                          {d.customerCompany && (
                            <div className="text-xs text-gray-400">{d.customerCompany}</div>
                          )}
                        </td>
                        <td className="py-3">
                          <div>{formatCurrency(d.total)}</div>
                          {d.advance > 0 && (
                            <div className="text-xs text-green-700">Paid: {formatCurrency(d.advance)}</div>
                          )}
                        </td>
                        <td className="py-3"><StatusBadge status={d.paymentStatus} /></td>
                        <td className="py-3">
                          {d.inventoryDeducted ? (
                            <span className="text-xs text-green-700 font-medium">Minus ✓</span>
                          ) : (
                            <span className="text-xs text-gray-400">Not yet</span>
                          )}
                        </td>
                        <td className="py-3 text-gray-500">{formatDate(d.dispatchDate)}</td>
                        <td className="py-3">
                          {d.readyByDate ? (
                            <span className={dueStatus === "overdue" ? "text-red-600 font-medium" : "text-navy"}>
                              {formatDate(d.readyByDate)}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="py-3">
                          <BillExportActions
                            bill={dispatchToBillData(d)}
                            whatsappNumber={whatsappNumber}
                            compact
                          />
                        </td>
                        <td className="py-3">
                          <div className="flex gap-1">
                            <Link href={`/admin/dispatch/${d._id}`}>
                              <Button variant="ghost" size="sm" title="View Bill">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            {d.billStatus === "DISPATCH" && !d.inventoryDeducted && (
                              <Link href={`/admin/dispatch/final?dispatchId=${d.dispatchId}`}>
                                <Button variant="ghost" size="sm" title="Convert to Final Bill">
                                  <FileText className="h-4 w-4 text-gold" />
                                </Button>
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    );})}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
