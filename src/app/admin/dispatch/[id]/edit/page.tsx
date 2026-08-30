"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { PageLoader } from "@/components/ui/loading";
import { toast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils";
import {
  enrichBillLineItem,
  formatBillLineCalculation,
  piecePriceFromBox,
} from "@/lib/bill-pricing";
import { BillItemsTable } from "@/components/bill-items-table";
import { PAYMENT_METHODS } from "@/lib/constants";
import { formatProductDisplay } from "@/lib/product-display";
import { formatProductStock, isKgProduct } from "@/lib/product-units";
import {
  computeDispatchBillTotals,
  previewCreditApplication,
} from "@/lib/dispatch-bill-totals";
import { getBillPaymentDisplay } from "@/lib/bill-payment-display";
import { AddBillProductsDialog } from "@/components/add-bill-products-dialog";
import { BillFormItemsEditor } from "@/components/bill-form-items-editor";
import {
  type BillItemRow,
  billItemRowHasQty,
  billItemRowToApiPayload,
  billItemRowTotal,
  buildBillPreviewLines,
  emptyBillItemRow,
  mergeBillItemRows,
  newBillItemRowId,
  patchBillItemField,
  totalQtyForBillItem,
} from "@/lib/dispatch-bill-form";
import { ArrowLeft, Plus, Trash2, Save, PackagePlus, ListPlus } from "lucide-react";

interface Customer {
  _id: string;
  customerId: string;
  name: string;
  companyName?: string;
  phone?: string;
  address?: string;
  city?: string;
}

interface Product {
  _id: string;
  productId: string;
  name: string;
  sellingPrice: number;
  piecesPerBox: number;
  currentStock: number;
  sellingUnit?: string;
  unit?: string;
}

interface StoredDispatchItem {
  productId?: string;
  pieces: number;
  quantity?: number;
  discount?: number;
  sellMode?: "box" | "piece" | "mixed" | "kg";
  fullBoxes?: number;
  loosePieces?: number;
  boxes?: number;
  piecesPerBox?: number;
  unitPrice: number;
  piecePrice?: number;
}

function dispatchItemsToFormRows(items: StoredDispatchItem[]): BillItemRow[] {
  const map = new Map<string, BillItemRow>();

  for (const item of items) {
    const pid = item.productId ? String(item.productId) : "";
    if (!pid) continue;

    const pricing = enrichBillLineItem(item);
    const ppb = Math.max(item.piecesPerBox || 1, 1);
    const existing = map.get(pid) ?? {
      ...emptyBillItemRow(),
      id: newBillItemRowId(),
      productId: pid,
      boxPrice: item.unitPrice,
      piecePrice: item.piecePrice ?? piecePriceFromBox(item.unitPrice, ppb),
      kgPrice: item.unitPrice,
    };

    if (item.sellMode === "kg") {
      existing.kgQty += item.quantity ?? pricing.kgQty ?? item.pieces;
      existing.kgPrice = item.unitPrice;
    } else if (
      item.sellMode === "piece" ||
      (pricing.loosePieces > 0 && pricing.fullBoxes === 0)
    ) {
      existing.pieceQty += pricing.loosePieces;
      existing.piecePrice = item.piecePrice ?? piecePriceFromBox(item.unitPrice, ppb);
    } else {
      existing.boxQty += pricing.fullBoxes;
      existing.boxPrice = item.unitPrice;
    }

    map.set(pid, existing);
  }

  const rows = Array.from(map.values());
  return rows.length > 0 ? rows : [emptyBillItemRow()];
}

function stockAvailableForEdit(
  p: Product,
  item: BillItemRow,
  originalItems: StoredDispatchItem[]
) {
  const returned = originalItems
    .filter((i) => String(i.productId) === p._id)
    .reduce((s, i) => s + (i.pieces || 0), 0);
  const needed = totalQtyForBillItem(item, p);
  return needed <= p.currentStock + returned;
}

export default function EditDispatchBillPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [originalItems, setOriginalItems] = useState<StoredDispatchItem[]>([]);
  const [dispatchId, setDispatchId] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerCompany, setCustomerCompany] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerCity, setCustomerCity] = useState("");
  const [dispatchDate, setDispatchDate] = useState("");
  const [orderType, setOrderType] = useState<"immediate" | "advance">("immediate");
  const [readyByDate, setReadyByDate] = useState("");
  const [discount, setDiscount] = useState(0);
  const [advance, setAdvance] = useState(0);
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [salespersonName, setSalespersonName] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<BillItemRow[]>([emptyBillItemRow()]);
  const [bulkAddOpen, setBulkAddOpen] = useState(false);
  const [bulkAddQuickCreate, setBulkAddQuickCreate] = useState(false);
  const [carriedForwardPending, setCarriedForwardPending] = useState(0);
  const [accountCredit, setAccountCredit] = useState(0);

  useEffect(() => {
    Promise.all([
      fetch(`/api/dispatch/${id}`).then((r) => r.json()),
      fetch("/api/customers?lite=true&limit=500").then((r) => r.json()),
      fetch("/api/products?limit=500").then((r) => r.json()),
    ]).then(([d, c, p]) => {
      const dispatch = d.dispatch;
      if (!dispatch) {
        toast("Dispatch bill not found", "error");
        router.push("/admin/dispatch");
        return;
      }
      if (dispatch.billStatus === "FINAL" || dispatch.inventoryDeducted) {
        toast("Final bill edit nahi ho sakti", "error");
        router.push(`/admin/dispatch/${id}`);
        return;
      }

      setDispatchId(dispatch.dispatchId);
      setCustomerId(dispatch.customerId || "");
      setCustomerName(dispatch.customerName || "");
      setCustomerCompany(dispatch.customerCompany || "");
      setCustomerPhone(dispatch.customerPhone || "");
      setCustomerAddress(dispatch.customerAddress || "");
      setCustomerCity(dispatch.customerCity || "");
      setDispatchDate(
        dispatch.dispatchDate
          ? new Date(dispatch.dispatchDate).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0]
      );
      setOrderType(dispatch.orderType === "advance" ? "advance" : "immediate");
      setReadyByDate(
        dispatch.readyByDate
          ? new Date(dispatch.readyByDate).toISOString().split("T")[0]
          : ""
      );
      setDiscount(dispatch.discount || 0);
      setAdvance(
        dispatch.cashPaid && dispatch.cashPaid > 0
          ? dispatch.cashPaid
          : getBillPaymentDisplay({
              total: dispatch.total,
              advance: dispatch.advance,
              pending: dispatch.pending,
              creditAdded: dispatch.creditAdded,
              creditApplied: dispatch.creditApplied,
            }).cashPaid
      );
      setCarriedForwardPending(dispatch.carriedForwardPending || 0);
      setPaymentMode(dispatch.paymentMode || "Cash");
      setSalespersonName(dispatch.salespersonName || "");
      setNotes(dispatch.notes || "");
      setOriginalItems(dispatch.items || []);
      setItems(dispatchItemsToFormRows(dispatch.items || []));

      setCustomers(c.customers || []);
      setProducts(p.products || []);
      if (dispatch.customerId) {
        fetch(`/api/customers/${dispatch.customerId}/account-balance`)
          .then((r) => r.json())
          .then((data) => {
            if (data.availableCredit != null) setAccountCredit(data.availableCredit);
          })
          .catch(() => {});
      }
      setLoading(false);
    });
  }, [id, router]);

  const updateItem = (index: number, field: keyof BillItemRow, value: string | number) => {
    setItems((prev) => {
      const next = [...prev];
      const product =
        field === "productId"
          ? products.find((x) => x._id === value)
          : products.find((x) => x._id === next[index].productId);
      next[index] = patchBillItemField(next[index], field, value, product);
      return next;
    });
  };

  const openQuickAdd = (withNewProduct = false) => {
    setBulkAddQuickCreate(withNewProduct);
    setBulkAddOpen(true);
  };

  const getItemTotal = (item: BillItemRow) => {
    const p = products.find((x) => x._id === item.productId);
    if (!p) return 0;
    return billItemRowTotal(item, p);
  };

  const subtotal = items.reduce((s, i) => s + (i.productId ? getItemTotal(i) : 0), 0);
  const billDiscount = advance > 0 ? discount : 0;
  const { creditApplied: previewCredit } = previewCreditApplication(
    Math.max(0, subtotal - billDiscount) + carriedForwardPending,
    advance,
    customerId ? accountCredit : 0
  );
  const billTotals = computeDispatchBillTotals({
    subtotal,
    discount: billDiscount,
    carriedForwardPending,
    cashPaid: advance,
    creditApplied: customerId ? previewCredit : 0,
  });
  const { total, pending, creditAdded, currentBillAmount } = billTotals;

  const previewItems = items
    .filter((i) => {
      const p = products.find((x) => x._id === i.productId);
      return i.productId && p && billItemRowHasQty(i, p);
    })
    .flatMap((item) => {
      const p = products.find((x) => x._id === item.productId)!;
      return buildBillPreviewLines(item, p).map((line) => ({
        productName: p.name,
        productCode: p.productId,
        pieces: line.pieces,
        boxes: line.fullBoxes,
        fullBoxes: line.fullBoxes,
        loosePieces: line.loosePieces,
        piecesPerBox: isKgProduct(p) ? 1 : p.piecesPerBox,
        unitPrice: isKgProduct(p) ? (line.kgPrice ?? p.sellingPrice) : line.boxPrice,
        piecePrice: line.piecePrice,
        discount: line.discount,
        total: line.total,
        sellMode: line.sellMode,
        calculation: formatBillLineCalculation(line),
      }));
    });

  const isAdvance = orderType === "advance";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      toast("Customer name is required", "error");
      return;
    }
    if (!salespersonName.trim()) {
      toast("Bill banane wale ka naam enter karein", "error");
      return;
    }
    const validItems = items.filter((i) => {
      const p = products.find((x) => x._id === i.productId);
      return i.productId && p && billItemRowHasQty(i, p);
    });
    if (validItems.length === 0) {
      toast("Add at least one product with box, piece, or kg qty", "error");
      return;
    }

    if (isAdvance && !readyByDate) {
      toast("Advance order ke liye maal ready date select karein", "error");
      return;
    }
    if (isAdvance && advance <= 0) {
      toast("Advance order me payment amount required hai", "error");
      return;
    }

    for (const item of validItems) {
      const p = products.find((x) => x._id === item.productId);
      if (!p) continue;
      const needed = totalQtyForBillItem(item, p);
      if (needed <= 0) {
        toast(
          isKgProduct(p)
            ? `Enter kg qty for ${p.name}`
            : `Enter box or piece qty for ${p.name}`,
          "error"
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/dispatch/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customerId || undefined,
          customerName,
          customerCompany,
          customerPhone,
          customerAddress,
          customerCity,
          dispatchDate,
          orderType,
          readyByDate: isAdvance ? readyByDate : undefined,
          items: validItems.map((i) => {
            const p = products.find((x) => x._id === i.productId)!;
            return billItemRowToApiPayload(i, p);
          }),
          discount: advance > 0 ? discount : 0,
          advance,
          paymentMode: advance > 0 ? paymentMode : undefined,
          salespersonName: salespersonName.trim(),
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error, "error");
        return;
      }
      toast("Dispatch bill updated", "success");
      router.push(`/admin/dispatch/${id}`);
    } catch {
      toast("Something went wrong", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Link href={`/admin/dispatch/${id}`}>
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-serif font-bold text-navy">Edit Dispatch Bill</h1>
          <p className="text-sm text-gold">{dispatchId}</p>
          <p className="text-xs text-gray-500 mt-1">Final karne se pehle bill edit kar sakte hain</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Customer Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label>Select Existing Customer (optional)</Label>
              <Select
                value={customerId}
                onChange={(e) => {
                  const cid = e.target.value;
                  setCustomerId(cid);
                  const c = customers.find((x) => x._id === cid);
                  if (c) {
                    setCustomerName(c.name);
                    setCustomerCompany(c.companyName || "");
                    setCustomerPhone(c.phone || "");
                    setCustomerAddress(c.address || "");
                    setCustomerCity(c.city || "");
                  }
                }}
              >
                <option value="">Walk-in / Manual</option>
                {customers.map((c) => (
                  <option key={c._id} value={c._id}>{c.name} ({c.customerId})</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Customer Name *</Label>
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
            </div>
            <div>
              <Label>Company Name</Label>
              <Input value={customerCompany} onChange={(e) => setCustomerCompany(e.target.value)} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
            </div>
            <div>
              <Label>City</Label>
              <Input value={customerCity} onChange={(e) => setCustomerCity(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Address</Label>
              <Input value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} />
            </div>
            <div>
              <Label>Order Date</Label>
              <Input type="date" value={dispatchDate} onChange={(e) => setDispatchDate(e.target.value)} />
            </div>
            <div>
              <Label>Order Type</Label>
              <Select value={orderType} onChange={(e) => setOrderType(e.target.value as "immediate" | "advance")}>
                <option value="immediate">Normal Bill</option>
                <option value="advance">Advance Order</option>
              </Select>
            </div>
            {isAdvance && (
              <div>
                <Label>Maal Ready Date *</Label>
                <Input type="date" value={readyByDate} onChange={(e) => setReadyByDate(e.target.value)} />
              </div>
            )}
            <div>
              <Label>Bill Banane Wale Ka Naam *</Label>
              <Input value={salespersonName} onChange={(e) => setSalespersonName(e.target.value)} required />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
            <CardTitle>Products</CardTitle>
            <div className="flex gap-2 flex-wrap">
            <Button
              type="button"
              variant="gold"
              size="sm"
              onClick={() => setBulkAddOpen(true)}
            >
              <ListPlus className="h-4 w-4" /> Quick Add Products
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => openQuickAdd(true)}
            >
              <PackagePlus className="h-4 w-4" /> Naya Product
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="hidden md:inline-flex"
              onClick={() => setItems((p) => [...p, emptyBillItemRow()])}
            >
              <Plus className="h-4 w-4" /> Add Product
            </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="hidden md:block">
              <BillFormItemsEditor
                items={items}
                products={products}
                onItemsChange={setItems}
                onOpenQuickAdd={() => openQuickAdd(true)}
              />
            </div>
            <p className="md:hidden text-sm text-gray-600">
              Mobile par products <strong>Quick Add Products</strong> se jodhein — neeche Bill Preview mein sab dikhega.
            </p>
          </CardContent>
        </Card>

        {previewItems.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Updated Bill Preview</CardTitle></CardHeader>
            <CardContent><BillItemsTable items={previewItems} /></CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle>Bill Summary</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <Label>Customer Paid (₹)</Label>
                <Input
                  type="number"
                  min={0}
                  value={advance > 0 ? advance : ""}
                  placeholder="0"
                  onChange={(e) => {
                    const v = e.target.value === "" ? 0 : Math.max(0, Number(e.target.value) || 0);
                    setAdvance(v);
                    if (v <= 0) setDiscount(0);
                  }}
                />
              </div>
              {advance > 0 && (
                <div>
                  <Label>Bill Discount (₹)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={discount}
                    onChange={(e) => setDiscount(Number(e.target.value))}
                  />
                </div>
              )}
              <div>
                <Label>Payment Mode</Label>
                <Select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} disabled={advance <= 0}>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="rounded-lg bg-gray-50 p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
              {billDiscount > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Discount</span><span>-{formatCurrency(billDiscount)}</span>
                </div>
              )}
              {carriedForwardPending > 0 && (
                <>
                  <div className="flex justify-between"><span>Is Bill Ka Amount</span><span>{formatCurrency(currentBillAmount)}</span></div>
                  <div className="flex justify-between text-amber-700 font-medium">
                    <span>+ Purani Pending (Account)</span>
                    <span>{formatCurrency(carriedForwardPending)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between font-bold border-t pt-2">
                <span>Grand Total</span><span>{formatCurrency(total)}</span>
              </div>
              {advance > 0 && (
                <div className="flex justify-between text-green-700"><span>Customer Paid</span><span>{formatCurrency(advance)}</span></div>
              )}
              {previewCredit > 0 && (
                <div className="flex justify-between text-green-700">
                  <span>Account Advance (bill par use)</span>
                  <span>{formatCurrency(previewCredit)}</span>
                </div>
              )}
              {creditAdded > 0 && (
                <div className="flex justify-between text-gold font-semibold">
                  <span>Advance (Account me save)</span>
                  <span>{formatCurrency(creditAdded)}</span>
                </div>
              )}
              {pending > 0 ? (
                <div className="flex justify-between text-red-600 font-bold"><span>Pending</span><span>{formatCurrency(pending)}</span></div>
              ) : creditAdded <= 0 ? (
                <div className="flex justify-between text-green-700 font-bold"><span>Pending</span><span>{formatCurrency(0)}</span></div>
              ) : null}
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" variant="gold" disabled={submitting}>
            <Save className="h-5 w-5" /> {submitting ? "Saving..." : "Save Changes"}
          </Button>
          <Link href={`/admin/dispatch/${id}`}>
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
        </div>
      </form>

      <AddBillProductsDialog
        open={bulkAddOpen}
        onOpenChange={(open) => {
          setBulkAddOpen(open);
          if (!open) setBulkAddQuickCreate(false);
        }}
        products={products}
        onProductsChange={setProducts}
        startWithQuickCreate={bulkAddQuickCreate}
        onAdd={(rows) =>
          setItems((prev) => mergeBillItemRows(prev, rows, products))
        }
      />
    </div>
  );
}
