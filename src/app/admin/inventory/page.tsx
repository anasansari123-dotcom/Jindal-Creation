"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SearchInput } from "@/components/ui/search-input";
import { Pagination } from "@/components/ui/pagination";
import { PageLoader, EmptyState } from "@/components/ui/loading";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { Plus, History, Download, Truck } from "lucide-react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { stockAdjustmentSchema } from "@/lib/validations";
import { formatDateTime, formatBoxPieces } from "@/lib/utils";
import { generateInventoryPDF, downloadPDF } from "@/lib/pdf";
import { uploadToCloudinary } from "@/lib/cloudinary-upload-client";
import { formatAvailableStockFromPieces } from "@/lib/stock-display";
import { StockInDialog, type StockInProduct } from "@/components/stock-in-dialog";
import { z } from "zod";

type StockInput = z.infer<typeof stockAdjustmentSchema>;

function txTypeVariant(type: string): "success" | "danger" | "warning" | "gold" | "default" {
  if (type === "STOCK_IN" || type === "RETURN") return "success";
  if (type === "SALE") return "danger";
  if (type === "ADJUSTMENT") return "warning";
  return "default";
}

interface InventoryItem {
  _id: string;
  productId: string;
  name: string;
  category: string;
  currentStock: number;
  minimumStock: number;
  piecesPerBox: number;
  stockStatus: string;
  boxes: number;
  loosePieces?: number;
}

interface Transaction {
  _id: string;
  productName: string;
  productCode: string;
  type: string;
  typeLabel: string;
  quantity: number;
  pieces: number;
  boxes: number;
  change: number;
  qtyLabel: string;
  previousStock: number;
  newStock: number;
  beforeLabel: string;
  afterLabel: string;
  notes?: string;
  createdByName: string;
  createdAt: string;
  reference?: string;
  customerName?: string;
  billLink?: string;
}

