import type { Types } from "mongoose";
import { Customer } from "@/lib/models";
import {
  filterBillsForCustomerRecord,
  getCustomerPaymentStats,
} from "@/lib/customer-bills";
import { loadCustomerBillDocumentsBatch } from "@/lib/customer-bills.server";
import {
  aggregatePortfolioStats,
  getBillsForCustomer,
  groupBillDocsByCustomer,
  type PortfolioStats,
} from "@/lib/crm-financials";

type CustomerRecord = {
  _id: Types.ObjectId;
  name: string;
  creditBalance?: number;
  customerId?: string;
  phone?: string;
  companyName?: string;
};

export function enrichCustomersWithPaymentStats(customers: CustomerRecord[]) {
  const customerIds = customers.map((c) => c._id);
  return loadCustomerBillDocumentsBatch(customerIds).then(
    ({ orders, dispatches, confirmBills }) => {
      const { ordersByCustomer, dispatchesByCustomer, confirmByCustomer } =
        groupBillDocsByCustomer(orders, dispatches, confirmBills);

      return customers.map((c) => {
        const cid = c._id.toString();
        const allBills = getBillsForCustomer(
          cid,
          ordersByCustomer,
          dispatchesByCustomer,
          confirmByCustomer
        );
        const bills = filterBillsForCustomerRecord(allBills, c.name);
        const stats = getCustomerPaymentStats(bills, c.creditBalance || 0);

        return {
          ...c,
          totalAdvance: stats.totalAppliedToBills,
          totalCashPaid: stats.totalCashPaid,
          totalAppliedToBills: stats.totalAppliedToBills,
          totalPending: stats.totalPending,
          totalPurchase: stats.totalPurchase,
          creditBalance: stats.creditBalance,
          paymentStatus: stats.paymentStatus,
        };
      });
    }
  );
}

export async function loadPortfolioStats(): Promise<PortfolioStats> {
  const allCustomers = await Customer.find().lean();
  const customerIds = allCustomers.map((c) => c._id);
  const { orders, dispatches, confirmBills } =
    await loadCustomerBillDocumentsBatch(customerIds);
  const { ordersByCustomer, dispatchesByCustomer, confirmByCustomer } =
    groupBillDocsByCustomer(orders, dispatches, confirmBills);

  return aggregatePortfolioStats(
    allCustomers,
    ordersByCustomer,
    dispatchesByCustomer,
    confirmByCustomer
  );
}

export async function loadAllEnrichedCustomers() {
  const allCustomers = await Customer.find().sort({ createdAt: -1 }).lean();
  const customerIds = allCustomers.map((c) => c._id);
  const { orders, dispatches, confirmBills } =
    await loadCustomerBillDocumentsBatch(customerIds);
  const grouped = groupBillDocsByCustomer(orders, dispatches, confirmBills);

  const customers = allCustomers.map((c) => {
    const cid = c._id.toString();
    const allBills = getBillsForCustomer(
      cid,
      grouped.ordersByCustomer,
      grouped.dispatchesByCustomer,
      grouped.confirmByCustomer
    );
    const bills = filterBillsForCustomerRecord(allBills, c.name);
    const stats = getCustomerPaymentStats(bills, c.creditBalance || 0);

    return {
      ...c,
      totalAdvance: stats.totalAppliedToBills,
      totalCashPaid: stats.totalCashPaid,
      totalAppliedToBills: stats.totalAppliedToBills,
      totalPending: stats.totalPending,
      totalPurchase: stats.totalPurchase,
      creditBalance: stats.creditBalance,
      paymentStatus: stats.paymentStatus,
    };
  });

  return {
    customers,
    portfolio: aggregatePortfolioStats(
      allCustomers,
      grouped.ordersByCustomer,
      grouped.dispatchesByCustomer,
      grouped.confirmByCustomer
    ),
  };
}

export async function enrichCustomerPage(customers: CustomerRecord[]) {
  if (customers.length === 0) return [];
  return enrichCustomersWithPaymentStats(customers);
}
