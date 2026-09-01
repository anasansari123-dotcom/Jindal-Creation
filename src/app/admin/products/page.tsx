"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SearchInput } from "@/components/ui/search-input";
import { Pagination } from "@/components/ui/pagination";
import { PageLoader, EmptyState } from "@/components/ui/loading";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  ConfirmDialog,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { Plus, Pencil, Trash2, Package, FolderPlus, Layers, Truck } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { formatProductDisplay, groupProductsByCategory } from "@/lib/product-display";
import { piecePriceFromBox } from "@/lib/bill-pricing";
import { formatAvailableStockFromPieces } from "@/lib/stock-display";
import { StockInDialog, type StockInProduct } from "@/components/stock-in-dialog";
import { formatKgQty, formatProductStock, isKgProduct, type SellingUnit } from "@/lib/product-units";

interface Product {
  _id: string;
  productId: string;
  name: string;
  category: string;
  description?: string;
  unit: string;
  price: number;
  costPrice: number;
  sellingPrice: number;
  piecesPerBox: number;
  minimumStock: number;
  currentStock: number;
  status: "active" | "inactive";
  sellingUnit?: SellingUnit;
  stockStatus: string;
  boxes: number;
  loosePieces?: number;
  piecePrice?: number;
  displayName?: string;
}

interface ProductForm {
  productId: string;
  name: string;
  category: string;
  description: string;
  unit: string;
  sellingUnit: SellingUnit;
  price: number;
  costPrice: number;
  sellingPrice: number;
  piecesPerBox: number;
  minimumStock: number;
  status: "active" | "inactive";
  stockUnit: "pieces" | "boxes" | "kg";
  stockQuantity: number;
}

