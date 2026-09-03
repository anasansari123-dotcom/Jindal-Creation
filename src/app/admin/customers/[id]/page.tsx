"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader, EmptyState } from "@/components/ui/loading";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { DEFAULT_WHATSAPP_NUMBER, PAYMENT_METHODS } from "@/lib/constants";
import { ArrowLeft, Pencil, IndianRupee, Upload, FileText, ExternalLink, ImageIcon, Download } from "lucide-react";
import { PaymentSummaryCard, SingleBillPaymentBox } from "@/components/payment-ledger";
import { BillExportActions } from "@/components/bill-export-actions";
import { BillItemsTable } from "@/components/bill-items-table";
import { dispatchToBillData } from "@/lib/bill-export";
import { toBillItemRow } from "@/lib/bill-pricing";
import { previewPaymentAllocation, type CustomerBillEntry } from "@/lib/customer-bills";
import { getDisplayBillId } from "@/lib/bill-display";
import type { PaymentSummary } from "@/lib/payment-ledger";
import type { BillData } from "@/components/bill-preview";

interface BillItem {
  productName: string;
  productCode: string;
  quantity: number;
  pieces: number;
  boxes?: number;
  fullBoxes?: number;
  loosePieces?: number;
  piecesPerBox?: number;
  unitPrice: number;
  piecePrice?: number;
  discount: number;
  total: number;
  sellMode?: "box" | "piece" | "mixed";
}

interface DispatchRecord {
  _id: string;
  dispatchId: string;
  finalBillId?: string;
  billStatus: "DISPATCH" | "FINAL";
  orderCode?: string;
  dispatchDate: string;
  customerName: string;
  customerCode?: string;
  customerCompany?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerCity?: string;
  subtotal: number;
  discount: number;
  total: number;
  advance: number;
  pending: number;
  cashPaid?: number;
  creditAdded?: number;
  creditApplied?: number;
  paymentStatus: string;
  paymentMode?: string;
  salespersonName: string;
  notes?: string;
  items: BillItem[];
}

interface PaymentRecord {
  _id: string;
  paymentId: string;
  amount: number;
  date: string;
  method: string;
  creditAdded: number;
  allocations: Array<{
    billCode: string;
    billType: string;
    amount: number;
  }>;
  notes?: string;
}

interface CustomerBillFileEntry {
  type: "bill-pdf" | "bill-image" | "load-photo" | "dispatch-bill-pdf" | "dispatch-bill-image";
  label: string;
  url: string;
  publicId?: string;
}

interface CustomerBillArchive {
  billId: string;
  displayBillId: string;
  billStatus: "DISPATCH" | "FINAL";
  dispatchMongoId: string;
  dispatchDate: string;
  total: number;
  files: CustomerBillFileEntry[];
}

interface CustomerData {
  customer: CustomerRecord;
  dispatches: DispatchRecord[];
  finalBills: DispatchRecord[];
  confirmBills: Array<Record<string, unknown>>;
  orders: Array<Record<string, unknown>>;
  payments: PaymentRecord[];
  bills: CustomerBillEntry[];
  paymentLedger: PaymentSummary;
  billArchives?: CustomerBillArchive[];
  stats: {
    totalPending: number;
    totalAdvance?: number;
    totalCashPaid?: number;
    totalAppliedToBills?: number;
    totalPurchase: number;
    creditBalance: number;
    paymentStatus: string;
    totalClientPaid?: number;
  };
}

interface CustomerDocument {
  label: string;
  url: string;
  publicId: string;
  uploadedAt: string;
}

interface CustomerRecord {
  _id?: string;
  customerId?: string;
  name?: string;
  companyName?: string;
  phone?: string;
  whatsappNumber?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstNumber?: string;
  notes?: string;
  creditBalance?: number;
  documents?: CustomerDocument[];
  [key: string]: unknown;
}