export default function InventoryPage() {
  const searchParams = useSearchParams();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(() => searchParams.get("status") || "");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyProduct, setHistoryProduct] = useState<InventoryItem | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [stockInProduct, setStockInProduct] = useState<StockInProduct | null>(null);
  const [stockInPickerOpen, setStockInPickerOpen] = useState(false);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<StockInput>({
    resolver: zodResolver(stockAdjustmentSchema) as Resolver<StockInput>,
    defaultValues: { type: "ADJUSTMENT" },
  });

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ search, page: String(page) });
    if (status) params.set("status", status);
    const res = await fetch(`/api/inventory?${params}`);
    const data = await res.json();
    setInventory(data.inventory || []);
    setTotalPages(data.pagination?.totalPages || 1);
    setTotal(data.pagination?.total || 0);
    setLoading(false);
  }, [search, status, page]);

  useEffect(() => {
    const timer = setTimeout(fetchInventory, 300);
    return () => clearTimeout(timer);
  }, [fetchInventory]);

  useEffect(() => {
    const s = searchParams.get("status");
    if (s && s !== status) {
      setStatus(s);
      setPage(1);
    }
  }, [searchParams, status]);

  const openStockDialog = (item?: InventoryItem) => {
    reset({ type: "ADJUSTMENT", quantity: 1, productId: item?._id || "", notes: "" });
    setDialogOpen(true);
  };

  const openHistory = async (item: InventoryItem) => {
    setHistoryProduct(item);
    setHistoryOpen(true);
    setHistoryLoading(true);
    const res = await fetch(`/api/inventory/history?productId=${item._id}`);
    const data = await res.json();
    setTransactions(data.transactions || []);
    setHistoryLoading(false);
  };

  const onSubmit = async (data: StockInput) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) {
        toast(result.error, "error");
        return;
      }
      toast("Stock updated successfully", "success");
      setDialogOpen(false);
      reset();
      fetchInventory();
    } catch {
      toast("Something went wrong", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({ export: "1" });
      if (search) params.set("search", search);
      if (status) params.set("status", status);
      const res = await fetch(`/api/inventory?${params}`);
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Export failed", "error");
        return;
      }
      const items: InventoryItem[] = data.inventory || [];
      if (items.length === 0) {
        toast("Export ke liye koi inventory nahi mili", "error");
        return;
      }
      const doc = generateInventoryPDF(
        items.map((item) => ({
          productId: item.productId,
          name: item.name,
          category: item.category,
          boxes: item.boxes,
          loosePieces: item.loosePieces ?? item.currentStock % (item.piecesPerBox || 1),
          currentStock: item.currentStock,
          piecesPerBox: item.piecesPerBox,
          minimumStock: item.minimumStock,
          stockStatus: item.stockStatus,
        })),
        {
        search: search || undefined,
        status: status || undefined,
        generatedAt: new Date(),
      });
      const dateStamp = new Date().toISOString().slice(0, 10);
      const filename = `Jindal-Creation-Inventory-${dateStamp}.pdf`;
      downloadPDF(doc, filename);
      try {
        const blob = doc.output("blob");
        await uploadToCloudinary({
          file: blob,
          filename,
          category: "inventory-pdf",
          ref: dateStamp,
          mimeType: "application/pdf",
        });
        toast(`${items.length} products — PDF download + Cloudinary par save`, "success");
      } catch {
        toast(`${items.length} products ka stock PDF download ho gaya`, "success");
      }
    } catch {
      toast("PDF export fail — dubara try karein", "error");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-navy">Inventory</h1>
          <p className="text-sm text-gray-500">Abhi available stock — box aur piece alag (0 wala column hide)</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleExportPdf} disabled={exporting}>
            <Download className="h-4 w-4" />
            {exporting ? "Exporting..." : "Export PDF"}
          </Button>
          <Button variant="outline" onClick={() => setStockInPickerOpen(true)}>
            <Truck className="h-4 w-4" /> Receive Stock (Gadi)
          </Button>
          <Button variant="gold" onClick={() => openStockDialog()}>
            <Plus className="h-4 w-4" /> Adjust / Return
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-gold/30 bg-gold/5 px-4 py-3 text-sm text-navy">
        <strong>Available Stock:</strong> Yeh abhi godown me bacha hua stock hai. Sirf box ho to piece column &quot;—&quot;;
        sirf piece ho to box &quot;—&quot;; dono ho to alag-alag. Sale ke baad yahi update hota hai.
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-3">
            <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search products..." />
            <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-full sm:w-48">
              <option value="">All Status</option>
              <option value="In Stock">In Stock</option>
              <option value="Low Stock">Low Stock</option>
              <option value="Out of Stock">Out of Stock</option>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <PageLoader />
          ) : inventory.length === 0 ? (
            <EmptyState title="No inventory items" description="Products will appear here once added" />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-3 font-medium">Product ID</th>
                      <th className="pb-3 font-medium">Name</th>
                      <th className="pb-3 font-medium">Category</th>
                      <th className="pb-3 font-medium">Unit</th>
                      <th className="pb-3 font-medium text-center">Box Available</th>
                      <th className="pb-3 font-medium text-center">Piece Available</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.map((item) => {
                      const stock = formatAvailableStockFromPieces(
                        item.currentStock,
                        item.piecesPerBox || 1
                      );
                      return (
                      <tr key={item._id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-3 font-medium text-gold">{item.productId}</td>
                        <td className="py-3">{item.name}</td>
                        <td className="py-3 text-gray-500">{item.category}</td>
                        <td className="py-3">
                          <span className="text-xs font-medium px-2 py-0.5 rounded bg-navy/5 text-navy">
                            {stock.unit}
                          </span>
                        </td>
                        <td className={`py-3 text-center font-medium ${stock.boxCell === "—" ? "text-gray-300" : "text-navy"}`}>
                          {stock.boxCell}
                        </td>
                        <td className={`py-3 text-center font-medium ${stock.pieceCell === "—" ? "text-gray-300" : "text-navy"}`}>
                          {stock.pieceCell}
                        </td>
                        <td className="py-3"><StatusBadge status={item.stockStatus} /></td>
                        <td className="py-3">
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => setStockInProduct({
                              _id: item._id,
                              productId: item.productId,
                              name: item.name,
                              piecesPerBox: item.piecesPerBox,
                              currentStock: item.currentStock,
                            })} title="Stock In (Gadi)">
                              <Truck className="h-4 w-4 text-gold" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => openStockDialog(item)} title="Adjust">
                              <Plus className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => openHistory(item)} title="History">
                              <History className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );})}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adjust / Return Stock</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label>Product *</Label>
              <Select {...register("productId")} onChange={(e) => setValue("productId", e.target.value)}>
                <option value="">Select product</option>
                {inventory.map((item) => (
                  <option key={item._id} value={item._id}>{item.name} ({item.productId})</option>
                ))}
              </Select>
              {errors.productId && <p className="text-xs text-red-500 mt-1">{errors.productId.message}</p>}
            </div>
            <div>
              <Label>Type *</Label>
              <Select {...register("type")}>
                <option value="ADJUSTMENT">Adjustment (set exact qty)</option>
                <option value="RETURN">Return (add back)</option>
              </Select>
            </div>
            <div>
              <Label>Quantity *</Label>
              <Input {...register("quantity")} type="number" min={1} />
              {errors.quantity && <p className="text-xs text-red-500 mt-1">{errors.quantity.message}</p>}
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea {...register("notes")} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" variant="gold" disabled={submitting}>
                {submitting ? "Updating..." : "Update Stock"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">
              Stock History
              {historyProduct && (
                <span className="block text-sm font-normal text-gray-500 mt-1">
                  {historyProduct.name} · {historyProduct.productId} · Current:{" "}
                  <strong className="text-navy">
                    {formatBoxPieces(
                      historyProduct.currentStock,
                      historyProduct.piecesPerBox || 1
                    )}
                  </strong>
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          {historyLoading ? (
            <PageLoader />
          ) : transactions.length === 0 ? (
            <EmptyState
              title="No stock movements yet"
              description="Stock In, Final Bill sales, adjustments aur returns yahan dikhenge"
            />
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full min-w-[720px] text-sm border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50 text-left text-gray-500">
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">Date</th>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">Type</th>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap text-right">Qty Moved</th>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap text-right">
                      Stock Before
                      <span className="block text-[10px] font-normal text-gray-400">available</span>
                    </th>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap text-right">
                      Stock After
                      <span className="block text-[10px] font-normal text-gray-400">available now</span>
                    </th>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">Bill / Customer</th>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">By</th>
                    <th className="px-3 py-2.5 font-medium min-w-[140px]">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx._id} className="border-b last:border-0 hover:bg-gray-50/80">
                      <td className="px-3 py-3 text-gray-600 whitespace-nowrap align-top">
                        {formatDateTime(tx.createdAt)}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <Badge variant={txTypeVariant(tx.type)}>{tx.typeLabel}</Badge>
                      </td>
                      <td
                        className={`px-3 py-3 text-right font-medium whitespace-nowrap align-top ${
                          tx.type === "SALE"
                            ? "text-red-600"
                            : tx.change > 0
                              ? "text-green-700"
                              : "text-navy"
                        }`}
                      >
                        {tx.qtyLabel}
                      </td>
                      <td className="px-3 py-3 text-right text-gray-500 align-top whitespace-nowrap">
                        {tx.beforeLabel}
                      </td>
                      <td className="px-3 py-3 text-right font-medium text-navy align-top whitespace-nowrap">
                        {tx.afterLabel}
                      </td>
                      <td className="px-3 py-3 align-top">
                        {tx.reference ? (
                          <div className="space-y-0.5">
                            {tx.billLink ? (
                              <Link
                                href={tx.billLink}
                                className="text-gold hover:underline font-medium block"
                              >
                                {tx.reference}
                              </Link>
                            ) : (
                              <span className="font-medium text-navy">{tx.reference}</span>
                            )}
                            {tx.customerName && (
                              <div className="text-xs text-gray-500">{tx.customerName}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-gray-600 whitespace-nowrap align-top">
                        {tx.createdByName}
                      </td>
                      <td className="px-3 py-3 text-gray-500 align-top">{tx.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <StockInDialog
        open={!!stockInProduct}
        onOpenChange={(open) => !open && setStockInProduct(null)}
        product={stockInProduct}
        onSuccess={fetchInventory}
      />

      <StockInDialog
        open={stockInPickerOpen}
        onOpenChange={setStockInPickerOpen}
        product={null}
        products={inventory.map((item) => ({
          _id: item._id,
          productId: item.productId,
          name: item.name,
          piecesPerBox: item.piecesPerBox,
          currentStock: item.currentStock,
        }))}
        onSuccess={fetchInventory}
      />
    </div>
  );
}
