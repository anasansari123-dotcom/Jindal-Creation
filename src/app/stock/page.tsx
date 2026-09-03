"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { SearchInput } from "@/components/ui/search-input";
import { PageLoader, EmptyState } from "@/components/ui/loading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import {
  ArrowLeft,
  MessageCircle,
  Trash2,
  ShoppingCart,
  CheckCircle,
  AlertCircle,
  Package,
  ShoppingBag,
} from "lucide-react";
import { BRAND, DEFAULT_WHATSAPP_NUMBER, DEFAULT_WHATSAPP_DISPLAY } from "@/lib/constants";
import { generateWhatsAppUrl } from "@/lib/utils";
import { groupProductsByCategory, formatProductDisplay } from "@/lib/product-display";

interface StockProduct {
  id: string;
  productId: string;
  name: string;
  displayName?: string;
  category: string;
  unit: string;
  piecesPerBox: number;
  stockStatus: string;
}

interface CartItem {
  id: string;
  productId: string;
  productName: string;
  category: string;
  unitType: "pieces" | "boxes";
  quantity: number;
  piecesPerBox: number;
}

export default function StockPage() {
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);

  const [orderOpen, setOrderOpen] = useState(false);
  const [orderProduct, setOrderProduct] = useState<StockProduct | null>(null);
  const [orderName, setOrderName] = useState("");
  const [orderPhone, setOrderPhone] = useState("");
  const [orderUnit, setOrderUnit] = useState<"pieces" | "boxes">("pieces");
  const [orderQty, setOrderQty] = useState(1);
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [orderMsg, setOrderMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchStock = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/public/stock?search=${encodeURIComponent(search)}`);
    const data = await res.json();
    setProducts(data.products || []);
    if (data.whatsappNumber) setWhatsappNumber(data.whatsappNumber);
    setLoading(false);
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(fetchStock, 300);
    return () => clearTimeout(timer);
  }, [fetchStock]);

  const checkAvailability = async (
    product: Pick<StockProduct, "id" | "productId" | "category">,
    itemUnitType: "pieces" | "boxes",
    itemQty: number,
    existingCart: CartItem[]
  ) => {
    const res = await fetch("/api/public/stock/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: product.id,
        productId: product.productId,
        category: product.category,
        unitType: itemUnitType,
        quantity: itemQty,
        cartItems: existingCart.map((c) => ({
          id: c.id,
          productId: c.productId,
          unitType: c.unitType,
          quantity: c.quantity,
        })),
      }),
    });
    const data = await res.json();
    return { available: !!data.available, message: data.message || data.error || "Something went wrong" };
  };

  const openOrderDialog = (product: StockProduct) => {
    setOrderProduct(product);
    setOrderName(customerName);
    setOrderPhone(customerPhone);
    setOrderUnit("pieces");
    setOrderQty(1);
    setOrderMsg(null);
    setOrderOpen(true);
  };

  const submitOrder = async () => {
    if (!orderProduct) return;

    if (!orderName.trim()) {
      setOrderMsg({ type: "error", text: "Apna naam likhiye." });
      return;
    }
    if (!orderPhone.trim()) {
      setOrderMsg({ type: "error", text: "Apna phone / WhatsApp number likhiye." });
      return;
    }
    if (orderQty < 1) {
      setOrderMsg({ type: "error", text: "Quantity kam se kam 1 honi chahiye." });
      return;
    }

    if (orderProduct.stockStatus === "Out of Stock") {
      setOrderMsg({ type: "error", text: "Yeh product abhi available nahi hai." });
      return;
    }

    setOrderSubmitting(true);
    setOrderMsg(null);

    try {
      const result = await checkAvailability(
        orderProduct,
        orderUnit,
        orderQty,
        cart
      );

      if (!result.available) {
        setOrderMsg({ type: "error", text: result.message });
        return;
      }

      setCustomerName(orderName.trim());
      setCustomerPhone(orderPhone.trim());

      setCart((prev) => {
        const existing = prev.find(
          (c) => c.id === orderProduct.id && c.unitType === orderUnit
        );
        if (existing) {
          return prev.map((c) =>
            c.id === orderProduct.id && c.unitType === orderUnit
              ? { ...c, quantity: c.quantity + orderQty }
              : c
          );
        }
        return [
          ...prev,
          {
            id: orderProduct.id,
            productId: orderProduct.productId,
            productName: orderProduct.name,
            category: orderProduct.category,
            unitType: orderUnit,
            quantity: orderQty,
            piecesPerBox: orderProduct.piecesPerBox,
          },
        ];
      });

      setOrderMsg({ type: "success", text: result.message });
      toast(result.message, "success");
      setTimeout(() => setOrderOpen(false), 800);
    } catch {
      setOrderMsg({ type: "error", text: "Order place nahi ho paya. Dobara try karein." });
    } finally {
      setOrderSubmitting(false);
    }
  };

  const removeFromCart = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const shareComplaintOnWhatsApp = () => {
    if (!orderProduct) return;

    const pieces =
      orderUnit === "boxes" ? orderQty * orderProduct.piecesPerBox : orderQty;

    let msg = `Hello ${BRAND.name},\n\n`;
    if (orderName.trim()) msg += `Name: ${orderName.trim()}\n`;
    if (orderPhone.trim()) msg += `Phone: ${orderPhone.trim()}\n`;
    msg += `\n--- Product Inquiry / Complaint ---\n`;
    msg += `Product: ${orderProduct.name}\n`;
    msg += `Category: ${orderProduct.category}\n`;
    msg += `Product ID: ${orderProduct.productId}\n`;
    msg += `1 Box = ${orderProduct.piecesPerBox} pieces\n`;
    msg += `Required: ${orderQty} ${orderUnit}`;
    if (orderUnit === "boxes") msg += ` (${pieces} pieces)`;
    msg += `\n\n`;

    if (orderMsg?.type === "error") {
      msg += `Ye order available nahi hai. Kripya batayein kya ye quantity mil sakti hai ya kab available hogi?\n\n`;
    } else {
      msg += `Mujhe is product ki ye quantity chahiye. Kripya availability confirm karein.\n\n`;
    }

    msg += `Thank you!\n${BRAND.tagline}`;

    window.open(
      generateWhatsAppUrl(whatsappNumber || DEFAULT_WHATSAPP_NUMBER, msg),
      "_blank"
    );
  };

  const shareOrderOnWhatsApp = async () => {
    if (cart.length === 0) return;

    if (!customerName.trim() || !customerPhone.trim()) {
      toast("Pehle kisi product ka Order button use karke naam aur number bhariye.", "error");
      return;
    }

    const totalsByProduct = new Map<string, { product: CartItem; pieces: number }>();
    for (const item of cart) {
      const pieces = item.unitType === "boxes" ? item.quantity * item.piecesPerBox : item.quantity;
      const existing = totalsByProduct.get(item.id);
      totalsByProduct.set(item.id, {
        product: item,
        pieces: (existing?.pieces || 0) + pieces,
      });
    }

    for (const { product, pieces } of totalsByProduct.values()) {
      const result = await checkAvailability(product, "pieces", pieces, []);
      if (!result.available) {
        toast(`${product.productName}: ${result.message}`, "error");
        return;
      }
    }

    let msg = `Hello,\n\nI would like to place an order with ${BRAND.name}.\n\n`;
    msg += `Name: ${customerName}\n`;
    msg += `Phone: ${customerPhone}\n`;
    msg += `\n--- Order List ---\n`;

    cart.forEach((item, i) => {
      msg += `${i + 1}. ${item.productName}\n`;
      msg += `   Category: ${item.category}\n`;
      msg += `   Product ID: ${item.productId}\n`;
      msg += `   1 Box = ${item.piecesPerBox} pieces\n`;
      msg += `   Quantity: ${item.quantity} ${item.unitType}\n\n`;
    });

    msg += `\nPlease confirm availability and pricing.\n\n${BRAND.tagline}`;

    window.open(
      generateWhatsAppUrl(whatsappNumber || DEFAULT_WHATSAPP_NUMBER, msg),
      "_blank"
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-navy text-white">
        <div className="max-w-5xl mx-auto px-4 py-5 sm:py-6">
          <div className="flex items-center justify-between gap-2">
            <Logo size="sm" href="/" theme="light" />
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 shrink-0">
                <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Home</span>
              </Button>
            </Link>
          </div>
          <div className="mt-5 sm:mt-6">
            <h1 className="text-xl sm:text-2xl font-serif font-bold leading-snug">
              Jindal Creation MZN — PVC Panel Stock Muzaffarnagar
            </h1>
            <p className="text-gold text-xs sm:text-sm mt-1">
              {BRAND.name} · Jindal Muzaffarnagar · Search by name or product ID · WhatsApp order
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 sm:py-8 space-y-5 sm:space-y-6">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by product name or ID..."
        />

        {loading ? (
          <PageLoader />
        ) : products.length === 0 ? (
          <EmptyState title="No products found" description="Try a different search term" />
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg bg-gold/10 border border-gold/30 px-4 py-3 text-sm text-navy">
              <Package className="h-5 w-5 text-gold shrink-0" />
              <span>
                <strong>Order karein:</strong> Product ke saamne <strong>Order</strong> button dabayein,
                apna naam, number aur quantity (pieces ya box) bhariye.
              </span>
            </div>

            <div className="space-y-4">
              {groupProductsByCategory(products).map((group) => (
                <div key={group.category} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                  <div className="bg-navy px-4 py-2.5 text-center">
                    <h2 className="font-serif font-bold text-white tracking-wide">{group.category}</h2>
                  </div>
                  <div className="table-scroll md:overflow-visible">
                    {/* Mobile card view */}
                    <div className="md:hidden divide-y">
                      {group.products.map((p) => (
                        <div key={p.id} className="p-4 space-y-3">
                          <div>
                            <p className="font-medium text-navy text-sm">
                              {p.displayName || formatProductDisplay(p.name, p.productId)}
                            </p>
                            <p className="text-gold text-xs font-medium mt-0.5">#{p.productId}</p>
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium ${
                                p.stockStatus === "In Stock"
                                  ? "bg-green-100 text-green-800"
                                  : p.stockStatus === "Low Stock"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-red-100 text-red-800"
                              }`}
                            >
                              {p.stockStatus}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-navy/5 px-2.5 py-1 font-medium text-navy">
                              1 Box = {p.piecesPerBox} Pcs
                            </span>
                          </div>
                          <Button
                            variant="gold"
                            size="sm"
                            className="w-full"
                            onClick={() => openOrderDialog(p)}
                            disabled={p.stockStatus === "Out of Stock"}
                          >
                            <ShoppingBag className="h-3.5 w-3.5" /> Order
                          </Button>
                        </div>
                      ))}
                    </div>

                    {/* Desktop table */}
                    <table className="hidden md:table w-full text-sm min-w-[640px]">
                      <thead>
                        <tr className="bg-navy/5 text-left text-gray-500">
                          <th className="px-4 py-3 font-medium">Product</th>
                          <th className="px-4 py-3 font-medium">Number</th>
                          <th className="px-4 py-3 font-medium">Availability</th>
                          <th className="px-4 py-3 font-medium">1 Box = Kitne Pieces?</th>
                          <th className="px-4 py-3 font-medium">Order</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.products.map((p) => (
                          <tr key={p.id} className="border-t hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-navy">
                              {p.displayName || formatProductDisplay(p.name, p.productId)}
                            </td>
                            <td className="px-4 py-3 font-medium text-gold">{p.productId}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                                  p.stockStatus === "In Stock"
                                    ? "bg-green-100 text-green-800"
                                    : p.stockStatus === "Low Stock"
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-red-100 text-red-800"
                                }`}
                              >
                                {p.stockStatus === "In Stock" && <CheckCircle className="h-3 w-3" />}
                                {p.stockStatus === "Low Stock" && <AlertCircle className="h-3 w-3" />}
                                {p.stockStatus === "Out of Stock" && <AlertCircle className="h-3 w-3" />}
                                {p.stockStatus}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-navy/5 border border-navy/10 px-3 py-1.5 font-semibold text-navy">
                                <Package className="h-3.5 w-3.5 text-gold" />
                                1 Box = {p.piecesPerBox} Pieces
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <Button
                                variant="gold"
                                size="sm"
                                onClick={() => openOrderDialog(p)}
                                disabled={p.stockStatus === "Out of Stock"}
                                className="min-w-[80px]"
                              >
                                <ShoppingBag className="h-3.5 w-3.5" /> Order
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {cart.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border p-4 sm:p-6 space-y-4 sm:space-y-5">
            <h2 className="text-lg font-serif font-bold text-navy flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-gold" /> Your Order List
            </h2>

            {(customerName || customerPhone) && (
              <div className="text-sm text-gray-600 rounded-lg bg-gray-50 px-4 py-3">
                <p><strong>Name:</strong> {customerName}</p>
                <p><strong>Phone:</strong> {customerPhone}</p>
              </div>
            )}

            <div className="table-scroll border rounded-lg overflow-hidden">
              <table className="w-full text-sm min-w-[480px]">
                <thead>
                  <tr className="bg-gray-50 text-gray-500">
                    <th className="p-2 text-left">Product</th>
                    <th className="p-2 text-left">ID</th>
                    <th className="p-2 text-left">Box Packing</th>
                    <th className="p-2 text-left">Qty</th>
                    <th className="p-2 text-left">Unit</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">{item.productName}</td>
                      <td className="p-2 text-gold">{item.productId}</td>
                      <td className="p-2 text-xs font-medium text-navy">1 Box = {item.piecesPerBox} pcs</td>
                      <td className="p-2">{item.quantity}</td>
                      <td className="p-2 capitalize">{item.unitType}</td>
                      <td className="p-2">
                        <Button variant="ghost" size="sm" onClick={() => removeFromCart(i)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Button variant="gold" size="lg" className="w-full" onClick={shareOrderOnWhatsApp}>
              <MessageCircle className="h-5 w-5" /> Share Your Order List on WhatsApp
            </Button>
            <p className="text-center text-xs text-gray-500">
              Order is sent to: <strong>{whatsappNumber ? `+${whatsappNumber.replace(/\D/g, "").replace(/^91/, "91 ")}` : DEFAULT_WHATSAPP_DISPLAY}</strong>
            </p>
          </div>
        )}

      </main>

      <footer className="border-t bg-white py-6 text-center text-xs text-gray-400 px-4">
        <p>
          &copy; {new Date().getFullYear()} {BRAND.name} · Jindal MZN · Muzaffarnagar — PVC Panels |
          Home Decor
        </p>
      </footer>

      <Dialog open={orderOpen} onOpenChange={setOrderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Place Order</DialogTitle>
            <DialogDescription>
              {orderProduct && (
                <>
                  <span className="font-medium text-navy">{orderProduct.name}</span>
                  {" · "}
                  <span className="text-gold">{orderProduct.productId}</span>
                  {" · "}
                  1 Box = {orderProduct.piecesPerBox} Pieces
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Your Name *</Label>
              <Input
                value={orderName}
                onChange={(e) => {
                  setOrderName(e.target.value);
                  setOrderMsg(null);
                }}
                placeholder="Apna naam likhiye"
              />
            </div>
            <div>
              <Label>Phone / WhatsApp *</Label>
              <Input
                value={orderPhone}
                onChange={(e) => {
                  setOrderPhone(e.target.value);
                  setOrderMsg(null);
                }}
                placeholder="Contact number"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Unit</Label>
                <Select
                  value={orderUnit}
                  onChange={(e) => {
                    setOrderUnit(e.target.value as "pieces" | "boxes");
                    setOrderMsg(null);
                  }}
                >
                  <option value="pieces">Pieces</option>
                  <option value="boxes">Boxes</option>
                </Select>
              </div>
              <div>
                <Label>Quantity *</Label>
                <Input
                  type="number"
                  min={1}
                  value={orderQty}
                  onChange={(e) => {
                    setOrderQty(Number(e.target.value));
                    setOrderMsg(null);
                  }}
                />
              </div>
            </div>

            {orderProduct && orderQty > 0 && (
              <div className="rounded-lg bg-gold/10 border border-gold/30 px-3 py-2 text-xs text-navy">
                {orderUnit === "boxes" ? (
                  <>
                    {orderQty} box = <strong>{orderQty * orderProduct.piecesPerBox} pieces</strong>
                  </>
                ) : (
                  <>
                    <strong>{orderQty} pieces</strong>
                    {orderProduct.piecesPerBox > 1 && (
                      <> (≈ {(orderQty / orderProduct.piecesPerBox).toFixed(1)} boxes)</>
                    )}
                  </>
                )}
              </div>
            )}

            {orderMsg && (
              <div
                className={`flex items-start gap-2 rounded-lg p-3 text-sm ${
                  orderMsg.type === "success"
                    ? "bg-green-50 text-green-800 border border-green-200"
                    : "bg-red-50 text-red-800 border border-red-200"
                }`}
              >
                {orderMsg.type === "success" ? (
                  <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                )}
                <span>{orderMsg.text}</span>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between gap-3">
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" onClick={() => setOrderOpen(false)} className="flex-1 sm:flex-none">
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={shareComplaintOnWhatsApp}
                className="flex-1 sm:flex-none border-green-500 text-green-700 hover:bg-green-50"
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </Button>
            </div>
            <Button variant="gold" onClick={submitOrder} disabled={orderSubmitting} className="w-full sm:w-auto">
              {orderSubmitting ? "Checking..." : "Add to Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
