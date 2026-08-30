import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { Customer, Order, Dispatch, ConfirmBill, Payment } from "@/lib/models";
import type { IPaymentAllocation } from "@/lib/models/Payment";
import { generatePaymentId } from "@/lib/generators";
import { getPaymentStatus } from "@/lib/utils";
import { collectCustomerBills, type CustomerBillEntry, type BillSource } from "@/lib/customer-bills";
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

async function loadCustomerBills(customerId: string) {
  const orders = await Order.find({ customerId }).sort({ orderDate: 1 }).lean();
  const orderIds = orders.map((o) => o._id);
  const [dispatches, confirmBills] = await Promise.all([
    Dispatch.find({
      $or: [{ customerId }, { orderId: { $in: orderIds } }],
    })
      .sort({ dispatchDate: 1 })
      .lean(),
    ConfirmBill.find({
      $or: [{ customerId }, { orderId: { $in: orderIds } }],
    })
      .sort({ confirmDate: 1 })
      .lean(),
  ]);

  return collectCustomerBills(
    orders.map((o) => ({
      _id: o._id,
      orderId: o.orderId,
      orderDate: o.orderDate,
      total: o.total,
      advance: o.advance,
      pending: o.pending,
      paidAmount: o.paidAmount,
      paymentStatus: o.paymentStatus,
    })),
    dispatches.map((d) => ({
      _id: d._id,
      dispatchId: d.dispatchId,
      finalBillId: d.finalBillId,
      billStatus: d.billStatus,
      orderId: d.orderId,
      dispatchDate: d.dispatchDate,
      total: d.total,
      advance: d.advance,
      pending: d.pending,
      paymentStatus: d.paymentStatus,
    })),
    confirmBills.map((cb) => ({
      _id: cb._id,
      confirmBillId: cb.confirmBillId,
      orderId: cb.orderId,
      confirmDate: cb.confirmDate,
      total: cb.total,
      advance: cb.advance,
      pending: cb.pending,
      paymentStatus: cb.paymentStatus,
    }))
  );
}

async function persistBillPayment(
  bill: CustomerBillEntry,
  newPaid: number
) {
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
  } else if (bill.billSource === "ConfirmBill") {
    await ConfirmBill.findByIdAndUpdate(bill.refId, {
      advance: newPaid,
      pending,
      paymentStatus,
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

  const bills = await loadCustomerBills(params.customerId);
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
  const primaryBill = allocations[0];

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
  if (primaryBill) {
    paymentDoc.orderId = primaryBill.billRef;
    paymentDoc.orderCode = primaryBill.billCode;
  }

  await Payment.create(paymentDoc);

  const updatedCustomer = await Customer.findById(params.customerId).lean();

  return {
    payment: {
      paymentId,
      amount: params.amount,
      allocations,
      creditAdded,
    },
    creditBalance: updatedCustomer?.creditBalance || 0,
    bills: await loadCustomerBills(params.customerId),
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
    });
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

export { loadCustomerBills };
