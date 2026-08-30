"use client";

import { useEffect, useState, Suspense } from "react";
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
  calculateBillLineTotal,
  formatBillLineCalculation,
  piecePriceFromBox,
} from "@/lib/bill-pricing";
import { BillItemsTable } from "@/components/bill-items-table";
import { PAYMENT_METHODS } from "@/lib/constants";
import { formatProductDisplay } from "@/lib/product-display";
import { formatProductStock, isKgProduct } from "@/lib/product-units";
import { ArrowLeft, Plus, Trash2, Save, CalendarClock } from "lucide-react";

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

interface ItemRow {
  productId: string;
  boxQty: number;
  pieceQty: number;
  kgQty: number;
  boxDiscount: number;
  pieceDiscount: number;
  kgDiscount: number;
}

function buildPreviewLines(item: ItemRow, p: Product) {
  const lines: ReturnType<typeof calculateBillLineTotal>[] = [];
  if (isKgProduct(p)) {
    if (item.kgQty > 0) {
      lines.push(
        calculateBillLineTotal({
          sellMode: "kg",
          kgQty: item.kgQty,
          boxPrice: p.sellingPrice,
          piecesPerBox: 1,
          discount: item.kgDiscount,
        })
      );
    }
    return lines;
  }
  if (item.boxQty > 0) {
    lines.push(
      calculateBillLineTotal({
        sellMode: "box",
        boxQty: item.boxQty,
        boxPrice: p.sellingPrice,
        piecesPerBox: p.piecesPerBox,
        discount: item.boxDiscount,
      })
    );
  }
  if (item.pieceQty > 0) {
    lines.push(
      calculateBillLineTotal({
        sellMode: "piece",
        pieceQty: item.pieceQty,
        boxPrice: p.sellingPrice,
        piecesPerBox: p.piecesPerBox,
        discount: item.pieceDiscount,
      })
    );
  }
  return lines;
}

function totalQtyForItem(item: ItemRow, p: Product) {
  if (isKgProduct(p)) return item.kgQty;
  const ppb = Math.max(p.piecesPerBox, 1);
  return item.boxQty * ppb + item.pieceQty;
}

