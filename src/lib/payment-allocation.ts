import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { Customer, Order, Dispatch, ConfirmBill, Payment } from "@/lib/models";
import type { IPaymentAllocation } from "@/lib/models/Payment";
import { generatePaymentId } from "@/lib/generators";
import { getPaymentStatus } from "@/lib/utils";
import { getCustomerBillsForRecord } from "@/lib/customer-bills.server";
import {
  type CustomerBillEntry,
  type BillSource,
  getCustomerPaymentStats,
} from "@/lib/customer-bills";
import type { SessionUser } from "@/lib/auth/session";

export interface AllocationResult {
  payment: {
    paymentId: string;
    amount: number;
    allocations: IPaymentAllocation[];
    creditAdded: number;
  };
  creditBalance: number;
  bills: CustomerBillEntry[];
}

/** Align stored customer creditBalance with bill-derived advance (prevents double-count drift) */
export async function syncCustomerCreditBalance(customerId: string, customerName: string) {
  await connectDB();
  const customer = await Customer.findById(customerId);
  if (!customer) return 0;

  const bills = await getCustomerBillsForRecord(customerId, customerName);
  const stats = getCustomerPaymentStats(bills, customer.creditBalance || 0);

  if ((customer.creditBalance || 0) !== stats.creditBalance) {
    customer.creditBalance = stats.creditBalance;
    await customer.save();
  }

  return stats.creditBalance;
}

async function syncConfirmBillPayment(billId: string, newPaid: number, total: number) {
  const pending = Math.max(0, total - newPaid);
  const paymentStatus = getPaymentStatus(total, newPaid);
  await ConfirmBill.updateOne(
    { confirmBillId: billId },
    { advance: newPaid, pending, paymentStatus }
  );
}

async function persistBillPayment(bill: CustomerBillEntry, newPaid: number) {
  const pending = Math.max(0, bill.total - newPaid);
  const paymentStatus = getPaymentStatus(bill.total, newPaid);

  if (bill.billSource === "Order") {
    await Order.findByIdAndUpdate(bill.refId, {
      paidAmount: newPaid,
      advance: newPaid,
      pending,
      paymentStatus,
    });
  } else if (bill.billSource === "Dispatch") {
    await Dispatch.findByIdAndUpdate(bill.refId, {
      advance: newPaid,
      pending,
      paymentStatus,
    });
    if (bill.billType === "Final") {
      await syncConfirmBillPayment(bill.billId, newPaid, bill.total);
    }
  } else if (bill.billSource === "ConfirmBill") {
    await ConfirmBill.findByIdAndUpdate(bill.refId, {
      advance: newPaid,
      pending,
      paymentStatus,
    });
    const dispatch = await Dispatch.findOne({ finalBillId: bill.billId }).lean();
    if (dispatch) {
      await Dispatch.findByIdAndUpdate(dispatch._id, {
        advance: newPaid,
        pending,
        paymentStatus,
      });
    }
  }
}

/** Settle old bill pending by moving liability to a new dispatch bill */
export async function persistBillPaymentForTransfer(
  bill: CustomerBillEntry,
  transferAmount: number,
  targetDispatchCode: string,
  byName: string
) {
  const amount = Math.min(transferAmount, bill.pending);
  if (amount <= 0) return;

  const newPaid = bill.paid + amount;
  await persistBillPayment(bill, newPaid);

  const note = `Pending ₹${amount.toLocaleString("en-IN")} nayi bill ${targetDispatchCode} me transfer hui`;

  if (bill.billSource === "Dispatch") {
    await Dispatch.findByIdAndUpdate(bill.refId, {
      $push: {
        statusHistory: {
          status: "COMPLETED",
          billStatus: bill.billType === "Final" ? "FINAL" : "DISPATCH",
          date: new Date(),
          note,
          byName,
        },
      },
    });
  } else if (bill.billSource === "Order") {
    const order = await Order.findById(bill.refId).lean();
    const prevNotes = order?.notes?.trim();
    await Order.findByIdAndUpdate(bill.refId, {
      notes: prevNotes ? `${prevNotes}\n${note}` : note,
    });
  }
}