const emptyForm: ProductForm = {
  productId: "",
  name: "",
  category: "",
  description: "",
  unit: "Piece",
  sellingUnit: "box",
  price: 0,
  costPrice: 0,
  sellingPrice: 0,
  piecesPerBox: 1,
  minimumStock: 10,
  status: "active",
  stockUnit: "pieces",
  stockQuantity: 0,
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [stockInProduct, setStockInProduct] = useState<StockInProduct | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);

  const loadCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/categories");
      const data = await res.json();
      if (data.categories) setCategories(data.categories);
    } catch {
      /* keep existing list */
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ search, page: String(page), limit: "100" });
    if (category) params.set("category", category);
    const res = await fetch(`/api/products?${params}`);
    const data = await res.json();
    setProducts(data.products || []);
    setTotalPages(data.pagination?.totalPages || 1);
    setTotal(data.pagination?.total || 0);
    setLoading(false);
  }, [search, category, page]);

  useEffect(() => {
    const timer = setTimeout(fetchProducts, 300);
    return () => clearTimeout(timer);
  }, [fetchProducts]);

  const groupedProducts = useMemo(
    () => groupProductsByCategory(products),
    [products]
  );

  const openAdd = (prefillCategory?: string) => {
    setEditProduct(null);
    setForm({ ...emptyForm, category: prefillCategory || "" });
    setDialogOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditProduct(product);
    setForm({
      productId: product.productId,
      name: product.name,
      category: product.category,
      description: product.description || "",
      unit: product.unit,
      sellingUnit: (product.sellingUnit as SellingUnit) || (isKgProduct(product) ? "kg" : "box"),
      price: product.price,
      costPrice: product.costPrice,
      sellingPrice: product.sellingPrice,
      piecesPerBox: product.piecesPerBox,
      minimumStock: product.minimumStock,
      status: product.status,
      stockUnit: "pieces",
      stockQuantity: product.currentStock,
    });
    setDialogOpen(true);
  };

  const isKg = form.sellingUnit === "kg";

  const stockInPieces = isKg
    ? form.stockQuantity
    : form.stockUnit === "boxes"
      ? form.stockQuantity * form.piecesPerBox
      : form.stockQuantity;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.category) {
      toast("Pehle category select karein", "error");
      return;
    }
    if (!form.name.trim()) {
      toast("Product name required hai", "error");
      return;
    }
    if (!form.productId.trim()) {
      toast("Product number required hai", "error");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        productId: form.productId.trim(),
        name: form.name.trim(),
        category: form.category,
        description: form.description,
        unit: isKg ? "Kg" : form.unit,
        sellingUnit: form.sellingUnit,
        price: form.price,
        costPrice: form.costPrice,
        sellingPrice: form.sellingPrice,
        piecesPerBox: form.piecesPerBox,
        minimumStock: form.minimumStock,
        status: form.status,
        currentStock: form.stockQuantity,
        stockUnit: isKg ? "kg" : form.stockUnit,
      };

      const url = editProduct ? `/api/products/${editProduct._id}` : "/api/products";
      const method = editProduct ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) {
        toast(result.error, "error");
        return;
      }
      toast(editProduct ? "Product updated" : "Product created", "success");
      setDialogOpen(false);
      setForm(emptyForm);
      fetchProducts();
    } catch {
      toast("Something went wrong", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/products/${deleteId}`, { method: "DELETE" });
      const result = await res.json();
      if (!res.ok) {
        toast(result.error, "error");
        return;
      }
      toast("Product deleted", "success");
      setDeleteId(null);
      fetchProducts();
    } catch {
      toast("Something went wrong", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddCategory = async () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast(result.error, "error");
        return;
      }
      setCategories(result.categories);
      setForm((f) => ({ ...f, category: trimmed }));
      setNewCategoryName("");
      setCategoryDialogOpen(false);
      toast("Category created", "success");
    } catch {
      toast("Something went wrong", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-navy">Product Catalog</h1>
          <p className="text-sm text-gray-500">
            Pehle category banayein, phir product name (unique) aur product number add karein.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setCategoryDialogOpen(true)}>
            <FolderPlus className="h-4 w-4" /> Add Category
          </Button>
          <Button variant="gold" onClick={() => openAdd(category || undefined)}>
            <Plus className="h-4 w-4" /> Add Product
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-lg bg-gold/10 border border-gold/30 px-4 py-3 text-sm text-navy">
        <Package className="h-5 w-5 text-gold shrink-0" />
        <span>
          <strong>Format:</strong> Category → Product Name (unique) → Number (repeat ho sakta hai).
          Same naam se do product nahi; same number alag products me use ho sakta hai.
        </span>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-3">
            <SearchInput
              value={search}
              onChange={(v) => {
                setSearch(v);
                setPage(1);
              }}
              placeholder="Search name, number, category..."
            />
            <Select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              className="w-full sm:w-52"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <PageLoader />
          ) : products.length === 0 ? (
            <EmptyState
              title="No products found"
              description="Pehle category add karein, phir uske andar product create karein"
            />
          ) : (
            <>
              <div className="space-y-6">
                {groupedProducts.map((group) => (
                  <div
                    key={group.category}
                    className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
                  >
                    <div className="flex items-center justify-between border-b bg-navy px-4 py-3">
                      <div className="flex items-center gap-2 text-white">
                        <Layers className="h-4 w-4 text-gold" />
                        <h2 className="font-serif text-lg font-bold tracking-wide">
                          {group.category}
                        </h2>
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/80">
                          {group.products.length} products
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-gold hover:bg-white/10 hover:text-white"
                        onClick={() => openAdd(group.category)}
                      >
                        <Plus className="h-4 w-4" /> Add
                      </Button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-gray-50 text-left text-gray-500">
                            <th className="px-4 py-2.5 font-medium">Product</th>
                            <th className="px-4 py-2.5 font-medium">Number</th>
                            <th className="px-4 py-2.5 font-medium">Unit</th>
                            <th className="px-4 py-2.5 font-medium text-center">Box Avail.</th>
                            <th className="px-4 py-2.5 font-medium text-center">Piece Avail.</th>
                            <th className="px-4 py-2.5 font-medium">Rate/Box</th>
                            <th className="px-4 py-2.5 font-medium">Rate/Pc</th>
                            <th className="px-4 py-2.5 font-medium">Status</th>
                            <th className="px-4 py-2.5 font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.products.map((p) => {
                            const kg = isKgProduct(p);
                            const stock = kg
                              ? null
                              : formatAvailableStockFromPieces(
                                  p.currentStock,
                                  p.piecesPerBox || 1
                                );
                            return (
                            <tr
                              key={p._id}
                              className="border-b last:border-0 hover:bg-gold/5 transition-colors"
                            >
                              <td className="px-4 py-3 font-medium text-navy">
                                {formatProductDisplay(p.name, p.productId)}
                              </td>
                              <td className="px-4 py-3 font-semibold text-gold">{p.productId}</td>
                              <td className="px-4 py-3">
                                <span className="text-xs font-medium px-2 py-0.5 rounded bg-navy/5 text-navy">
                                  {kg ? "Kg" : stock?.unit}
                                </span>
                              </td>
                              <td className={`px-4 py-3 text-center font-medium ${kg || stock?.boxCell === "—" ? "text-gray-300" : "text-navy"}`}>
                                {kg ? "—" : stock?.boxCell}
                              </td>
                              <td className={`px-4 py-3 text-center font-medium ${!kg && stock?.pieceCell === "—" ? "text-gray-300" : "text-navy"}`}>
                                {kg ? formatKgQty(p.currentStock) : stock?.pieceCell}
                              </td>
                              <td className="px-4 py-3 font-medium text-navy">
                                {kg ? "—" : `${formatCurrency(p.sellingPrice)}/Box`}
                              </td>
                              <td className="px-4 py-3 text-gray-600">
                                {kg
                                  ? `${formatCurrency(p.sellingPrice)}/Kg`
                                  : `${formatCurrency(p.piecePrice ?? piecePriceFromBox(p.sellingPrice, p.piecesPerBox))}/Pc`}
                              </td>
                              <td className="px-4 py-3">
                                <StatusBadge status={p.stockStatus} />
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      setStockInProduct({
                                        _id: p._id,
                                        productId: p.productId,
                                        name: p.name,
                                        piecesPerBox: p.piecesPerBox,
                                        currentStock: p.currentStock,
                                        sellingUnit: p.sellingUnit,
                                        unit: p.unit,
                                      })
                                    }
                                    title="Stock In (Gadi/Delivery)"
                                  >
                                    <Truck className="h-4 w-4 text-gold" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openEdit(p)}
                                    title="Edit"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDeleteId(p._id)}
                                    title="Delete"
                                  >
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );})}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
              <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Product */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editProduct ? "Edit Product" : "Create New Product"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-6">
            {/* Step 1: Category */}
            <section className="rounded-lg border border-navy/10 bg-navy/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">
                  1
                </span>
                <h3 className="font-semibold text-navy">Category</h3>
              </div>
              <div className="flex gap-2">
                <Select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="flex-1"
                >
                  <option value="">Select category</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCategoryDialogOpen(true)}
                >
                  <FolderPlus className="h-4 w-4" />
                </Button>
              </div>
            </section>

            {/* Step 2: Product name + number */}
            <section className="rounded-lg border border-gold/30 bg-gold/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gold text-xs font-bold text-navy">
                  2
                </span>
                <h3 className="font-semibold text-navy">Product Name & Number</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Product Name * (unique)</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Shuper Heavy"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Har product ka alag naam — duplicate name allowed nahi
                  </p>
                </div>
                <div>
                  <Label>Product Number *</Label>
                  <Input
                    value={form.productId}
                    onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))}
                    placeholder="e.g. 1100"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Same number multiple products me use ho sakta hai
                  </p>
                </div>
              </div>
              {(form.name || form.productId) && (
                <p className="text-sm text-navy rounded-md bg-white border px-3 py-2">
                  Display:{" "}
                  <strong>{formatProductDisplay(form.name || "—", form.productId || "—")}</strong>
                </p>
              )}
              <div>
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                />
              </div>
            </section>

            {/* Step 3: Stock & pricing */}
            <section className="rounded-lg border border-gray-200 p-4 space-y-4">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-600 text-xs font-bold text-white">
                  3
                </span>
                <h3 className="font-semibold text-navy">Stock & Pricing</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Selling Unit *</Label>
                  <Select
                    value={form.sellingUnit}
                    onChange={(e) => {
                      const sellingUnit = e.target.value as SellingUnit;
                      setForm((f) => ({
                        ...f,
                        sellingUnit,
                        unit: sellingUnit === "kg" ? "Kg" : sellingUnit === "piece" ? "Piece" : "Box",
                        stockUnit: sellingUnit === "kg" ? "kg" : f.stockUnit === "kg" ? "pieces" : f.stockUnit,
                        piecesPerBox: sellingUnit === "kg" ? 1 : f.piecesPerBox,
                      }));
                    }}
                  >
                    <option value="box">Box (alag box / piece bill)</option>
                    <option value="piece">Piece only</option>
                    <option value="kg">Kg (weight me bechte hain)</option>
                  </Select>
                </div>
                {!isKg && (
                <div>
                  <Label>Pieces Per Box *</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.piecesPerBox}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, piecesPerBox: Number(e.target.value) || 1 }))
                    }
                  />
                </div>
                )}
                <div>
                  <Label>Minimum Stock Alert</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.minimumStock}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, minimumStock: Number(e.target.value) }))
                    }
                  />
                </div>
                <div>
                  <Label>Stock Unit</Label>
                  <Select
                    value={isKg ? "kg" : form.stockUnit}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        stockUnit: e.target.value as "pieces" | "boxes" | "kg",
                      }))
                    }
                    disabled={isKg}
                  >
                    {isKg ? (
                      <option value="kg">Kg</option>
                    ) : (
                      <>
                        <option value="pieces">Pieces</option>
                        <option value="boxes">Boxes</option>
                      </>
                    )}
                  </Select>
                </div>
                <div>
                  <Label>{editProduct ? "Update Stock Qty" : "Initial Stock Qty"}</Label>
                  <Input
                    type="number"
                    min={0}
                    step={isKg ? "0.001" : "1"}
                    value={form.stockQuantity}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, stockQuantity: Number(e.target.value) }))
                    }
                  />
                </div>
                {form.stockQuantity > 0 && (() => {
                  const preview = isKg
                    ? { summary: `${formatKgQty(stockInPieces)} available` }
                    : formatAvailableStockFromPieces(stockInPieces, form.piecesPerBox);
                  return (
                  <div className="sm:col-span-2 text-xs text-navy space-y-1 rounded-md border bg-white px-3 py-2">
                    <p><strong>Available stock preview:</strong> {preview.summary}</p>
                  </div>
                  );
                })()}
                <div>
                  <Label>Cost Price (₹)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.costPrice}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, costPrice: Number(e.target.value) }))
                    }
                  />
                </div>
                <div>
                  <Label>{isKg ? "Selling Price — per Kg (₹) *" : "Selling Price — per Box (₹) *"}</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.sellingPrice}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, sellingPrice: Number(e.target.value) }))
                    }
                  />
                  {form.sellingPrice > 0 && (
                    <div className="mt-2 rounded-md border bg-white px-3 py-2 text-xs text-navy space-y-1">
                      {isKg ? (
                        <p>
                          <strong>Kg rate:</strong> ₹{form.sellingPrice.toLocaleString("en-IN")}/Kg
                        </p>
                      ) : (
                        <>
                          <p>
                            <strong>Box rate:</strong> ₹{form.sellingPrice.toLocaleString("en-IN")}/Box
                          </p>
                          {form.piecesPerBox > 1 && (
                            <p>
                              <strong>Piece rate:</strong> ₹
                              {piecePriceFromBox(form.sellingPrice, form.piecesPerBox).toLocaleString("en-IN")}/Pc
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        status: e.target.value as "active" | "inactive",
                      }))
                    }
                  >
                    <option value="active">Active (Home page pe dikhega)</option>
                    <option value="inactive">Inactive</option>
                  </Select>
                </div>
              </div>
            </section>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="gold" disabled={submitting}>
                {submitting ? "Saving..." : editProduct ? "Update Product" : "Create Product"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Category */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Category Name</Label>
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="e.g. PVC Stock"
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddCategory())}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCategoryDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="gold"
                disabled={submitting || !newCategoryName.trim()}
                onClick={handleAddCategory}
              >
                {submitting ? "Saving..." : "Create Category"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <StockInDialog
        open={!!stockInProduct}
        onOpenChange={(open) => !open && setStockInProduct(null)}
        product={stockInProduct}
        onSuccess={fetchProducts}
      />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete Product"
        description="Are you sure you want to delete this product? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
        loading={submitting}
      />
    </div>
  );
}
