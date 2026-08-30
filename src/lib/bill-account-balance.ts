import { connectDB } from "@/lib/db/connect";
import { Customer, Dispatch } from "@/lib/models";
import { getCustomerPaymentStats } from "@/lib/customer-bills";
import { getCustomerBillsForRecord } from "@/lib/customer-bills.server";
import type { CustomerBillEntry } from "@/lib/customer-bills";
import { persistBillPaymentForTransfer } from "@/lib/payment-allocation";
import type { SessionUser } from "@/lib/auth/session";

export interface CustomerAccountBalance {
  customerId: string;
  customerName: string;
  pendingFromOldBills: number;
  netAccountPending: number;
  creditBalance: number;
  availableCredit: number;
  pendingBillCount: number;
  pendingBills: Array<{
    billId: string;
    billType: string;
    pending: number;
    date: string | Date;
  }>;
}

export async function getCustomerAccountBalance(
  customerId: string
): Promise<CustomerAccountBalance | null> {
  await connectDB();
  const customer = await Customer.findById(customerId).lean();
  if (!customer) return null;

  const bills = await getCustomerBillsForRecord(customerId, customer.name);
  const pendingBills = bills.filter((b) => b.pending > 0);
  const pendingFromOldBills = pendingBills.reduce((s, b) => s + b.pending, 0);
  const stats = getCustomerPaymentStats(bills, customer.creditBalance || 0);

  return {
    customerId,
    customerName: customer.name,
    pendingFromOldBills,
    netAccountPending: stats.totalPending,
    creditBalance: customer.creditBalance || 0,
    availableCredit: stats.creditBalance,
    pendingBillCount: pendingBills.length,
    pendingBills: pendingBills.map((b) => ({
      billId: b.billId,
      billType: b.billType,
      pending: b.pending,
      date: b.date,
    })),
  };
}

/** Move old bill pending onto new dispatch bill — avoids double-counting in account */
export async function transferPendingToNewBill(params: {
  customerId: string;
  customerName: string;
  targetDispatchId: string;
  targetDispatchCode: string;
  user: SessionUser;
}): Promise<number> {
  await connectDB();
  const bills = await getCustomerBillsForRecord(params.customerId, params.customerName);
  let transferred = 0;

  for (const bill of bills) {
    if (bill.refId === params.targetDispatchId) continue;
    if (bill.pending <= 0) continue;
    const amount = bill.pending;
    transferred += amount;

    await persistBillPaymentForTransfer(
      bill,
      amount,
      params.targetDispatchCode,
      params.user.name
    );
  }

  if (transferred > 0) {
    await Dispatch.findByIdAndUpdate(params.targetDispatchId, {
      $push: {
        statusHistory: {
          status: "PENDING",
          billStatus: "DISPATCH",
          date: new Date(),
          note: `Purani pending ₹${transferred.toLocaleString("en-IN")} is bill me add hui`,
          byName: params.user.name,
        },
      },
    });
  }

  return transferred;
}
