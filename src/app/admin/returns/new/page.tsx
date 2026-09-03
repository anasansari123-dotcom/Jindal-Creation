"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageLoader } from "@/components/ui/loading";
import { toast } from "@/components/ui/toast";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PAYMENT_METHODS } from "@/lib/constants";
import { ArrowLeft, RotateCcw, Package } from "lucide-react";

interface FinalBillOption {
  _id: string;
  dispatchId: string;
  finalBillId?: string;
  customerName: string;
  total: number;
  dispatchDate: string;
}

interface ReturnableItem {
  productId?: string;
  productName: string;
  productCode: string;
  sellMode?: string;
  soldPieces: number;
  alreadyReturned: number;
  maxReturnable: number;
  lineTotal: number;
  unitPrice: number;
}

interface BillReturnData {
  dispatch: {
    _id: string;
    dispatchId: string;
    finalBillId?: string;
    customerName: string;
    total: number;
    pending: number;
    returnedAmount: number;
  };
  items: ReturnableItem[];
}

export default function NewReturnPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedBill = searchParams.get("dispatchId") || "";

  const [bills, setBills] = useState<FinalBillOption[]>([]);
  const [loadingBills, setLoadingBills] = useState(true);
  const [selectedBillId, setSelectedBillId] = useState(preselectedBill);
  const [billData, setBillData] = useState<BillReturnData | null>(null);
  const [loadingBill, setLoadingBill] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [returnQty, setReturnQty] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [refundMethod, setRefundMethod] = useState<"credit" | "cash" | "adjust_pending">("adjust_pending");
  const [refundMethodDetail, setRefundMethodDetail] = useState("Cash");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    fetch("/api/dispatch?status=FINAL&limit=100")
      .then((r) => r.json())
      .then((d) => setBills(d.dispatches || []))
      .finally(() => setLoadingBills(false));
  }, []);

  const loadBill = useCallback(async (mongoId: string) => {
    if (!mongoId) {
      setBillData(null);
      return;
    }
    setLoadingBill(true);
    try {
      const res = await fetch(`/api/returns/bill?dispatchMongoId=${mongoId}`);
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Bill load fail", "error");
        setBillData(null);
        return;
      }
      setBillData(data);
      setReturnQty({});
      setReasons({});
    } catch {
      toast("Bill load fail", "error");
    } finally {
      setLoadingBill(false);
    }
  }, []);

  useEffect(() => {
    if (selectedBillId) loadBill(selectedBillId);
  }, [selectedBillId, loadBill]);

  const estimatedRefund = useMemo(() => {
    if (!billData) return 0;
    let total = 0;
    for (const item of billData.items) {
      const qty = parseFloat(returnQty[item.productId || ""] || "0");
      if (!qty || qty <= 0 || item.soldPieces <= 0) continue;
      const ratio = Math.min(qty / item.soldPieces, 1);
      total += item.lineTotal * ratio;
    }
    return Math.round(total * 100) / 100;
  }, [billData, returnQty]);

  const handleSubmit = async () => {
    if (!selectedBillId || !billData) {
      toast("Pehle Final Bill select karein", "error");
      return;
    }

    const items = billData.items
      .map((item) => {
        const qty = parseFloat(returnQty[item.productId || ""] || "0");
        if (!qty || qty <= 0) return null;
        return {
          productId: item.productId!,
          returnPieces: qty,
          reason: reasons[item.productId || ""]?.trim() || undefined,
        };
      })
      .filter(Boolean) as Array<{ productId: string; returnPieces: number; reason?: string }>;

    if (items.length === 0) {
      toast("Kam se kam ek product ki return quantity daalein", "error");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dispatchMongoId: selectedBillId,
          items,
          refundMethod,
          refundMethodDetail: refundMethod === "cash" ? refundMethodDetail : undefined,
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Return fail", "error");
        return;
      }
      toast(data.message || "Return processed", "success");
      router.push(`/admin/returns/${data.return._id}`);
    } catch {
      toast("Something went wrong", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingBills) return <PageLoader />;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Link href="/admin/returns">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-serif font-bold text-navy flex items-center gap-2">
            <RotateCcw className="h-6 w-6 text-gold" />
            New Product Return
          </h1>
          <p className="text-sm text-gray-500">Final Bill se maal wapas — stock restore + bill adjust</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Step 1 — Final Bill Select Karein</CardTitle>
        </CardHeader>
        <CardContent>
          <Label>Final Bill</Label>
          <Select
            value={selectedBillId}
            onChange={(e) => setSelectedBillId(e.target.value)}
            className="mt-1"
          >
            <option value="">Bill choose karein...</option>
            {bills.map((b) => (
              <option key={b._id} value={b._id}>
                {b.finalBillId || b.dispatchId} — {b.customerName} ({formatCurrency(b.total)}) —{" "}
                {formatDate(b.dispatchDate)}
              </option>
            ))}
          </Select>
        </CardContent>
      </Card>

      {loadingBill && <PageLoader />}

      {billData && !loadingBill && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Bill Summary</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Customer</p>
                <p className="font-medium">{billData.dispatch.customerName}</p>
              </div>
              <div>
                <p className="text-gray-500">Bill Total</p>
                <p className="font-medium">{formatCurrency(billData.dispatch.total)}</p>
              </div>
              <div>
                <p className="text-gray-500">Pending</p>
                <p className="font-medium text-red-600">{formatCurrency(billData.dispatch.pending)}</p>
              </div>
              <div>
                <p className="text-gray-500">Pehle Return</p>
                <p className="font-medium text-amber-700">
                  {billData.dispatch.returnedAmount > 0
                    ? formatCurrency(billData.dispatch.returnedAmount)
                    : "—"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-gold" />
                Step 2 — Return Products
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {billData.items.every((i) => i.maxReturnable <= 0) ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  Is bill ke saare products pehle hi return ho chuke hain.
                </p>
              ) : (
                billData.items.map((item) => (
                  <div
                    key={item.productId}
                    className={`rounded-lg border p-4 space-y-3 ${
                      item.maxReturnable <= 0 ? "opacity-50 bg-gray-50" : ""
                    }`}
                  >
                    <div className="flex flex-wrap justify-between gap-2">
                      <div>
                        <p className="font-medium text-navy">{item.productName}</p>
                        <p className="text-xs text-gray-500">
                          {item.productCode} · Sold: {item.soldPieces}
                          {item.sellMode === "kg" ? " Kg" : " pc"}
                          {item.alreadyReturned > 0 && (
                            <span className="text-amber-600"> · Returned: {item.alreadyReturned}</span>
                          )}
                        </p>
                      </div>
                      <p className="text-sm font-medium">{formatCurrency(item.lineTotal)}</p>
                    </div>
                    {item.maxReturnable > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <Label>Return Qty (max {item.maxReturnable})</Label>
                          <Input
                            type="number"
                            min="0"
                            max={item.maxReturnable}
                            step="0.01"
                            value={returnQty[item.productId || ""] || ""}
                            onChange={(e) =>
                              setReturnQty({ ...returnQty, [item.productId || ""]: e.target.value })
                            }
                            placeholder={`0 — max ${item.maxReturnable}`}
                          />
                        </div>
                        <div>
                          <Label>Reason (optional)</Label>
                          <Input
                            value={reasons[item.productId || ""] || ""}
                            onChange={(e) =>
                              setReasons({ ...reasons, [item.productId || ""]: e.target.value })
                            }
                            placeholder="e.g. Damaged, Wrong item"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Step 3 — Refund &amp; Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-gold/10 border border-gold/20 p-4">
                <p className="text-sm text-gray-600">Estimated Return Amount</p>
                <p className="text-2xl font-bold text-navy">{formatCurrency(estimatedRefund)}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Refund Method</Label>
                  <Select
                    value={refundMethod}
                    onChange={(e) =>
                      setRefundMethod(e.target.value as "credit" | "cash" | "adjust_pending")
                    }
                  >
                    <option value="adjust_pending">Pending se adjust (default)</option>
                    <option value="credit">Customer account me credit</option>
                    <option value="cash">Cash / UPI refund (record only)</option>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">
                    {refundMethod === "adjust_pending" &&
                      "Bill pending kam hogi — agar zyada paid hai to advance adjust"}
                    {refundMethod === "credit" &&
                      "Extra paid amount customer ke advance credit me jayega"}
                    {refundMethod === "cash" &&
                      "Cash refund record — manually customer ko paise dein"}
                  </p>
                </div>
                {refundMethod === "cash" && (
                  <div>
                    <Label>Refund Via</Label>
                    <Select
                      value={refundMethodDetail}
                      onChange={(e) => setRefundMethodDetail(e.target.value)}
                    >
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}
              </div>

              <div>
                <Label>Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Return ki extra details..."
                />
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <Button
                  variant="gold"
                  onClick={handleSubmit}
                  disabled={submitting || estimatedRefund <= 0}
                >
                  {submitting ? "Processing..." : "Process Return"}
                </Button>
                <Link href="/admin/returns">
                  <Button variant="outline">Cancel</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
