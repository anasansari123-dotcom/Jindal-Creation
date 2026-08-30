"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  formatBillLineCalculation,
} from "@/lib/bill-pricing";
import {
  computeDispatchBillTotals,
  previewCreditApplication,
} from "@/lib/dispatch-bill-totals";
import { BillItemsTable } from "@/components/bill-items-table";
import { PAYMENT_METHODS } from "@/lib/constants";
import { isKgProduct } from "@/lib/product-units";
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
  patchBillItemField,
  totalQtyForBillItem,
} from "@/lib/dispatch-bill-form";
import {
  clearDispatchBillDraft,
  dispatchBillDraftHasContent,
  loadDispatchBillDraft,
  saveDispatchBillDraft,
} from "@/lib/dispatch-bill-draft";
import { ArrowLeft, Plus, Save, CalendarClock, PackagePlus, ListPlus, Wallet, RotateCcw } from "lucide-react";

interface AccountBalance {
  pendingFromOldBills: number;
  netAccountPending: number;
  creditBalance: number;
  availableCredit: number;
  pendingBillCount: number;
  pendingBills: Array<{ billId: string; pending: number }>;
}

export default function NewDispatchBillPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <NewDispatchBillContent />
    </Suspense>
  );
}

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

function NewDispatchBillContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultAdvance = searchParams.get("type") === "advance";
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerCompany, setCustomerCompany] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerCity, setCustomerCity] = useState("");
  const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().split("T")[0]);
  const [orderType, setOrderType] = useState<"immediate" | "advance">(
    defaultAdvance ? "advance" : "immediate"
  );
  const [readyByDate, setReadyByDate] = useState("");
  const [discount, setDiscount] = useState(0);
  const [advance, setAdvance] = useState(0);
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [salespersonName, setSalespersonName] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<BillItemRow[]>([emptyBillItemRow()]);
  const [bulkAddOpen, setBulkAddOpen] = useState(false);
  const [bulkAddQuickCreate, setBulkAddQuickCreate] = useState(false);
  const [accountBalance, setAccountBalance] = useState<AccountBalance | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [includeCarriedForward, setIncludeCarriedForward] = useState(true);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const draftRestoreToastShown = useRef(false);

  const isAdvance = orderType === "advance";

  const loadAccountBalance = async (id: string) => {
    setBalanceLoading(true);
    try {
      const res = await fetch(`/api/customers/${id}/account-balance`);
      const data = await res.json();
      if (res.ok) {
        setAccountBalance(data);
        if ((data.pendingFromOldBills || 0) > 0) setIncludeCarriedForward(true);
      } else {
        setAccountBalance(null);
      }
    } catch {
      setAccountBalance(null);
    } finally {
      setBalanceLoading(false);
    }
  };

  const applyDraft = (draft: ReturnType<typeof loadDispatchBillDraft>, catalog: Product[]) => {
    if (!draft) return catalog;
    setCustomerId(draft.customerId);
    setCustomerName(draft.customerName);
    setCustomerCompany(draft.customerCompany);
    setCustomerPhone(draft.customerPhone);
    setCustomerAddress(draft.customerAddress);
    setCustomerCity(draft.customerCity);
    setDispatchDate(draft.dispatchDate);
    setOrderType(draft.orderType);
    setReadyByDate(draft.readyByDate);
    setDiscount(draft.discount);
    setAdvance(draft.advance);
    setPaymentMode(draft.paymentMode || "Cash");
    setSalespersonName(draft.salespersonName);
    setNotes(draft.notes);
    setItems(draft.items.length > 0 ? draft.items : [emptyBillItemRow()]);
    setIncludeCarriedForward(draft.includeCarriedForward ?? true);
    setDraftSavedAt(draft.savedAt);

    const merged = [...catalog];
    for (const extra of draft.extraProducts || []) {
      if (!merged.some((p) => p._id === extra._id)) merged.push(extra);
    }
    if (draft.customerId) loadAccountBalance(draft.customerId);
    return merged;
  };

  const resetFormToDefaults = (salesperson?: string) => {
    setCustomerId("");
    setCustomerName("");
    setCustomerCompany("");
    setCustomerPhone("");
    setCustomerAddress("");
    setCustomerCity("");
    setDispatchDate(new Date().toISOString().split("T")[0]);
    setOrderType(defaultAdvance ? "advance" : "immediate");
    setReadyByDate("");
    setDiscount(0);
    setAdvance(0);
    setPaymentMode("Cash");
    setSalespersonName(salesperson || "");
    setNotes("");
    setItems([emptyBillItemRow()]);
    setIncludeCarriedForward(true);
    setAccountBalance(null);
    setDraftSavedAt(null);
  };

  const handleClearDraft = () => {
    clearDispatchBillDraft();
    resetFormToDefaults(salespersonName);
    toast("Bill draft clear ho gaya", "success");
  };

  useEffect(() => {
    Promise.all([
      fetch("/api/customers?lite=true&limit=500").then((r) => r.json()),
      fetch("/api/products?limit=500").then((r) => r.json()),
      fetch("/api/auth/me").then((r) => r.json()),
    ]).then(([c, p, me]) => {
      setCustomers(c.customers || []);
      const catalog: Product[] = p.products || [];
      const draft = loadDispatchBillDraft();

      if (draft && dispatchBillDraftHasContent(draft)) {
        setProducts(applyDraft(draft, catalog));
        if (!draftRestoreToastShown.current) {
          draftRestoreToastShown.current = true;
          toast("Aapka bill draft restore ho gaya — jaise chhoda tha waisa hi", "success");
        }
      } else {
        setProducts(catalog);
        if (me.user?.name) setSalespersonName(me.user.name);
      }

      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (loading) return;

    const timer = window.setTimeout(() => {
      const itemProductIds = new Set(
        items.filter((row) => row.productId).map((row) => row.productId)
      );
      const extraProducts = products.filter((p) => itemProductIds.has(p._id));
      const payload = {
        customerId,
        customerName,
        customerCompany,
        customerPhone,
        customerAddress,
        customerCity,
        dispatchDate,
        orderType,
        readyByDate,
        discount,
        advance,
        paymentMode,
        salespersonName,
        notes,
        items,
        extraProducts,
        includeCarriedForward,
      };

      if (!dispatchBillDraftHasContent(payload)) {
        clearDispatchBillDraft();
        setDraftSavedAt(null);
        return;
      }

      saveDispatchBillDraft(payload);
      setDraftSavedAt(new Date().toISOString());
    }, 500);

    return () => window.clearTimeout(timer);
  }, [
    loading,
    customerId,
    customerName,
    customerCompany,
    customerPhone,
    customerAddress,
    customerCity,
    dispatchDate,
    orderType,
    readyByDate,
    discount,
    advance,
    paymentMode,
    salespersonName,
    notes,
    items,
    products,
    includeCarriedForward,
  ]);

  const onCustomerSelect = (id: string) => {
    setCustomerId(id);
    const c = customers.find((x) => x._id === id);
    if (c) {
      setCustomerName(c.name);
      setCustomerCompany(c.companyName || "");
      setCustomerPhone(c.phone || "");
      setCustomerAddress(c.address || "");
      setCustomerCity(c.city || "");
      setIncludeCarriedForward(true);
      loadAccountBalance(id);
    } else {
      setAccountBalance(null);
      setIncludeCarriedForward(true);
    }
  };

  const updateItem = (index: number, field: keyof BillItemRow, value: string | number) => {
    setItems((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const product =
          field === "productId"
            ? products.find((x) => x._id === value)
            : products.find((x) => x._id === row.productId);
        return patchBillItemField(row, field, value, product);
      })
    );
  };

  const getItemTotal = (item: BillItemRow) => {
    const p = products.find((x) => x._id === item.productId);
    if (!p) return 0;
    return billItemRowTotal(item, p);
  };

  const openQuickAdd = (withNewProduct = false) => {
    setBulkAddQuickCreate(withNewProduct);
    setBulkAddOpen(true);
  };

  const subtotal = items.reduce((s, i) => s + (i.productId ? getItemTotal(i) : 0), 0);
  const billDiscount = advance > 0 ? discount : 0;
  const carriedForward =
    customerId && includeCarriedForward ? accountBalance?.pendingFromOldBills || 0 : 0;
  const { creditApplied: previewCredit } = previewCreditApplication(
    Math.max(0, subtotal - billDiscount) + carriedForward,
    advance,
    accountBalance?.availableCredit || 0
  );
  const billTotals = computeDispatchBillTotals({
    subtotal,
    discount: billDiscount,
    carriedForwardPending: carriedForward,
    cashPaid: advance,
    creditApplied: customerId ? previewCredit : 0,
  });
  const { currentBillAmount, total, pending, creditAdded } = billTotals;
  const cashPaidPreview = advance;

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
      toast("Advance order me customer ne kitna pay kiya — amount daalein", "error");
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
      const res = await fetch("/api/dispatch", {
        method: "POST",
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
          includeCarriedForward: customerId ? includeCarriedForward : false,
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
      toast(isAdvance ? "Advance order saved" : "Dispatch bill created", "success");
      clearDispatchBillDraft();
      router.push(`/admin/dispatch/${data.dispatch._id}`);
    } catch {
      toast("Something went wrong", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/admin/dispatch">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-serif font-bold text-navy">
            {isAdvance ? "Advance Order (Pehle se Booking)" : "Create Dispatch Bill"}
          </h1>
          <p className="text-sm text-gray-500">
            {isAdvance
              ? "Customer advance de — maal ready date par Final Bill banao, tab stock minus hoga"
              : "Stock will NOT be deducted until Final Bill"}
          </p>
        </div>
        {draftSavedAt && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
              Draft saved — doosri tab par jao, wapas aane par details rahengi
            </span>
            <Button type="button" variant="outline" size="sm" onClick={handleClearDraft}>
              <RotateCcw className="h-4 w-4" /> Draft clear
            </Button>
          </div>
        )}
      </div>

      {isAdvance && (
        <div className="rounded-lg border border-gold bg-gold/10 px-4 py-3 text-sm text-navy flex items-start gap-2">
          <CalendarClock className="h-5 w-5 text-gold shrink-0 mt-0.5" />
          <div>
            <strong>Advance Order:</strong> Customer ne advance diya aur bola maal kis date tak ready chahiye.
            Abhi stock minus nahi hoga — jab maal ready ho aur Final Bill banoge tab stock cut hoga.
          </div>
        </div>
      )}

      <div className="rounded-lg border border-gold/30 bg-gold/5 px-4 py-3 text-sm text-gray-700">
        Box aur Piece alag-alag add karein — bill me dono <strong>alag rows</strong> me dikhenge.
        Kg wale product me sirf <strong>Kg qty</strong> daalein. Example: 2 Box @ ₹1,200 + 1 Pc @ ₹400 = 2 alag lines.
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Customer Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label>Select Existing Customer (optional)</Label>
              <Select value={customerId} onChange={(e) => onCustomerSelect(e.target.value)}>
                <option value="">New / Walk-in Customer</option>
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
              <Label>Phone Number</Label>
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
              <Label>Order Date (Kab order hua)</Label>
              <Input type="date" value={dispatchDate} onChange={(e) => setDispatchDate(e.target.value)} />
            </div>
            <div>
              <Label>Order Type</Label>
              <Select
                value={orderType}
                onChange={(e) => setOrderType(e.target.value as "immediate" | "advance")}
              >
                <option value="immediate">Normal Bill (abhi dispatch)</option>
                <option value="advance">Advance Order (future date par ready)</option>
              </Select>
            </div>
            {isAdvance && (
              <div>
                <Label>Maal Ready Date *</Label>
                <Input
                  type="date"
                  value={readyByDate}
                  onChange={(e) => setReadyByDate(e.target.value)}
                  required={isAdvance}
                />
                <p className="text-xs text-gray-500 mt-1">Customer ne kis date tak maal chahiye</p>
              </div>
            )}
            <div>
              <Label>Bill Banane Wale Ka Naam *</Label>
              <Input
                value={salespersonName}
                onChange={(e) => setSalespersonName(e.target.value)}
                placeholder="Jisne bill banayi uska naam"
                required
              />
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
            <CardHeader>
              <CardTitle>Bill Preview — alag Box / Piece lines</CardTitle>
            </CardHeader>
            <CardContent>
              <BillItemsTable items={previewItems} />
            </CardContent>
          </Card>
        )}

        {customerId && (
          <Card className="border-gold/40">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Wallet className="h-5 w-5 text-gold" />
                Customer Account Balance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {balanceLoading ? (
                <p className="text-gray-500">Account balance load ho rahi hai...</p>
              ) : accountBalance ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="rounded-lg bg-red-50 px-3 py-2">
                      <p className="text-xs text-gray-500">Purani Bills Pending</p>
                      <p className="font-bold text-red-700">{formatCurrency(accountBalance.pendingFromOldBills)}</p>
                      {accountBalance.pendingBillCount > 0 && (
                        <p className="text-xs text-gray-500 mt-1">{accountBalance.pendingBillCount} bill(s)</p>
                      )}
                    </div>
                    <div className="rounded-lg bg-green-50 px-3 py-2">
                      <p className="text-xs text-gray-500">Account Advance / Credit</p>
                      <p className="font-bold text-green-700">{formatCurrency(accountBalance.availableCredit)}</p>
                    </div>
                    <div className="rounded-lg bg-gray-50 px-3 py-2">
                      <p className="text-xs text-gray-500">Net Account Pending</p>
                      <p className="font-bold text-navy">{formatCurrency(accountBalance.netAccountPending)}</p>
                    </div>
                  </div>
                  {accountBalance.pendingFromOldBills > 0 && (
                    <label className="flex items-start gap-2 cursor-pointer rounded-lg border border-gold/30 bg-gold/5 px-3 py-2">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={includeCarriedForward}
                        onChange={(e) => setIncludeCarriedForward(e.target.checked)}
                      />
                      <span>
                        <strong>Purani pending is bill me add karein</strong>
                        <span className="block text-xs text-gray-600 mt-0.5">
                          {formatCurrency(accountBalance.pendingFromOldBills)} purani bill(s) se is nayi bill me add hoga.
                          Purani bills settle ho jayengi — double count nahi hoga.
                        </span>
                      </span>
                    </label>
                  )}
                  {accountBalance.pendingBills.length > 0 && (
                    <div className="text-xs text-gray-500 space-y-1">
                      {accountBalance.pendingBills.map((b) => (
                        <div key={b.billId} className="flex justify-between">
                          <span>{b.billId}</span>
                          <span>{formatCurrency(b.pending)} pending</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {accountBalance.availableCredit > 0 && (
                    <p className="text-xs text-green-700">
                      Bill save hone par account se {formatCurrency(Math.min(previewCredit, accountBalance.availableCredit))} advance auto apply hoga (agar bill me jagah ho).
                    </p>
                  )}
                </>
              ) : (
                <p className="text-gray-500">Account balance load nahi hui.</p>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle>Bill Summary</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <Label>{isAdvance ? "Advance Payment (₹) *" : "Customer Paid (₹)"}</Label>
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
                <Select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  disabled={advance <= 0}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="rounded-lg bg-gray-50 p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
              {billDiscount > 0 && (
                <div className="flex justify-between text-red-600"><span>Discount</span><span>-{formatCurrency(billDiscount)}</span></div>
              )}
              {carriedForward > 0 && (
                <>
                  <div className="flex justify-between"><span>Is Bill Ka Amount</span><span>{formatCurrency(currentBillAmount)}</span></div>
                  <div className="flex justify-between text-amber-700 font-medium">
                    <span>+ Purani Pending (Account)</span>
                    <span>{formatCurrency(carriedForward)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between font-bold text-base border-t pt-2">
                <span>Grand Total</span><span>{formatCurrency(total)}</span>
              </div>
              {cashPaidPreview > 0 && (
                <div className="flex justify-between text-green-700"><span>Customer Paid</span><span>{formatCurrency(cashPaidPreview)}</span></div>
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

        <Button type="submit" variant="gold" size="lg" disabled={submitting} className="w-full sm:w-auto">
          <Save className="h-5 w-5" /> {submitting ? "Saving..." : isAdvance ? "Save Advance Order" : "Create Dispatch Bill"}
        </Button>
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
