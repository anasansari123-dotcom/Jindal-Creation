import mongoose from "mongoose";
import { Payment } from "@/lib/models";

/** Combine stored bill payment mode with FIFO allocation payment methods */
export async function resolveBillPaymentMode(
  dispatchMongoId: string,
  storedMode?: string,
  advance = 0
): Promise<string> {
  const payments = await Payment.find({
    "allocations.billRef": dispatchMongoId,
  })
    .select("method")
    .lean();

  const methods = new Set<string>();
  if (storedMode) methods.add(storedMode);
  for (const payment of payments) {
    methods.add(payment.method);
  }

  if (methods.size === 0) {
    return advance > 0 ? "—" : "Not Paid Yet";
  }
  return Array.from(methods).join(", ");
}

type BillWithPayment = {
  _id: unknown;
  paymentMode?: string;
  advance: number;
};

function paymentModeFromMethods(methods: Set<string>, advance: number): string {
  if (methods.size === 0) {
    return advance > 0 ? "—" : "Not Paid Yet";
  }
  return Array.from(methods).join(", ");
}

/** Batch-resolve payment modes for dispatch list / customer bills */
export async function enrichDispatchesPaymentModes<T extends BillWithPayment>(
  dispatches: T[]
): Promise<(T & { paymentMode: string })[]> {
  if (dispatches.length === 0) return [];

  const ids = dispatches.map((d) => d._id as mongoose.Types.ObjectId);
  const payments = await Payment.find({
    "allocations.billRef": { $in: ids },
  })
    .select("method allocations")
    .lean();

  const methodsByBill = new Map<string, Set<string>>();
  for (const dispatch of dispatches) {
    const key = String(dispatch._id);
    if (dispatch.paymentMode) {
      if (!methodsByBill.has(key)) methodsByBill.set(key, new Set());
      methodsByBill.get(key)!.add(dispatch.paymentMode);
    }
  }
  for (const payment of payments) {
    for (const allocation of payment.allocations) {
      const key = String(allocation.billRef);
      if (!methodsByBill.has(key)) methodsByBill.set(key, new Set());
      methodsByBill.get(key)!.add(payment.method);
    }
  }

  return dispatches.map((dispatch) => {
    const methods = methodsByBill.get(String(dispatch._id));
    return {
      ...dispatch,
      paymentMode: paymentModeFromMethods(methods ?? new Set(), dispatch.advance),
    };
  });
}