/** FIFO: oldest pending bills first, surplus → customer creditBalance */
export async function applyCustomerPayment(params: {
  customerId: string;
  amount: number;
  method: string;
  date?: Date;
  referenceNumber?: string;
  notes?: string;
  user: SessionUser;
}): Promise<AllocationResult> {
  await connectDB();

  const customer = await Customer.findById(params.customerId);
  if (!customer) throw new Error("Customer not found");

  const bills = await getCustomerBillsForRecord(params.customerId, customer.name);
  let remaining = params.amount;
  const allocations: IPaymentAllocation[] = [];

  for (const bill of bills) {
    if (remaining <= 0) break;
    if (bill.pending <= 0) continue;

    const apply = Math.min(remaining, bill.pending);
    const newPaid = bill.paid + apply;

    await persistBillPayment(bill, newPaid);

    allocations.push({
      billRef: new mongoose.Types.ObjectId(bill.refId),
      billSource: bill.billSource as BillSource,
      billCode: bill.billId,
      billType: bill.billType,
      amount: apply,
    });

    bill.paid = newPaid;
    bill.pending = Math.max(0, bill.total - newPaid);
    bill.paymentStatus = getPaymentStatus(bill.total, newPaid);
    remaining -= apply;
  }

  const creditAdded = remaining;
  if (creditAdded > 0) {
    await Customer.findByIdAndUpdate(params.customerId, {
      $inc: { creditBalance: creditAdded },
    });
  }

  const paymentId = await generatePaymentId();
  const billCodes = allocations.map((a) => a.billCode).join(", ");

  const paymentDoc: Record<string, unknown> = {
    paymentId,
    customerId: customer._id,
    customerName: customer.name,
    amount: params.amount,
    date: params.date || new Date(),
    method: params.method,
    allocations,
    creditAdded,
    addedBy: new mongoose.Types.ObjectId(params.user.id),
    addedByName: params.user.name,
  };
  if (params.referenceNumber) paymentDoc.referenceNumber = params.referenceNumber;
  if (params.notes) paymentDoc.notes = params.notes;
  if (allocations.length > 0) {
    paymentDoc.orderId = allocations[0].billRef;
    paymentDoc.orderCode = billCodes;
  }

  await Payment.create(paymentDoc);

  const syncedBalance = await syncCustomerCreditBalance(
    params.customerId,
    customer.name
  );

  return {
    payment: {
      paymentId,
      amount: params.amount,
      allocations,
      creditAdded,
    },
    creditBalance: syncedBalance,
    bills: await getCustomerBillsForRecord(params.customerId, customer.name),
  };
}

/** Apply stored account advance to a bill (adds to existing paid amount) */
export async function applyCreditToNewBill(params: {
  customerId: string;
  billRef: string;
  billSource: BillSource;
  billTotal: number;
  existingPaid?: number;
}) {
  await connectDB();
  const customer = await Customer.findById(params.customerId);
  if (!customer || (customer.creditBalance || 0) <= 0) {
    return { applied: 0, creditBalance: customer?.creditBalance || 0 };
  }

  const existingPaid = params.existingPaid ?? 0;
  const roomOnBill = Math.max(0, params.billTotal - existingPaid);
  if (roomOnBill <= 0) {
    return { applied: 0, creditBalance: customer.creditBalance || 0 };
  }

  const apply = Math.min(customer.creditBalance, roomOnBill);
  customer.creditBalance = Math.max(0, customer.creditBalance - apply);
  await customer.save();

  const newPaid = existingPaid + apply;
  const pending = Math.max(0, params.billTotal - newPaid);
  const paymentStatus = getPaymentStatus(params.billTotal, newPaid);

  if (params.billSource === "Dispatch") {
    await Dispatch.findByIdAndUpdate(params.billRef, {
      advance: newPaid,
      pending,
      paymentStatus,
      creditApplied: apply,
    });
    const dispatch = await Dispatch.findById(params.billRef).lean();
    if (dispatch?.finalBillId) {
      await syncConfirmBillPayment(dispatch.finalBillId, newPaid, params.billTotal);
    }
  } else if (params.billSource === "Order") {
    await Order.findByIdAndUpdate(params.billRef, {
      paidAmount: newPaid,
      advance: newPaid,
      pending,
      paymentStatus,
    });
  }

  return { applied: apply, creditBalance: customer.creditBalance };
}

