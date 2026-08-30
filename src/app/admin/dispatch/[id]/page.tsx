"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader, EmptyState } from "@/components/ui/loading";
import { StatusBadge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { BillPreview, type BillData } from "@/components/bill-preview";
import { BillExportActions } from "@/components/bill-export-actions";
import { dispatchToBillData } from "@/lib/bill-export";
import { DEFAULT_WHATSAPP_NUMBER } from "@/lib/constants";
import { SingleBillPaymentBox } from "@/components/payment-ledger";
import { formatDate, formatCurrency, formatDateTime } from "@/lib/utils";
import { BillItemsTable } from "@/components/bill-items-table";
import { enrichBillLineItem, formatBillLineCalculation } from "@/lib/bill-pricing";
import { buildStatusHistory } from "@/lib/dispatch-orders";
import {
  ArrowLeft,
  CheckCircle,
  Pencil,
  CalendarClock,
} from "lucide-react";
import { advanceDueLabel, getAdvanceDueStatus, isAdvanceOrder } from "@/lib/advance-order";

interface DispatchBill {
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
  items: BillData["items"];
  subtotal: number;
  discount: number;
  total: number;
  advance: number;
  pending: number;
  paymentStatus: string;
  paymentMode?: string;
  salespersonName: string;
  inventoryDeducted: boolean;
  notes?: string;
  convertedAt?: string;
  statusHistory?: Array<{
    status: "PENDING" | "COMPLETED";
    billStatus: "DISPATCH" | "FINAL";
    date: string;
    note: string;
    byName: string;
  }>;
}

export default function DispatchBillDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const billRef = useRef<HTMLDivElement>(null);
  const [dispatch, setDispatch] = useState<DispatchBill | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState(DEFAULT_WHATSAPP_NUMBER);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [converting, setConverting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const fetchDispatch = () => {
    setLoading(true);
    fetch(`/api/dispatch/${id}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok || !d.dispatch) {
          setNotFound(true);
          setDispatch(null);
          return;
        }
        setNotFound(false);
        setDispatch(d.dispatch);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDispatch();
    fetch("/api/settings").then((r) => r.json()).then((d) =>
      setWhatsappNumber(d.settings?.whatsappNumber || DEFAULT_WHATSAPP_NUMBER)
    );
  }, [id]);

  if (loading) return <PageLoader />;
  if (notFound || !dispatch) {
    return (
      <EmptyState
        title="Bill not found"
        description="Yeh dispatch bill exist nahi karti ya delete ho chuki hai."
        action={
          <Link href="/admin/dispatch">
            <Button variant="outline">Back to Bills</Button>
          </Link>
        }
      />
    );
  }

  const billData = dispatchToBillData(dispatch);
  const orderHistory = buildStatusHistory(dispatch);
  const advanceDue = getAdvanceDueStatus(dispatch.readyByDate, dispatch.billStatus);

  const handleConvertToFinal = async () => {
    setConverting(true);
    try {
      const res = await fetch(`/api/dispatch/${id}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error, "error");
        return;
      }
      toast("Converted to Final Bill — stock deducted", "success");
      setConfirmOpen(false);
      fetchDispatch();
    } catch {
      toast("Something went wrong", "error");
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/admin/dispatch">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-serif font-bold text-navy">
              {dispatch.billStatus === "FINAL" ? "Final Bill" : "Dispatch Bill"}
            </h1>
            <p className="text-sm text-gold">{dispatch.dispatchId}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={dispatch.billStatus === "FINAL" ? "COMPLETED" : "DISPATCHED"} />
          {dispatch.inventoryDeducted && (
            <span className="text-xs text-green-700 bg-green-50 px-2 py-1 rounded-full">
              Stock Deducted ✓
            </span>
          )}
        </div>
      </div>

      <SingleBillPaymentBox
        billAmount={dispatch.total}
        clientPaid={dispatch.advance}
        pending={dispatch.pending}
        paymentStatus={dispatch.paymentStatus}
        label={`Bill: ${formatCurrency(dispatch.subtotal)} − Discount ${formatCurrency(dispatch.discount)} = ${formatCurrency(dispatch.total)}`}
      />

      <Card>
        <CardHeader>
          <CardTitle>Customer & Bill Info</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <div><p className="text-gray-500">Name</p><p className="font-medium">{dispatch.customerName}</p></div>
          {dispatch.customerCompany && <div><p className="text-gray-500">Company</p><p>{dispatch.customerCompany}</p></div>}
          {dispatch.customerPhone && <div><p className="text-gray-500">Phone</p><p>{dispatch.customerPhone}</p></div>}
          {dispatch.customerAddress && <div><p className="text-gray-500">Address</p><p>{dispatch.customerAddress}</p></div>}
          <div><p className="text-gray-500">Order Date</p><p>{formatDate(dispatch.dispatchDate)}</p></div>
          {isAdvanceOrder(dispatch.orderType) && dispatch.readyByDate && (
            <div>
              <p className="text-gray-500 flex items-center gap-1">
                <CalendarClock className="h-3.5 w-3.5" /> Maal Ready By
              </p>
              <p className={`font-medium ${advanceDue === "overdue" ? "text-red-600" : "text-gold"}`}>
                {formatDate(dispatch.readyByDate)}
                <span className="text-xs text-gray-500 ml-2">({advanceDueLabel(advanceDue)})</span>
              </p>
            </div>
          )}
          <div><p className="text-gray-500">Advance Paid</p><p className="font-medium text-green-700">{formatCurrency(dispatch.advance)}</p></div>
          <div><p className="text-gray-500">Pending</p><p className="font-medium text-red-600">{formatCurrency(dispatch.pending)}</p></div>
          <div><p className="text-gray-500">Bill Banaya</p><p className="font-medium">{dispatch.salespersonName}</p></div>
          {dispatch.convertedAt && <div><p className="text-gray-500">Final Bill Date</p><p>{formatDate(dispatch.convertedAt)}</p></div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Products ({dispatch.items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <BillItemsTable
            items={dispatch.items.map((item) => {
              const pricing = enrichBillLineItem(item);
              return {
                ...item,
                total: pricing.total,
                calculation: formatBillLineCalculation(pricing),
              };
            })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Order Status History</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {orderHistory.map((entry, i) => (
            <div key={i} className="flex flex-wrap items-start gap-2 text-sm border-b last:border-0 pb-2 last:pb-0">
              <StatusBadge status={entry.status} />
              <span className="text-gray-500">{formatDateTime(entry.date)}</span>
              <span className="text-navy">{entry.note}</span>
              <span className="text-gray-400">— {entry.byName}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Bill Actions */}
      <Card className={dispatch.billStatus === "DISPATCH" ? "border-gold/40 bg-gold/5" : ""}>
        <CardHeader>
          <CardTitle>
            {dispatch.billStatus === "DISPATCH" ? "Dispatch Bill Actions" : "Final Bill Actions"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {dispatch.billStatus === "DISPATCH" && (
            <p className="text-sm text-gray-600">
              {isAdvanceOrder(dispatch.orderType) ? (
                <>
                  <strong>Advance Order</strong> — stock abhi minus nahi hua. Jab maal ready ho aur customer ko
                  de do, tab <strong>Convert to Final Bill</strong> karein — tab stock cut hoga.
                </>
              ) : (
                <>
                  Dispatch bill — stock abhi minus nahi hua. Galat ho to <strong>Edit Bill</strong> karein.
                  Customer ko WhatsApp ya PDF bhejein. Jab goods dispatch ho jayein tab{" "}
                  <strong>Convert to Final Bill</strong> karein.
                </>
              )}
            </p>
          )}
          {dispatch.billStatus === "FINAL" && dispatch.finalBillId && (
            <p className="text-sm text-green-700">
              Final Bill ID: <strong>{dispatch.finalBillId}</strong> · Stock deduct ho chuka hai ✓
            </p>
          )}
          <div className="flex flex-wrap gap-3 items-center">
            <Button variant="outline" onClick={() => setShowPreview(!showPreview)}>
              {showPreview ? "Hide Preview" : "Show Bill Preview"}
            </Button>
            <BillExportActions bill={billData} whatsappNumber={whatsappNumber} />
            {dispatch.billStatus === "DISPATCH" && !dispatch.inventoryDeducted && (
              <>
                <Link href={`/admin/dispatch/${id}/edit`}>
                  <Button variant="outline">
                    <Pencil className="h-4 w-4" /> Edit Bill
                  </Button>
                </Link>
                <Button variant="gold" onClick={() => setConfirmOpen(true)}>
                  <CheckCircle className="h-4 w-4" /> Convert to Final Bill
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Bill preview for export — always in DOM, visible when preview toggled */}
      <div
        className={
          showPreview
            ? "overflow-x-auto border rounded-xl"
            : "fixed left-0 top-0 opacity-0 pointer-events-none -z-10 overflow-hidden"
        }
        aria-hidden={!showPreview}
      >
        <BillPreview ref={billRef} bill={billData} />
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Convert to Final Bill"
        description="This will convert the dispatch bill to a Final Bill and deduct stock from inventory. This cannot be undone."
        confirmLabel="Convert & Deduct Stock"
        onConfirm={handleConvertToFinal}
        loading={converting}
      />
    </div>
  );
}