export default function CustomerDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<CustomerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState(DEFAULT_WHATSAPP_NUMBER);
  const [payOpen, setPayOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("Cash");
  const [payNotes, setPayNotes] = useState("");
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [editPaymentAmount, setEditPaymentAmount] = useState("");
  const [editPayMethod, setEditPayMethod] = useState("Cash");
  const [docUploading, setDocUploading] = useState(false);
  const [docLabel, setDocLabel] = useState("GST Certificate");

  const fetchData = useCallback(() => {
    setLoading(true);
    fetch(`/api/customers/${id}`)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok || !json.customer) {
          setNotFound(true);
          setData(null);
          return;
        }
        setNotFound(false);
        setData(json);
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetchData();
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setWhatsappNumber(d.settings?.whatsappNumber || DEFAULT_WHATSAPP_NUMBER))
      .catch(() => {});
  }, [fetchData]);

  const submitPayment = async (amount: number, method: string, notes?: string) => {
    const res = await fetch(`/api/customers/${id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, method, notes }),
    });
    const result = await res.json();
    if (!res.ok) {
      toast(result.error, "error");
      return false;
    }
    const alloc = result.payment?.allocations?.length || 0;
    const credit = result.payment?.creditAdded || 0;
    toast(
      credit > 0
        ? `₹${amount.toLocaleString("en-IN")} recorded — ${alloc} bill(s) clear, ₹${credit.toLocaleString("en-IN")} advance credit`
        : `₹${amount.toLocaleString("en-IN")} recorded — ${alloc} bill(s) me allocate hua`,
      "success"
    );
    return true;
  };

  const handlePayment = async () => {
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) {
      toast("Valid amount enter karein", "error");
      return;
    }
    setSubmitting(true);
    try {
      const ok = await submitPayment(amount, payMethod, payNotes);
      if (ok) {
        setPayOpen(false);
        setPayAmount("");
        setPayNotes("");
        fetchData();
      }
    } catch {
      toast("Something went wrong", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = () => {
    if (!data) return;
    const c = data.customer;
    setEditForm({
      name: String(c.name || ""),
      phone: String(c.phone || ""),
      companyName: String(c.companyName || ""),
      whatsappNumber: String(c.whatsappNumber || ""),
      email: String(c.email || ""),
      address: String(c.address || ""),
      city: String(c.city || ""),
      state: String(c.state || ""),
      pincode: String(c.pincode || ""),
      gstNumber: String(c.gstNumber || ""),
      notes: String(c.notes || ""),
    });
    setEditPaymentAmount("");
    setEditPayMethod("Cash");
    setEditOpen(true);
  };

  const handleEdit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/customers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const result = await res.json();
      if (!res.ok) {
        toast(result.error, "error");
        return;
      }

      const payAmt = parseFloat(editPaymentAmount);
      if (payAmt && payAmt > 0) {
        const payOk = await submitPayment(payAmt, editPayMethod);
        if (!payOk) return;
      } else {
        toast("Customer details saved", "success");
      }

      setEditOpen(false);
      setEditPaymentAmount("");
      fetchData();
    } catch {
      toast("Something went wrong", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDocumentUpload = async (file: File | null) => {
    if (!file) return;
    setDocUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("label", docLabel.trim() || "Account Document");
      const res = await fetch(`/api/customers/${id}/documents`, {
        method: "POST",
        body: formData,
      });
      const result = await res.json();
      if (!res.ok) {
        toast(result.error || "Upload fail", "error");
        return;
      }
      toast("Document Cloudinary par save ho gaya", "success");
      fetchData();
    } catch {
      toast("Upload fail — dubara try karein", "error");
    } finally {
      setDocUploading(false);
    }
  };

  if (loading) return <PageLoader />;
  if (notFound || !data?.customer) {
    return (
      <EmptyState
        title="Customer not found"
        description="Yeh customer exist nahi karta."
        action={
          <Link href="/admin/customers">
            <Button variant="outline">Back to Customers</Button>
          </Link>
        }
      />
    );
  }

  const { customer, dispatches, finalBills, paymentLedger, payments, stats, bills = [], billArchives = [] } = data;
  const accountDocuments = customer.documents ?? [];

  const editPayPreview =
    editPaymentAmount && parseFloat(editPaymentAmount) > 0
      ? previewPaymentAllocation(bills, parseFloat(editPaymentAmount), stats.creditBalance || 0)
      : null;

  const dispatchToBill = (d: DispatchRecord): BillData =>
    dispatchToBillData({
      dispatchId: d.dispatchId,
      billStatus: d.billStatus,
      finalBillId: d.finalBillId,
      customerName: d.customerName,
      customerCode: d.customerCode,
      customerCompany: d.customerCompany,
      customerPhone: d.customerPhone,
      customerAddress: d.customerAddress,
      customerCity: d.customerCity,
      dispatchDate: d.dispatchDate,
      items: d.items.map((i) => ({ ...i, boxes: i.boxes ?? 0 })),
      subtotal: d.subtotal,
      discount: d.discount,
      total: d.total,
      advance: d.advance,
      pending: d.pending,
      paymentStatus: d.paymentStatus,
      paymentMode: d.paymentMode,
      salespersonName: d.salespersonName,
      notes: d.notes,
    });

  const renderBillCard = (d: DispatchRecord, isFinal: boolean) => (
    <div
      key={d._id}
      className={`border rounded-lg p-4 space-y-3 ${isFinal ? "border-green-200 bg-green-50/30" : ""}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Link href={`/admin/dispatch/${d._id}`} className="font-medium text-gold hover:underline">
              {getDisplayBillId({
                billStatus: isFinal ? "FINAL" : "DISPATCH",
                finalBillId: d.finalBillId,
                dispatchId: d.dispatchId,
              })}
            </Link>
            <StatusBadge status={isFinal ? "COMPLETED" : "DISPATCHED"} />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {formatDateTime(d.dispatchDate)}
            · Customer: {d.customerName}
            {isFinal && d.finalBillId && d.dispatchId !== d.finalBillId && (
              <> · Dispatch: {d.dispatchId}</>
            )}
            {isFinal && " · Stock Deducted ✓"}
          </p>
        </div>
        <BillExportActions bill={dispatchToBill(d)} dispatchMongoId={d._id} whatsappNumber={whatsappNumber} compact />
      </div>
      <SingleBillPaymentBox
        bill={{
          total: d.total,
          advance: d.advance,
          pending: d.pending,
          cashPaid: d.cashPaid,
          creditAdded: d.creditAdded,
          creditApplied: d.creditApplied,
        }}
        billAmount={d.total}
        clientPaid={d.advance}
        pending={d.pending}
        paymentStatus={d.paymentStatus}
        label={`${isFinal ? "Final" : "Dispatch"} Bill — Payment Breakdown`}
      />
      <BillItemsTable items={d.items.map((i) => toBillItemRow(i))} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/admin/customers">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-serif font-bold text-navy">{customer.name as string}</h1>
            <p className="text-sm text-gold">{customer.customerId as string}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={openEdit}>
            <Pencil className="h-4 w-4" /> Edit Details
          </Button>
          <Button variant="gold" size="sm" onClick={() => setPayOpen(true)}>
            <IndianRupee className="h-4 w-4" /> Record Payment
          </Button>
        </div>
      </div>

      <PaymentSummaryCard
        summary={paymentLedger}
        customerName={customer.name as string}
        customerId={customer.customerId as string}
      />

      {/* FIFO allocation explanation */}
      {stats.totalPending > 0 && (
        <div className="rounded-lg border border-gold/30 bg-gold/5 p-4 text-sm text-gray-700">
          <p className="font-medium text-navy mb-1">Payment Allocation (FIFO)</p>
          <p>
            Jab customer payment karega, pehle <strong>purani pending bills</strong> clear hongi (date ke hisaab se),
            phir nayi bills, aur agar zyada payment ho to <strong>advance credit</strong> account me save hoga.
          </p>
          <p className="mt-2 text-xs text-gray-500">
            Example: ₹2,500 purani pending + ₹5,000 nayi shopping, customer ne ₹8,000 diya →
            ₹2,500 purani clear, ₹5,000 nayi clear, ₹500 advance credit account me.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Customer Information</CardTitle>
            <Button variant="ghost" size="sm" onClick={openEdit}><Pencil className="h-3 w-3" /></Button>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {[
              ["Company", customer.companyName],
              ["Phone", customer.phone],
              ["WhatsApp", customer.whatsappNumber],
              ["Email", customer.email],
              ["Address", customer.address],
              ["City", customer.city],
              ["State", customer.state],
              ["Pincode", customer.pincode],
              ["GST", customer.gstNumber],
              ["Notes", customer.notes],
            ].map(([label, value]) => value ? (
              <div key={label as string}>
                <p className="text-gray-500">{label}</p>
                <p className="font-medium text-navy">{String(value)}</p>
              </div>
            ) : null)}
            {!customer.companyName && !customer.address && (
              <p className="text-gray-400 text-xs">Edit karke poori details save karein</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Account Summary</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center text-sm">
            <div className="rounded-lg bg-navy/5 p-3">
              <p className="text-gray-500 text-xs">Total Bills</p>
              <p className="text-lg font-bold text-navy">{formatCurrency(stats.totalPurchase)}</p>
            </div>
            <div className="rounded-lg bg-green-50 p-3">
              <p className="text-gray-500 text-xs">Customer Paid</p>
              <p className="text-lg font-bold text-green-700">{formatCurrency(paymentLedger.totalCashPaid)}</p>
            </div>
            <div className="rounded-lg bg-red-50 p-3">
              <p className="text-gray-500 text-xs">Pending</p>
              <p className="text-lg font-bold text-red-600">{formatCurrency(paymentLedger.totalPending)}</p>
            </div>
            <div className="rounded-lg bg-gold/10 p-3 border border-gold/20">
              <p className="text-gray-500 text-xs">Advance</p>
              <p className="text-lg font-bold text-gold">{formatCurrency(paymentLedger.creditBalance)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Saved Bills — PDF &amp; Photos (Cloudinary)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Jab bill Download PDF ya WhatsApp se share hoti hai, PDF aur photo is customer ke account me
            Cloudinary par save ho jati hai — yahan se dubara download kar sakte hain.
          </p>
          {billArchives.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              Abhi koi saved bill nahi — pehli baar PDF download ya WhatsApp share karein
            </p>
          ) : (
            <div className="space-y-3">
              {billArchives.map((archive) => (
                <div
                  key={archive.dispatchMongoId}
                  className="rounded-lg border p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-navy">{archive.displayBillId}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatDate(archive.dispatchDate)} · {archive.billStatus === "FINAL" ? "Final Bill" : "Dispatch Bill"} ·{" "}
                        {formatCurrency(archive.total)}
                      </p>
                    </div>
                    <Link href={`/admin/dispatch/${archive.dispatchMongoId}`}>
                      <Button variant="outline" size="sm">
                        View Bill
                      </Button>
                    </Link>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {archive.files.map((file) => (
                      <a
                        key={`${archive.dispatchMongoId}-${file.type}`}
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                        className="inline-flex items-center gap-1.5 rounded-md border border-navy/15 px-3 py-1.5 text-sm text-navy hover:bg-navy/5"
                      >
                        {file.type === "bill-pdf" || file.type === "dispatch-bill-pdf" ? (
                          <FileText className="h-4 w-4 text-gold shrink-0" />
                        ) : (
                          <ImageIcon className="h-4 w-4 text-gold shrink-0" />
                        )}
                        <span>
                          {file.type === "bill-pdf"
                            ? "Download PDF"
                            : file.type === "dispatch-bill-pdf"
                              ? "Dispatch PDF"
                              : file.type === "bill-image"
                                ? "Download Photo"
                                : file.type === "dispatch-bill-image"
                                  ? "Dispatch Photo"
                                  : "Load Photo"}
                        </span>
                        <Download className="h-3.5 w-3.5 opacity-60" />
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account Documents (Cloudinary)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            GST certificate, ID proof, agreement — sab files Cloudinary par save hongi.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1">
              <Label>Document Label</Label>
              <Input
                value={docLabel}
                onChange={(e) => setDocLabel(e.target.value)}
                placeholder="e.g. GST Certificate"
              />
            </div>
            <label className="inline-flex items-center justify-center gap-2 cursor-pointer rounded-md border border-navy/20 px-4 py-2 text-sm font-medium text-navy hover:bg-navy/5">
              <Upload className="h-4 w-4" />
              {docUploading ? "Uploading..." : "Upload PDF / Image"}
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                disabled={docUploading}
                onChange={(e) => handleDocumentUpload(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          {accountDocuments.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">Abhi koi document upload nahi hui</p>
          ) : (
            <div className="space-y-2">
              {accountDocuments.map((doc, i) => (
                <div
                  key={doc.publicId || i}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-gold shrink-0" />
                    <div>
                      <p className="font-medium text-navy">{doc.label}</p>
                      <p className="text-xs text-gray-500">{formatDateTime(doc.uploadedAt)}</p>
                    </div>
                  </div>
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-gold hover:underline"
                  >
                    Open
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dispatch Bills */}
      <Card>
        <CardHeader><CardTitle>Dispatch Bills ({dispatches.length})</CardTitle></CardHeader>
        <CardContent>
          {dispatches.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No dispatch bills yet</p>
          ) : (
            <div className="space-y-4">{dispatches.map((d) => renderBillCard(d, false))}</div>
          )}
        </CardContent>
      </Card>

      {/* Final Bills */}
      <Card>
        <CardHeader><CardTitle>Final Bills ({finalBills.length})</CardTitle></CardHeader>
        <CardContent>
          {finalBills.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No final bills yet</p>
          ) : (
            <div className="space-y-4">{finalBills.map((d) => renderBillCard(d, true))}</div>
          )}
        </CardContent>
      </Card>

      {/* Payment History with allocation */}
      <Card>
        <CardHeader><CardTitle>Payment History</CardTitle></CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No payments recorded yet</p>
          ) : (
            <div className="space-y-3">
              {payments.map((p) => (
                <div key={p._id} className="border rounded-lg p-4 text-sm">
                  <div className="flex flex-wrap justify-between gap-2 mb-2">
                    <div>
                      <span className="font-medium text-gold">{p.paymentId}</span>
                      <span className="text-gray-500 ml-2">{formatDateTime(p.date)}</span>
                    </div>
                    <span className="font-bold text-green-700">{formatCurrency(p.amount)}</span>
                  </div>
                  <p className="text-gray-500 text-xs mb-2">Method: {p.method}</p>
                  {p.allocations?.length > 0 && (
                    <div className="bg-gray-50 rounded p-2 space-y-1">
                      <p className="text-xs font-medium text-navy">Allocation:</p>
                      {p.allocations.map((a, i) => (
                        <p key={i} className="text-xs text-gray-600">
                          → {a.billType} Bill <strong>{a.billCode}</strong>: {formatCurrency(a.amount)}
                        </p>
                      ))}
                    </div>
                  )}
                  {p.creditAdded > 0 && (
                    <p className="text-xs text-gold font-medium mt-2">
                      + {formatCurrency(p.creditAdded)} advance credit account me save
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Record Payment Dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Customer Payment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Payment automatically allocate hoga — pehle purani pending bills, phir nayi.
              {stats.totalPending > 0 && (
                <span className="block mt-1 text-red-600">
                  Current pending: {formatCurrency(stats.totalPending)}
                </span>
              )}
            </p>
            <div>
              <Label>Amount (₹) *</Label>
              <Input
                type="number"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder="e.g. 8000"
              />
            </div>
            <div>
              <Label>Method</Label>
              <Select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={payNotes} onChange={(e) => setPayNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button variant="gold" onClick={handlePayment} disabled={submitting}>
              {submitting ? "Saving..." : "Record & Allocate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Customer Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Customer Details</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              ["name", "Name *"],
              ["phone", "Phone *"],
              ["companyName", "Company"],
              ["whatsappNumber", "WhatsApp"],
              ["email", "Email"],
              ["city", "City"],
              ["state", "State"],
              ["pincode", "Pincode"],
              ["gstNumber", "GST Number"],
            ].map(([key, label]) => (
              <div key={key}>
                <Label>{label}</Label>
                <Input
                  value={editForm[key] || ""}
                  onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                />
              </div>
            ))}
            <div className="sm:col-span-2">
              <Label>Address</Label>
              <Textarea
                value={editForm.address || ""}
                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Notes</Label>
              <Textarea
                value={editForm.notes || ""}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              />
            </div>

            {/* Payment section inside Edit Details */}
            <div className="sm:col-span-2 border-t pt-4 mt-2">
              <p className="font-medium text-navy mb-3 flex items-center gap-2">
                <IndianRupee className="h-4 w-4 text-gold" />
                Payment Add Karein (Optional)
              </p>
              <p className="text-xs text-gray-500 mb-3">
                Amount daalne par pehle pending bills clear hongi, zyada ho to advance credit me save hoga.
                {stats.totalPending > 0 && (
                  <span className="block text-red-600 mt-1">
                    Current pending: {formatCurrency(stats.totalPending)}
                  </span>
                )}
                {stats.creditBalance > 0 && (
                  <span className="block text-gold mt-1">
                    Existing advance credit: {formatCurrency(stats.creditBalance)}
                  </span>
                )}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Payment Amount (₹)</Label>
                  <Input
                    type="number"
                    value={editPaymentAmount}
                    onChange={(e) => setEditPaymentAmount(e.target.value)}
                    placeholder="e.g. 8000"
                  />
                </div>
                <div>
                  <Label>Payment Method</Label>
                  <Select value={editPayMethod} onChange={(e) => setEditPayMethod(e.target.value)}>
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </Select>
                </div>
              </div>

              {editPayPreview && editPayPreview.allocations.length > 0 && (
                <div className="mt-3 rounded-lg bg-green-50 border border-green-100 p-3 text-xs space-y-1">
                  <p className="font-medium text-navy">Allocation Preview:</p>
                  {editPayPreview.allocations.map((a, i) => (
                    <p key={i} className="text-gray-700">
                      → {a.billType} Bill <strong>{a.billId}</strong>: {formatCurrency(a.amount)} clear
                      {a.pendingAfter > 0 ? ` (${formatCurrency(a.pendingAfter)} ab baki)` : " ✓"}
                    </p>
                  ))}
                  {editPayPreview.creditAdded > 0 && (
                    <p className="text-gold font-medium mt-1">
                      + {formatCurrency(editPayPreview.creditAdded)} advance credit account me jayega
                    </p>
                  )}
                  <p className="text-gray-600 mt-1 border-t pt-1">
                    Pending after payment: <strong>{formatCurrency(editPayPreview.totalPendingAfter)}</strong>
                  </p>
                </div>
              )}
              {editPayPreview && editPayPreview.allocations.length === 0 && editPayPreview.creditAdded > 0 && (
                <div className="mt-3 rounded-lg bg-gold/10 border border-gold/20 p-3 text-xs">
                  <p className="text-gold font-medium">
                    Poori amount {formatCurrency(editPayPreview.creditAdded)} advance credit me save hogi
                    (koi pending bill nahi)
                  </p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button variant="gold" onClick={handleEdit} disabled={submitting}>
              {submitting
                ? "Saving..."
                : editPaymentAmount && parseFloat(editPaymentAmount) > 0
                  ? "Save & Record Payment"
                  : "Save Details"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