function itemHasQty(item: ItemRow, p?: Product) {
  if (p && isKgProduct(p)) return item.kgQty > 0;
  return item.boxQty > 0 || item.pieceQty > 0;
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
  const [items, setItems] = useState<ItemRow[]>([
    { productId: "", boxQty: 0, pieceQty: 0, kgQty: 0, boxDiscount: 0, pieceDiscount: 0, kgDiscount: 0 },
  ]);

  const isAdvance = orderType === "advance";

  useEffect(() => {
    Promise.all([
      fetch("/api/customers?limit=500").then((r) => r.json()),
      fetch("/api/products?limit=500").then((r) => r.json()),
      fetch("/api/auth/me").then((r) => r.json()),
    ]).then(([c, p, me]) => {
      setCustomers(c.customers || []);
      setProducts(p.products || []);
      if (me.user?.name) setSalespersonName(me.user.name);
      setLoading(false);
    });
  }, []);

  const onCustomerSelect = (id: string) => {
    setCustomerId(id);
    const c = customers.find((x) => x._id === id);
    if (c) {
      setCustomerName(c.name);
      setCustomerCompany(c.companyName || "");
      setCustomerPhone(c.phone || "");
      setCustomerAddress(c.address || "");
      setCustomerCity(c.city || "");
    }
  };

  const updateItem = (index: number, field: keyof ItemRow, value: string | number) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const getItemTotal = (item: ItemRow) => {
    const p = products.find((x) => x._id === item.productId);
    if (!p) return 0;
    return buildPreviewLines(item, p).reduce((s, line) => s + line.total, 0);
  };

  const subtotal = items.reduce((s, i) => s + (i.productId ? getItemTotal(i) : 0), 0);
  const total = subtotal - discount;
  const pending = Math.max(0, total - advance);

  const previewItems = items
    .filter((i) => {
      const p = products.find((x) => x._id === i.productId);
      return i.productId && p && itemHasQty(i, p);
    })
    .flatMap((item) => {
      const p = products.find((x) => x._id === item.productId)!;
      return buildPreviewLines(item, p).map((line) => ({
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
      return i.productId && p && itemHasQty(i, p);
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
      const needed = totalQtyForItem(item, p);
      if (needed <= 0) {
        toast(
          isKgProduct(p)
            ? `Enter kg qty for ${p.name}`
            : `Enter box or piece qty for ${p.name}`,
          "error"
        );
        return;
      }
      if (!isAdvance && needed > p.currentStock) {
        toast(
          `Insufficient stock for ${p.name}. Available: ${formatProductStock(p)}`,
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
            const p = products.find((x) => x._id === i.productId);
            if (p && isKgProduct(p)) {
              return {
                productId: i.productId,
                kgQty: i.kgQty,
                kgDiscount: i.kgDiscount,
              };
            }
            return {
              productId: i.productId,
              boxQty: i.boxQty,
              pieceQty: i.pieceQty,
              boxDiscount: i.boxDiscount,
              pieceDiscount: i.pieceDiscount,
            };
          }),
          discount,
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
      toast(isAdvance ? "Advance order saved" : "Dispatch bill created", "success");
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
      <div className="flex items-center gap-4">
        <Link href="/admin/dispatch">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-serif font-bold text-navy">
            {isAdvance ? "Advance Order (Pehle se Booking)" : "Create Dispatch Bill"}
          </h1>
          <p className="text-sm text-gray-500">
            {isAdvance
              ? "Customer advance de — maal ready date par Final Bill banao, tab stock minus hoga"
              : "Stock will NOT be deducted until Final Bill"}
          </p>
        </div>
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
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Products</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setItems((p) => [
                  ...p,
                  { productId: "", boxQty: 0, pieceQty: 0, kgQty: 0, boxDiscount: 0, pieceDiscount: 0, kgDiscount: 0 },
                ])
              }
            >
              <Plus className="h-4 w-4" /> Add Product
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            {items.map((item, index) => {
              const p = products.find((x) => x._id === item.productId);
              const isKg = p ? isKgProduct(p) : false;
              const pieceRate = p && !isKg ? piecePriceFromBox(p.sellingPrice, p.piecesPerBox) : 0;
              const lines = p ? buildPreviewLines(item, p) : [];
              const needed = p ? totalQtyForItem(item, p) : 0;
              const stockOk = isAdvance || !p || needed === 0 || needed <= p.currentStock;

              return (
                <div key={index} className="border rounded-lg p-4 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex-1 min-w-[200px]">
                      <Label>Product</Label>
                      <Select
                        value={item.productId}
                        onChange={(e) => updateItem(index, "productId", e.target.value)}
                      >
                        <option value="">Select product</option>
                        {products.map((pr) => (
                          <option key={pr._id} value={pr._id}>
                            {formatProductDisplay(pr.name, pr.productId)}
                          </option>
                        ))}
                      </Select>
                    </div>
                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="mt-6"
                        onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>

                  {p && (
                    <>
                      <div className="grid grid-cols-2 gap-3 text-xs text-gray-600 bg-gray-50 rounded p-3">
                        <div>
                          <span className="text-gray-400 block">Available Stock</span>
                          <strong className="text-navy">
                            {formatProductStock(p)}
                          </strong>
                        </div>
                        <div>
                          <span className="text-gray-400 block">Default Rates</span>
                          <strong className="text-navy">
                            {isKg
                              ? `${formatCurrency(p.sellingPrice)}/Kg`
                              : `${formatCurrency(p.sellingPrice)}/Box · ${formatCurrency(pieceRate)}/Pc`}
                          </strong>
                        </div>
                      </div>

                      {isKg ? (
                        <div className="rounded-lg border border-emerald-200 bg-white p-4 space-y-3">
                          <p className="text-sm font-semibold text-navy">Kg (Weight)</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label>Qty (Kg)</Label>
                              <Input
                                type="number"
                                min={0}
                                step="0.001"
                                value={item.kgQty || ""}
                                placeholder="0"
                                onChange={(e) =>
                                  updateItem(index, "kgQty", Math.max(0, Number(e.target.value) || 0))
                                }
                              />
                            </div>
                            <div>
                              <Label>Rate / Kg</Label>
                              <Input
                                type="text"
                                readOnly
                                value={formatCurrency(p.sellingPrice)}
                                className="bg-gray-50"
                              />
                            </div>
                            <div className="col-span-2">
                              <Label>Discount (₹)</Label>
                              <Input
                                type="number"
                                min={0}
                                value={item.kgDiscount}
                                onChange={(e) =>
                                  updateItem(index, "kgDiscount", Number(e.target.value))
                                }
                              />
                            </div>
                          </div>
                          {item.kgQty > 0 && (
                            <p className="text-xs text-green-700 font-medium">
                              {item.kgQty} × {formatCurrency(p.sellingPrice)} ={" "}
                              {formatCurrency(
                                calculateBillLineTotal({
                                  sellMode: "kg",
                                  kgQty: item.kgQty,
                                  boxPrice: p.sellingPrice,
                                  piecesPerBox: 1,
                                  discount: item.kgDiscount,
                                }).total
                              )}
                            </p>
                          )}
                        </div>
                      ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Box section */}
                        <div className="rounded-lg border border-navy/10 bg-white p-4 space-y-3">
                          <p className="text-sm font-semibold text-navy">Box</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label>Qty (Box)</Label>
                              <Input
                                type="number"
                                min={0}
                                value={item.boxQty || ""}
                                placeholder="0"
                                onChange={(e) =>
                                  updateItem(index, "boxQty", Math.max(0, Number(e.target.value) || 0))
                                }
                              />
                            </div>
                            <div>
                              <Label>Rate / Box</Label>
                              <Input
                                type="text"
                                readOnly
                                value={formatCurrency(p.sellingPrice)}
                                className="bg-gray-50"
                              />
                            </div>
                            <div className="col-span-2">
                              <Label>Discount (₹)</Label>
                              <Input
                                type="number"
                                min={0}
                                value={item.boxDiscount}
                                onChange={(e) =>
                                  updateItem(index, "boxDiscount", Number(e.target.value))
                                }
                              />
                            </div>
                          </div>
                          {item.boxQty > 0 && (
                            <p className="text-xs text-green-700 font-medium">
                              {item.boxQty} × {formatCurrency(p.sellingPrice)} ={" "}
                              {formatCurrency(
                                calculateBillLineTotal({
                                  sellMode: "box",
                                  boxQty: item.boxQty,
                                  boxPrice: p.sellingPrice,
                                  piecesPerBox: p.piecesPerBox,
                                  discount: item.boxDiscount,
                                }).total
                              )}
                            </p>
                          )}
                        </div>

                        {/* Piece section */}
                        <div className="rounded-lg border border-gold/30 bg-white p-4 space-y-3">
                          <p className="text-sm font-semibold text-navy">Piece</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label>Qty (Pc)</Label>
                              <Input
                                type="number"
                                min={0}
                                value={item.pieceQty || ""}
                                placeholder="0"
                                onChange={(e) =>
                                  updateItem(index, "pieceQty", Math.max(0, Number(e.target.value) || 0))
                                }
                              />
                            </div>
                            <div>
                              <Label>Rate / Pc</Label>
                              <Input
                                type="text"
                                readOnly
                                value={formatCurrency(pieceRate)}
                                className="bg-gray-50"
                              />
                            </div>
                            <div className="col-span-2">
                              <Label>Discount (₹)</Label>
                              <Input
                                type="number"
                                min={0}
                                value={item.pieceDiscount}
                                onChange={(e) =>
                                  updateItem(index, "pieceDiscount", Number(e.target.value))
                                }
                              />
                            </div>
                          </div>
                          {item.pieceQty > 0 && (
                            <p className="text-xs text-green-700 font-medium">
                              {item.pieceQty} × {formatCurrency(pieceRate)} ={" "}
                              {formatCurrency(
                                calculateBillLineTotal({
                                  sellMode: "piece",
                                  pieceQty: item.pieceQty,
                                  boxPrice: p.sellingPrice,
                                  piecesPerBox: p.piecesPerBox,
                                  discount: item.pieceDiscount,
                                }).total
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                      )}

                      {lines.length > 0 && (
                        <div
                          className={`rounded-lg p-3 text-sm space-y-1 ${
                            stockOk ? "bg-green-50 border border-green-100" : "bg-red-50 border border-red-200"
                          }`}
                        >
                          <p className="font-medium text-navy">
                            Bill me {lines.length} line{lines.length > 1 ? "s" : ""} · Total stock: {needed}{isKg ? " kg" : " pcs"}
                          </p>
                          {lines.map((line, li) => (
                            <p key={li} className="text-gray-700">
                              Line {li + 1}: {formatBillLineCalculation(line)} = {formatCurrency(line.total)}
                            </p>
                          ))}
                          <p className="font-bold text-green-700 border-t pt-2 mt-2">
                            Product Total = {formatCurrency(getItemTotal(item))}
                          </p>
                          {!stockOk && !isAdvance && (
                            <p className="text-red-600 text-xs">
                              Not enough stock. Available: {formatProductStock(p)}
                            </p>
                          )}
                        </div>
                      )}

                      {!itemHasQty(item, p) && (
                        <p className="text-xs text-amber-600">
                          {isKg ? "Kg qty enter karein" : "Box ya Piece me se koi ek qty enter karein"}
                        </p>
                      )}
                    </>
                  )}
                </div>
              );
            })}
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

        <Card>
          <CardHeader><CardTitle>Bill Summary</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <Label>Bill Discount (₹)</Label>
                <Input type="number" min={0} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
              </div>
              <div>
                <Label>{isAdvance ? "Advance Payment (₹) *" : "Customer Paid (₹)"}</Label>
                <Input type="number" min={0} value={advance} onChange={(e) => setAdvance(Number(e.target.value))} />
              </div>
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
              {discount > 0 && (
                <div className="flex justify-between text-red-600"><span>Discount</span><span>-{formatCurrency(discount)}</span></div>
              )}
              <div className="flex justify-between font-bold text-base border-t pt-2">
                <span>Grand Total</span><span>{formatCurrency(total)}</span>
              </div>
              <div className="flex justify-between text-green-700"><span>Customer Paid</span><span>{formatCurrency(advance)}</span></div>
              <div className="flex justify-between text-red-600 font-bold"><span>Pending</span><span>{formatCurrency(pending)}</span></div>
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
    </div>
  );
}