/** Update bill payment — reverses prior credit impact then recalculates */
export async function reconcileDispatchBillPayments(params: {
  customerId: string;
  billRef: string;
  billTotal: number;
  cashPaid: number;
  previousCreditAdded?: number;
  previousCreditApplied?: number;
}) {
  await connectDB();
  const customer = params.customerId ? await Customer.findById(params.customerId) : null;
  if (!customer) {
    const billPaid = Math.min(params.cashPaid, params.billTotal);
    const creditAdded = Math.max(0, params.cashPaid - params.billTotal);
    const pending = Math.max(0, params.billTotal - params.cashPaid);
    await Dispatch.findByIdAndUpdate(params.billRef, {
      $set: {
        advance: billPaid,
        pending,
        paymentStatus: getPaymentStatus(params.billTotal, billPaid),
        creditApplied: 0,
        creditAdded,
        cashPaid: params.cashPaid,
      },
    });
    return { billPaid, pending, creditApplied: 0, creditAdded, creditBalance: 0 };
  }

  customer.creditBalance =
    (customer.creditBalance || 0) -
    (params.previousCreditAdded || 0) +
    (params.previousCreditApplied || 0);

  let creditApplied = 0;
  const roomForCredit = Math.max(0, params.billTotal - params.cashPaid);
  if (roomForCredit > 0 && (customer.creditBalance || 0) > 0) {
    creditApplied = Math.min(customer.creditBalance, roomForCredit);
    customer.creditBalance = Math.max(0, customer.creditBalance - creditApplied);
  }

  const totalPaid = params.cashPaid + creditApplied;
  const billPaid = Math.min(totalPaid, params.billTotal);
  const pending = Math.max(0, params.billTotal - totalPaid);
  const creditAdded = Math.max(0, totalPaid - params.billTotal);

  if (creditAdded > 0) {
    customer.creditBalance = (customer.creditBalance || 0) + creditAdded;
  }
  await customer.save();

  await Dispatch.findByIdAndUpdate(params.billRef, {
    $set: {
      advance: billPaid,
      pending,
      paymentStatus: getPaymentStatus(params.billTotal, billPaid),
      creditApplied,
      creditAdded,
      cashPaid: params.cashPaid,
    },
  });

  return {
    billPaid,
    pending,
    creditApplied,
    creditAdded,
    creditBalance: customer.creditBalance,
  };
}

/** Single entry point — persist cash paid, advance credit, and bill payment fields */
export async function applyDispatchBillPayment(params: {
  billRef: string;
  billTotal: number;
  cashPaid: number;
  customerId?: string;
  previousCreditAdded?: number;
  previousCreditApplied?: number;
  paymentMode?: string;
}) {
  const result = await reconcileDispatchBillPayments({
    customerId: params.customerId || "",
    billRef: params.billRef,
    billTotal: params.billTotal,
    cashPaid: params.cashPaid,
    previousCreditAdded: params.previousCreditAdded,
    previousCreditApplied: params.previousCreditApplied,
  });

  if (params.paymentMode && params.cashPaid > 0) {
    await Dispatch.findByIdAndUpdate(params.billRef, {
      $set: { paymentMode: params.paymentMode },
    });
  }

  if (params.customerId) {
    const customer = await Customer.findById(params.customerId).lean();
    if (customer) {
      const synced = await syncCustomerCreditBalance(params.customerId, customer.name);
      return { ...result, creditBalance: synced };
    }
  }

  return result;
}

/** Apply account credit to bill + move overpayment into customer advance balance */
export async function finalizeNewDispatchBillPayments(params: {
  customerId: string;
  billRef: string;
  billTotal: number;
  cashPaid: number;
  paymentMode?: string;
}) {
  return applyDispatchBillPayment({
    billRef: params.billRef,
    billTotal: params.billTotal,
    cashPaid: params.cashPaid,
    customerId: params.customerId,
    paymentMode: params.paymentMode,
  });
}

export { getCustomerBillsForRecord as loadCustomerBills };
