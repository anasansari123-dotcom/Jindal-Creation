"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader, EmptyState } from "@/components/ui/loading";
import { StatusBadge } from "@/components/ui/badge";
import { BillPreview, type BillData } from "@/components/bill-preview";
import { BillExportActions } from "@/components/bill-export-actions";
import { dispatchToBillData, toDispatchBillData } from "@/lib/bill-export";
import { DEFAULT_WHATSAPP_NUMBER } from "@/lib/constants";
import { SingleBillPaymentBox } from "@/components/payment-ledger";
import { formatDate, formatCurrency, formatDateTime } from "@/lib/utils";
import {
  formatBillAmountBreakdown,
  getBillPaymentDisplay,
} from "@/lib/bill-payment-display";
import { BillItemsTable } from "@/components/bill-items-table";
import { enrichBillLineItem, formatBillLineCalculation } from "@/lib/bill-pricing";
import { buildStatusHistory } from "@/lib/dispatch-orders";
import {
  ArrowLeft,
  CheckCircle,
  Pencil,
  CalendarClock,
  ExternalLink,
  FileText,
  ImageIcon,
  RotateCcw,
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
  currentBillAmount?: number;
  carriedForwardPending?: number;
  creditApplied?: number;
  creditAdded?: number;
  cashPaid?: number;
  total: number;
  advance: number;
  pending: number;
  paymentStatus: string;
  paymentMode?: string;
  salespersonName: string;
  inventoryDeducted: boolean;
  notes?: string;
  loadPhotoUrl?: string;
  billPdfUrl?: string;
  billImageUrl?: string;
  dispatchBillPdfUrl?: string;
  dispatchBillImageUrl?: string;
  returnedAmount?: number;
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
  const [showPreview, setShowPreview] = useState(false);
  const [showDispatchPreview, setShowDispatchPreview] = useState(false);

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
  const dispatchBillData = toDispatchBillData(dispatch);
  const payment = getBillPaymentDisplay(dispatch);
  const orderHistory = buildStatusHistory(dispatch);
  const advanceDue = getAdvanceDueStatus(dispatch.readyByDate, dispatch.billStatus);

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

      {dispatch.billStatus === "FINAL" ? (
      <SingleBillPaymentBox
        bill={dispatch}
        billAmount={dispatch.total}
        clientPaid={dispatch.advance}
        pending={dispatch.pending}
        paymentStatus={dispatch.paymentStatus}
        label={formatBillAmountBreakdown(dispatch)}
      />
      ) : (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Dispatch bill — price aur payment Final Bill par set hoga. Abhi sirf products aur qty dikhai de rahi hai.
        </div>
      )}

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
          <div><p className="text-gray-500">Bill Banaya</p><p className="font-medium">{dispatch.salespersonName}</p></div>
          {dispatch.billStatus === "FINAL" && (
            <>
              <div><p className="text-gray-500">Customer Paid</p><p className="font-medium text-green-700">{formatCurrency(payment.cashPaid)}</p></div>
              {payment.hasPending ? (
                <div><p className="text-gray-500">Pending</p><p className="font-medium text-red-600">{formatCurrency(payment.pending)}</p></div>
              ) : payment.hasAdvance ? (
                <div><p className="text-gray-500">Advance (Account)</p><p className="font-medium text-gold">{formatCurrency(payment.creditAdded)}</p></div>
              ) : (
                <div><p className="text-gray-500">Pending</p><p className="font-medium text-green-700">{formatCurrency(0)}</p></div>
              )}
              {(dispatch.carriedForwardPending || 0) > 0 && (
                <div><p className="text-gray-500">Purani Pending (is bill me)</p><p className="font-medium text-amber-700">{formatCurrency(dispatch.carriedForwardPending!)}</p></div>
              )}
              {(dispatch.creditApplied || 0) > 0 && (
                <div><p className="text-gray-500">Account Advance Use</p><p className="font-medium text-green-700">{formatCurrency(dispatch.creditApplied!)}</p></div>
              )}
            </>
          )}
          {dispatch.convertedAt && <div><p className="text-gray-500">Final Bill Date</p><p>{formatDate(dispatch.convertedAt)}</p></div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Products ({dispatch.items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <BillItemsTable
            showPricing={dispatch.billStatus === "FINAL"}
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

      {dispatch.billStatus === "FINAL" && dispatch.loadPhotoUrl && (
        <Card>
          <CardHeader>
            <CardTitle>Gadi Me Maal Load Photo</CardTitle>
          </CardHeader>
          <CardContent>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={dispatch.loadPhotoUrl}
              alt="Gadi me maal load"
              className="max-w-full max-h-80 rounded-lg border object-contain"
            />
          </CardContent>
        </Card>
      )}

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
              {(dispatch.returnedAmount || 0) > 0 && (
                <span className="block text-amber-700 mt-1">
                  Returns: {formatCurrency(dispatch.returnedAmount!)} processed
                </span>
              )}
            </p>
          )}
          {(dispatch.billPdfUrl || dispatch.billImageUrl || dispatch.dispatchBillPdfUrl || dispatch.dispatchBillImageUrl) && (
            <div className="flex flex-wrap gap-3 text-sm">
              {dispatch.billPdfUrl && (
                <a
                  href={dispatch.billPdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-navy hover:text-gold underline"
                >
                  <FileText className="h-4 w-4" />
                  Final Bill PDF
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {dispatch.billImageUrl && (
                <a
                  href={dispatch.billImageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-navy hover:text-gold underline"
                >
                  <ImageIcon className="h-4 w-4" />
                  Final Bill Image
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {dispatch.dispatchBillPdfUrl && (
                <a
                  href={dispatch.dispatchBillPdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-navy hover:text-gold underline"
                >
                  <FileText className="h-4 w-4" />
                  Dispatch Bill PDF
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {dispatch.dispatchBillImageUrl && (
                <a
                  href={dispatch.dispatchBillImageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-navy hover:text-gold underline"
                >
                  <ImageIcon className="h-4 w-4" />
                  Dispatch Bill Image
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-3 items-center">
            <Button variant="outline" onClick={() => setShowPreview(!showPreview)}>
              {showPreview ? "Hide Preview" : dispatch.billStatus === "FINAL" ? "Show Final Preview" : "Show Bill Preview"}
            </Button>
            <BillExportActions bill={billData} dispatchMongoId={id} whatsappNumber={whatsappNumber} />
            {dispatch.billStatus === "DISPATCH" && !dispatch.inventoryDeducted && (
              <>
                <Link href={`/admin/dispatch/${id}/edit`}>
                  <Button variant="outline">
                    <Pencil className="h-4 w-4" /> Edit Dispatch
                  </Button>
                </Link>
                <Link href={`/admin/dispatch/${id}/edit?finalize=1`}>
                  <Button variant="gold">
                    <CheckCircle className="h-4 w-4" /> Review & Final Bill
                  </Button>
                </Link>
              </>
            )}
            {dispatch.billStatus === "FINAL" && (
              <>
                <Link href={`/admin/dispatch/${id}/edit`}>
                  <Button variant="outline">
                    <Pencil className="h-4 w-4" /> Edit Final Bill
                  </Button>
                </Link>
                <Link href={`/admin/returns/new?dispatchId=${id}`}>
                  <Button variant="outline" className="border-amber-300 text-amber-800 hover:bg-amber-50">
                    <RotateCcw className="h-4 w-4" /> Product Return
                  </Button>
                </Link>
              </>
            )}
          </div>

          {dispatch.billStatus === "FINAL" && (
            <div className="border-t border-navy/10 pt-4 space-y-3">
              <div>
                <p className="font-medium text-navy">Original Dispatch Bill</p>
                <p className="text-sm text-gray-600 mt-1">
                  Final bill ke baad bhi dispatch bill (sirf products / qty, bina rate) dekh aur download kar sakte hain.
                  Dispatch ID: <strong>{dispatch.dispatchId}</strong>
                </p>
              </div>
              <div className="flex flex-wrap gap-3 items-center">
                <Button
                  variant="outline"
                  onClick={() => setShowDispatchPreview(!showDispatchPreview)}
                >
                  {showDispatchPreview ? "Hide Dispatch Preview" : "Show Dispatch Preview"}
                </Button>
                <BillExportActions
                  bill={dispatchBillData}
                  dispatchMongoId={id}
                  whatsappNumber={whatsappNumber}
                  variant="dispatch"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Final bill preview for export */}
      <div
        className={
          showPreview
            ? "overflow-x-auto border rounded-xl"
            : "fixed -left-[10000px] top-0 w-[794px] pointer-events-none -z-10"
        }
        aria-hidden={!showPreview}
      >
        <BillPreview ref={billRef} bill={billData} />
      </div>

      {dispatch.billStatus === "FINAL" && (
        <div
          className={
            showDispatchPreview
              ? "overflow-x-auto border rounded-xl border-blue-200"
              : "fixed -left-[10000px] top-0 w-[794px] pointer-events-none -z-10"
          }
          aria-hidden={!showDispatchPreview}
        >
          <BillPreview bill={dispatchBillData} />
        </div>
      )}
    </div>
  );
}
