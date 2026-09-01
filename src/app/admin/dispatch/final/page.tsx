"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PageLoader } from "@/components/ui/loading";
import { toast } from "@/components/ui/toast";
import { formatDate } from "@/lib/utils";
import { BillItemsTable } from "@/components/bill-items-table";
import { ArrowLeft, CheckCircle, Search, FileText } from "lucide-react";

interface Customer {
  _id: string;
  customerId: string;
  name: string;
  companyName?: string;
}

interface PendingDispatch {
  _id: string;
  dispatchId: string;
  customerName: string;
  customerCompany?: string;
  dispatchDate: string;
  orderType?: "immediate" | "advance";
  readyByDate?: string;
  advance?: number;
  total: number;
  items: Array<{
    productName: string;
    productCode: string;
    pieces: number;
    boxes: number;
    piecesPerBox?: number;
    unitPrice: number;
    discount: number;
    total: number;
  }>;
}

export default function CreateFinalBillPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <CreateFinalBillContent />
    </Suspense>
  );
}

function CreateFinalBillContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  const [customerId, setCustomerId] = useState("");
  const [dispatchIdInput, setDispatchIdInput] = useState("");
  const [pendingBills, setPendingBills] = useState<PendingDispatch[]>([]);
  const [selectedBill, setSelectedBill] = useState<PendingDispatch | null>(null);
  const [mode, setMode] = useState<"customer" | "id">("customer");

  useEffect(() => {
    fetch("/api/customers?lite=true&limit=500")
      .then((r) => r.json())
      .then((d) => {
        setCustomers(d.customers || []);
        setLoading(false);
      });
  }, []);

  const searchByDispatchId = useCallback(async (id?: string) => {
    const queryId = (id ?? dispatchIdInput).trim();
    if (!queryId) {
      toast("Dispatch Bill ID likhiye", "error");
      return;
    }
    setSearching(true);
    const res = await fetch(
      `/api/dispatch?dispatchId=${encodeURIComponent(queryId)}&limit=1`
    );
    const data = await res.json();
    const bills = (data.dispatches || []).filter(
      (b: PendingDispatch & { billStatus: string }) => b.billStatus === "DISPATCH"
    );
    if (bills.length === 0) {
      toast("Dispatch bill nahi mila ya pehle se Final Bill ban chuka hai", "error");
      setPendingBills([]);
      setSelectedBill(null);
    } else {
      setPendingBills(bills);
      setSelectedBill(bills[0]);
    }
    setSearching(false);
  }, [dispatchIdInput]);

  useEffect(() => {
    const prefillId = searchParams.get("dispatchId");
    if (prefillId) {
      setMode("id");
      setDispatchIdInput(prefillId);
      searchByDispatchId(prefillId);
    }
  }, [searchParams, searchByDispatchId]);

  const loadPendingForCustomer = useCallback(async (cid: string) => {
    if (!cid) {
      setPendingBills([]);
      setSelectedBill(null);
      return;
    }
    setSearching(true);
    const res = await fetch(`/api/dispatch?customerId=${cid}&pendingOnly=true&limit=50`);
    const data = await res.json();
    const bills = data.dispatches || [];
    setPendingBills(bills);
    if (bills.length === 1) {
      setSelectedBill(bills[0]);
    } else {
      setSelectedBill(null);
    }
    setSearching(false);
  }, []);

  useEffect(() => {
    if (mode === "customer" && customerId) {
      loadPendingForCustomer(customerId);
    }
  }, [customerId, mode, loadPendingForCustomer]);

  const handleGoToFinalize = () => {
    if (!selectedBill) return;
    router.push(`/admin/dispatch/${selectedBill._id}/edit?finalize=1`);
  };

  if (loading) return <PageLoader />;

  const customer = customers.find((c) => c._id === customerId);

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Link href="/admin/dispatch">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-serif font-bold text-navy">Create Final Bill</h1>
          <p className="text-sm text-gray-500">
            Dispatch select karein — rate aur payment review karke Final Bill banayein
          </p>
        </div>
      </div>

      <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
        <strong>Rule:</strong> Pehle Dispatch Bill banao (sirf products/qty, bina price).
        Final Bill banate waqt rate aur payment review karein — tab stock minus hoga.
      </div>

      <div className="flex gap-2">
        <Button
          variant={mode === "customer" ? "gold" : "outline"}
          onClick={() => { setMode("customer"); setPendingBills([]); setSelectedBill(null); setDispatchIdInput(""); }}
        >
          Customer se Select
        </Button>
        <Button
          variant={mode === "id" ? "gold" : "outline"}
          onClick={() => { setMode("id"); setPendingBills([]); setSelectedBill(null); setCustomerId(""); }}
        >
          Dispatch Bill ID se
        </Button>
      </div>

      {mode === "customer" ? (
        <Card>
          <CardHeader><CardTitle>Select Customer / Company</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Customer / Company *</Label>
              <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">Select customer</option>
                {customers.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}{c.companyName ? ` — ${c.companyName}` : ""} ({c.customerId})
                  </option>
                ))}
              </Select>
            </div>

            {searching && <PageLoader />}

            {!searching && customerId && pendingBills.length === 0 && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-800">
                Is customer ka koi pending Dispatch Bill nahi hai.
                Pehle <Link href="/admin/dispatch/new" className="underline font-medium">Dispatch Bill</Link> banayein.
              </div>
            )}

            {!searching && pendingBills.length > 0 && (
              <div className="space-y-2">
                <Label>
                  Pending Dispatch Bills {customer && `— ${customer.companyName || customer.name}`}
                </Label>
                {pendingBills.map((bill) => (
                  <button
                    key={bill._id}
                    type="button"
                    onClick={() => setSelectedBill(bill)}
                    className={`w-full text-left rounded-lg border p-4 transition-colors ${
                      selectedBill?._id === bill._id
                        ? "border-gold bg-gold/10"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <p className="font-semibold text-gold">{bill.dispatchId}</p>
                        <p className="text-sm text-gray-600">{bill.customerName}</p>
                        <p className="text-xs text-gray-400">
                          Order: {formatDate(bill.dispatchDate)}
                          {bill.readyByDate && ` · Ready by: ${formatDate(bill.readyByDate)}`}
                          {bill.items?.length ? ` · ${bill.items.length} item(s)` : ""}
                        </p>
                      </div>
                    </div>
                    {bill.items?.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <BillItemsTable items={bill.items} showPricing={false} />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>Enter Dispatch Bill ID</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Dispatch Bill ID *</Label>
              <div className="flex gap-2">
                <Input
                  value={dispatchIdInput}
                  onChange={(e) => setDispatchIdInput(e.target.value)}
                  placeholder="e.g. JC-DSP-0001"
                />
                <Button type="button" variant="outline" onClick={() => searchByDispatchId()} disabled={searching}>
                  <Search className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Agar company ka dispatch bill pehle se bana hai toh uski ID yahan daalein
              </p>
            </div>

            {selectedBill && (
              <div className="rounded-lg border border-gold bg-gold/5 p-4 space-y-3">
                <div>
                  <p className="font-semibold text-gold">{selectedBill.dispatchId}</p>
                  <p className="text-sm">
                    {selectedBill.customerName}
                    {selectedBill.items?.length ? ` · ${selectedBill.items.length} item(s)` : ""}
                  </p>
                  {selectedBill.readyByDate && (
                    <p className="text-xs text-gold mt-1">
                      Maal ready by: {formatDate(selectedBill.readyByDate)}
                    </p>
                  )}
                </div>
                {selectedBill.items?.length > 0 && (
                  <BillItemsTable items={selectedBill.items} showPricing={false} />
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {selectedBill && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-gold" />
              Final Bill Generate Karein
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm space-y-1">
              <p><strong>Dispatch Bill:</strong> {selectedBill.dispatchId}</p>
              <p><strong>Customer:</strong> {selectedBill.customerName}</p>
              <p className="text-gray-600">Rate aur payment review screen par set honge</p>
            </div>
            {selectedBill.items?.length > 0 && (
              <BillItemsTable items={selectedBill.items} showPricing={false} />
            )}
            <p className="text-xs text-red-600">
              Final Bill generate hone par product stock inventory se minus ho jayega.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href={`/admin/dispatch/${selectedBill._id}`}>
                <Button variant="outline">View Dispatch Bill</Button>
              </Link>
              <Button variant="gold" onClick={handleGoToFinalize}>
                <CheckCircle className="h-4 w-4" /> Review Rates & Create Final Bill
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
