"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SearchInput } from "@/components/ui/search-input";
import { PageLoader, EmptyState } from "@/components/ui/loading";
import { formatCurrency } from "@/lib/utils";
import { History, Package, ChevronRight } from "lucide-react";

interface ProductSummary {
  _id: string;
  productId: string;
  name: string;
  category: string;
  piecesPerBox: number;
  currentStock: number;
  totalEntries: number;
  totalPieces: number;
  totalBoxes: number;
  totalLoosePieces?: number;
  totalAmount: number;
  uniqueCustomers: number;
}

export default function ProductHistoryListPage() {
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/products/history?search=${encodeURIComponent(search)}`);
    const data = await res.json();
    setProducts(data.products || []);
    setLoading(false);
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(fetchProducts, 300);
    return () => clearTimeout(timer);
  }, [fetchProducts]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold text-navy flex items-center gap-2">
          <History className="h-6 w-6 text-gold" />
          Product History
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Har product par click karein — kis customer ko kitne pieces/boxes kab gaye
        </p>
      </div>

      <Card>
        <CardHeader>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search product name, ID, category..."
          />
        </CardHeader>
        <CardContent>
          {loading ? (
            <PageLoader />
          ) : products.length === 0 ? (
            <EmptyState title="No products found" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-3 font-medium">Product ID</th>
                    <th className="pb-3 font-medium">Name</th>
                    <th className="pb-3 font-medium">Category</th>
                    <th className="pb-3 font-medium text-right">Total Boxes Sold</th>
                    <th className="pb-3 font-medium text-right">Loose Pcs Sold</th>
                    <th className="pb-3 font-medium text-right">Total Pieces</th>
                    <th className="pb-3 font-medium text-right">Customers</th>
                    <th className="pb-3 font-medium text-right">Sales Amount</th>
                    <th className="pb-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p._id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-3 font-medium text-gold">{p.productId}</td>
                      <td className="py-3">
                        <Link
                          href={`/admin/products/history/${p._id}`}
                          className="font-medium text-navy hover:text-gold hover:underline"
                        >
                          {p.name}
                        </Link>
                      </td>
                      <td className="py-3 text-gray-500">{p.category}</td>
                      <td className="py-3 text-right font-medium">{p.totalBoxes}</td>
                      <td className="py-3 text-right">{p.totalLoosePieces ?? 0}</td>
                      <td className="py-3 text-right">{p.totalPieces}</td>
                      <td className="py-3 text-right">{p.uniqueCustomers}</td>
                      <td className="py-3 text-right text-green-700">
                        {formatCurrency(p.totalAmount)}
                      </td>
                      <td className="py-3 text-right">
                        <Link href={`/admin/products/history/${p._id}`}>
                          <ChevronRight className="h-4 w-4 text-gray-400 inline" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="rounded-lg border border-gold/30 bg-gold/5 p-4 text-sm text-gray-700 flex gap-3">
        <Package className="h-5 w-5 text-gold shrink-0 mt-0.5" />
        <p>
          History Dispatch Bills, Final Bills, Orders aur Confirm Bills se collect hoti hai.
          Duplicate entries avoid ki jaati hain — ek sale sirf ek baar count hoti hai.
        </p>
      </div>
    </div>
  );
}
