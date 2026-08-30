"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader, EmptyState } from "@/components/ui/loading";
import { StatusBadge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { formatCurrency, formatDate, formatDateTime, generateWhatsAppUrl } from "@/lib/utils";
import { DEFAULT_WHATSAPP_NUMBER } from "@/lib/constants";
import {
  generateDispatchPDF,
  generateConfirmBillPDF,
  downloadPDF,
  generateWhatsAppDispatchMessage,
  generateWhatsAppConfirmBillMessage,
} from "@/lib/pdf";
import { ArrowLeft, Download, MessageCircle, Truck, CheckCircle } from "lucide-react";
import { PaymentSummaryCard, SingleBillPaymentBox } from "@/components/payment-ledger";
import { BillItemsTable } from "@/components/bill-items-table";
import { toBillItemRow } from "@/lib/bill-pricing";
import type { PaymentSummary } from "@/lib/payment-ledger";

interface OrderItem {
  productId: string;
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
  productVerified?: boolean;
  quantityVerified?: boolean;
  priceVerified?: boolean;
}

interface Order {
  _id: string;
  orderId: string;
  customerId: string;
  customerName: string;
  customerCode: string;
  orderDate: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  total: number;
  advance: number;
  pending: number;
  paidAmount: number;
  paymentStatus: string;
  salespersonName: string;
  notes?: string;
  status: string;
  inventoryDeducted: boolean;
  verifiedAt?: string;
  verifiedByName?: string;
  dispatchedAt?: string;
  confirmedAt?: string;
}

interface Dispatch {
  dispatchId: string;
  dispatchDate: string;
  verifiedByName: string;
  items: OrderItem[];
  total: number;
  advance: number;
  pending: number;
  paymentStatus: string;
  salespersonName: string;
}

interface ConfirmBill {
  confirmBillId: string;
  confirmDate: string;
  confirmedByName: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  total: number;
  advance: number;
  pending: number;
  paymentStatus: string;
  salespersonName: string;
}

export default function OrderDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [dispatch, setDispatch] = useState<Dispatch | null>(null);
  const [confirmBill, setConfirmBill] = useState<ConfirmBill | null>(null);
  const [verification, setVerification] = useState<
    Record<string, { productVerified: boolean; quantityVerified: boolean; priceVerified: boolean }>
  >({});
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [customerLedger, setCustomerLedger] = useState<PaymentSummary | null>(null);

  const fetchOrder = async () => {
    setLoading(true);
    const res = await fetch(`/api/orders/${id}`);
    const data = await res.json();
    if (!res.ok || !data.order) {
      setNotFound(true);
      setOrder(null);
      setLoading(false);
      return;
    }
    setNotFound(false);
    setOrder(data.order);
    setDispatch(data.dispatch || null);
    setConfirmBill(data.confirmBill || null);
    if (data.order.customerId) {
      fetch(`/api/customers/${data.order.customerId}`)
        .then((r) => r.json())
        .then((d) => setCustomerLedger(d.paymentLedger || null))
        .catch(() => {});
    }
    const v: typeof verification = {};
    data.order.items.forEach((item: OrderItem) => {
      v[item.productId] = {
        productVerified: item.productVerified || false,
        quantityVerified: item.quantityVerified || false,
        priceVerified: item.priceVerified || false,
      };
    });
    setVerification(v);
    setLoading(false);
  };

  useEffect(() => {
    fetchOrder();
    fetch("/api/settings").then((r) => r.json()).then((d) => setWhatsappNumber(d.settings?.whatsappNumber || "")).catch(() => {});
  }, [id]);

  const toggleVerification = (
    productId: string,
    field: "productVerified" | "quantityVerified" | "priceVerified"
  ) => {
    setVerification((prev) => ({
      ...prev,
      [productId]: { ...prev[productId], [field]: !prev[productId]?.[field] },
    }));
  };

  const allVerified = order?.items.every(
    (item) =>
      verification[item.productId]?.productVerified &&
      verification[item.productId]?.quantityVerified &&
      verification[item.productId]?.priceVerified
  );

  const handleGenerateDispatch = async () => {
    setProcessing(true);
    try {
      const items = order!.items.map((item) => ({
        productId: item.productId,
        ...verification[item.productId],
      }));
      const res = await fetch(`/api/orders/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dispatch", items }),
      });
      const result = await res.json();
      if (!res.ok) { toast(result.error, "error"); return; }
      toast("Dispatch bill generated", "success");
      setDispatchOpen(false);
      fetchOrder();
    } catch {
      toast("Something went wrong", "error");
    } finally {
      setProcessing(false);
    }
  };

  const handleGenerateConfirm = async () => {
    setProcessing(true);
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm" }),
      });
      const result = await res.json();
      if (!res.ok) { toast(result.error, "error"); return; }
      toast("Confirm bill generated — stock deducted", "success");
      setConfirmOpen(false);
      fetchOrder();
    } catch {
      toast("Something went wrong", "error");
    } finally {
      setProcessing(false);
    }
  };

  const handleDownloadDispatchPDF = () => {
    if (!dispatch || !order) return;
    const doc = generateDispatchPDF({
      dispatchId: dispatch.dispatchId,
      dispatchDate: dispatch.dispatchDate,
      orderId: order.orderId,
      orderDate: order.orderDate,
      customerName: order.customerName,
      customerCode: order.customerCode,
      verifiedByName: dispatch.verifiedByName,
      salespersonName: dispatch.salespersonName,
      items: dispatch.items.map((i) => ({ ...i, boxes: i.boxes ?? 0 })),
      subtotal: order.subtotal,
      discount: order.discount,
      total: dispatch.total,
      advance: dispatch.advance,
      pending: dispatch.pending,
      paymentStatus: dispatch.paymentStatus,
    });
    downloadPDF(doc, `Dispatch-${dispatch.dispatchId}.pdf`);
  };

  const handleWhatsAppDispatch = () => {
    if (!dispatch || !order) return;
    const msg = generateWhatsAppDispatchMessage({
      customerName: order.customerName,
      customerCode: order.customerCode,
      dispatchId: dispatch.dispatchId,
      orderId: order.orderId,
      total: dispatch.total,
      advance: dispatch.advance,
      pending: dispatch.pending,
      paymentStatus: dispatch.paymentStatus,
    });
    window.open(generateWhatsAppUrl(whatsappNumber || DEFAULT_WHATSAPP_NUMBER, msg), "_blank");
  };

  const handleDownloadConfirmPDF = () => {
    if (!confirmBill || !order) return;
    const doc = generateConfirmBillPDF({
      confirmBillId: confirmBill.confirmBillId,
      confirmDate: confirmBill.confirmDate,
      orderId: order.orderId,
      orderDate: order.orderDate,
      customerName: order.customerName,
      customerCode: order.customerCode,
      confirmedByName: confirmBill.confirmedByName,
      salespersonName: confirmBill.salespersonName,
      items: confirmBill.items.map((i) => ({ ...i, boxes: i.boxes ?? 0 })),
      subtotal: confirmBill.subtotal,
      discount: confirmBill.discount,
      total: confirmBill.total,
      advance: confirmBill.advance,
      pending: confirmBill.pending,
      paymentStatus: confirmBill.paymentStatus,
    });
    downloadPDF(doc, `Confirm-${confirmBill.confirmBillId}.pdf`);
  };

  const handleWhatsAppConfirm = () => {
    if (!confirmBill || !order) return;
    const msg = generateWhatsAppConfirmBillMessage({
      customerName: order.customerName,
      customerCode: order.customerCode,
      confirmBillId: confirmBill.confirmBillId,
      orderId: order.orderId,
      total: confirmBill.total,
      advance: confirmBill.advance,
      pending: confirmBill.pending,
      paymentStatus: confirmBill.paymentStatus,
    });
    window.open(generateWhatsAppUrl(whatsappNumber || DEFAULT_WHATSAPP_NUMBER, msg), "_blank");
  };

  if (loading) return <PageLoader />;
  if (notFound || !order) {
    return (
      <EmptyState
        title="Order not found"
        description="Legacy order record nahi mila."
        action={
          <Link href="/admin/orders">
            <Button variant="outline">Back to Orders</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/admin/orders">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-serif font-bold text-navy">{order.orderId}</h1>
            <p className="text-sm text-gray-500">{order.customerName} · <span className="text-gold">{order.customerCode}</span></p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!dispatch && (
            <Button variant="gold" size="sm" onClick={() => setDispatchOpen(true)} disabled={!allVerified}>
              <Truck className="h-4 w-4" /> Generate Dispatch Bill
            </Button>
          )}
          {dispatch && !confirmBill && (
            <Button variant="gold" size="sm" onClick={() => setConfirmOpen(true)}>
              <CheckCircle className="h-4 w-4" /> Generate Confirm Bill
            </Button>
          )}
        </div>
      </div>

      {/* This Bill Payment Breakdown */}
      <SingleBillPaymentBox
        billAmount={order.total}
        clientPaid={order.paidAmount ?? order.advance}
        pending={order.pending}
        paymentStatus={order.paymentStatus}
        label={`This Bill (${order.orderId}) — Kitna tha aur kitna diya`}
      />

      {/* Customer cumulative summary from all previous bills */}
      {customerLedger && (
        <PaymentSummaryCard
          summary={customerLedger}
          customerName={order.customerName}
          customerId={order.customerCode}
          showSummary={false}
          showLedger={true}
          highlightBillId={order.orderId}
        />
      )}

      {/* Dispatch Bill Section */}
      {dispatch && (
        <Card className="border-gold/30">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-navy">Dispatch Bill — {dispatch.dispatchId}</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleDownloadDispatchPDF}>
                <Download className="h-4 w-4" /> Download PDF
              </Button>
              <Button variant="outline" size="sm" onClick={handleWhatsAppDispatch}>
                <MessageCircle className="h-4 w-4" /> Send WhatsApp
              </Button>
            </div>
          </CardHeader>
          <CardContent className="text-sm space-y-3">
            <SingleBillPaymentBox
              billAmount={dispatch.total}
              clientPaid={dispatch.advance}
              pending={dispatch.pending}
              paymentStatus={dispatch.paymentStatus}
              label="Dispatch Bill Payment"
            />
            <p><span className="text-gray-500">Customer:</span> {order.customerName} ({order.customerCode})</p>
            <p><span className="text-gray-500">Dispatch Date:</span> {formatDateTime(dispatch.dispatchDate)}</p>
            <p><span className="text-gray-500">Verified By:</span> {dispatch.verifiedByName}</p>
          </CardContent>
        </Card>
      )}

      {/* Confirm Bill Section */}
      {confirmBill && (
        <Card className="border-green-200">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-navy">Confirm Bill — {confirmBill.confirmBillId}</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleDownloadConfirmPDF}>
                <Download className="h-4 w-4" /> Download PDF
              </Button>
              <Button variant="outline" size="sm" onClick={handleWhatsAppConfirm}>
                <MessageCircle className="h-4 w-4" /> Send WhatsApp
              </Button>
            </div>
          </CardHeader>
          <CardContent className="text-sm space-y-3">
            <SingleBillPaymentBox
              billAmount={confirmBill.total}
              clientPaid={confirmBill.advance}
              pending={confirmBill.pending}
              paymentStatus={confirmBill.paymentStatus}
              label="Confirm Bill Payment"
            />
            <p><span className="text-gray-500">Customer:</span> {order.customerName} ({order.customerCode})</p>
            <p><span className="text-gray-500">Confirm Date:</span> {formatDateTime(confirmBill.confirmDate)}</p>
            <p><span className="text-gray-500">Confirmed By:</span> {confirmBill.confirmedByName}</p>
            <p className="text-green-700 font-medium">✓ Stock deducted from inventory</p>
          </CardContent>
        </Card>
      )}

      {/* Order Items with Verification */}
      <Card>
        <CardHeader><CardTitle>Order Items</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <BillItemsTable items={order.items.map((i) => toBillItemRow(i))} />
          {!dispatch && (
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left text-gray-500">
                    <th className="p-3 font-medium">Product</th>
                    <th className="p-3 font-medium text-center">Product ✓</th>
                    <th className="p-3 font-medium text-center">Qty ✓</th>
                    <th className="p-3 font-medium text-center">Price ✓</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.productId} className="border-b last:border-0">
                      <td className="p-3">
                        <p className="font-medium">{item.productName}</p>
                        <p className="text-xs text-gray-400">{item.productCode}</p>
                      </td>
                      <td className="p-3 text-center">
                        <input type="checkbox" checked={verification[item.productId]?.productVerified || false} onChange={() => toggleVerification(item.productId, "productVerified")} className="h-4 w-4 accent-gold" />
                      </td>
                      <td className="p-3 text-center">
                        <input type="checkbox" checked={verification[item.productId]?.quantityVerified || false} onChange={() => toggleVerification(item.productId, "quantityVerified")} className="h-4 w-4 accent-gold" />
                      </td>
                      <td className="p-3 text-center">
                        <input type="checkbox" checked={verification[item.productId]?.priceVerified || false} onChange={() => toggleVerification(item.productId, "priceVerified")} className="h-4 w-4 accent-gold" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={dispatchOpen}
        onOpenChange={setDispatchOpen}
        title="Generate Dispatch Bill"
        description="This will create a dispatch bill. Stock will NOT be deducted yet. You can download PDF and send on WhatsApp."
        confirmLabel="Generate Dispatch Bill"
        onConfirm={handleGenerateDispatch}
        loading={processing}
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Generate Confirm Bill"
        description="This will create a confirm bill and deduct stock from inventory. This action cannot be undone."
        confirmLabel="Generate Confirm Bill"
        onConfirm={handleGenerateConfirm}
        loading={processing}
      />
    </div>
  );
}
