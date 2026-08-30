import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Customer, Order, Dispatch, ConfirmBill, Payment } from "@/lib/models";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { customerSchema } from "@/lib/validations";
import { logActivity } from "@/lib/activity";
import {
  buildCustomerBillLedger,
  getCustomerPaymentStats,
  customerNamesMatch,
  collectCustomerBills,
  mapOrdersForCollect,
  mapDispatchesForCollect,
  mapConfirmBillsForCollect,
  filterBillsForCustomerRecord,
} from "@/lib/customer-bills";
import { loadCustomerBillDocuments } from "@/lib/customer-bills.server";
import { enrichDispatchesPaymentModes } from "@/lib/bill-payment-mode";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("customers");
  if (auth instanceof Response) return auth;

  try {
    const { id } = await params;
    await connectDB();
    const customer = await Customer.findById(id).lean();
    if (!customer) return apiError("Customer not found", 404);

    const { orders, dispatches, confirmBills } = await loadCustomerBillDocuments(id);
    const allBills = collectCustomerBills(
      mapOrdersForCollect(orders),
      mapDispatchesForCollect(dispatches),
      mapConfirmBillsForCollect(confirmBills)
    );
    const bills = filterBillsForCustomerRecord(allBills, customer.name);

    const [payments] = await Promise.all([
      Payment.find({ customerId: id }).sort({ date: -1 }).limit(30).lean(),
    ]);

    const creditBalance = customer.creditBalance || 0;
    const paymentLedger = buildCustomerBillLedger(bills, creditBalance);
    const stats = getCustomerPaymentStats(bills, creditBalance);

    const nameMatched = (d: { customerName?: string }) =>
      customerNamesMatch(d.customerName, customer.name);

    const dispatchBills = dispatches.filter(
      (d) => d.billStatus === "DISPATCH" && nameMatched(d)
    );
    const finalBills = dispatches.filter(
      (d) => d.billStatus === "FINAL" && nameMatched(d)
    );

    const enrichedDispatches = await enrichDispatchesPaymentModes(
      dispatches.filter(nameMatched)
    );
    const enrichedDispatchBills = enrichedDispatches.filter((d) => d.billStatus === "DISPATCH");
    const enrichedFinalBills = enrichedDispatches.filter((d) => d.billStatus === "FINAL");

    return apiSuccess({
      customer: { ...customer, creditBalance },
      orders: [...orders].sort(
        (a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()
      ),
      dispatches: enrichedDispatchBills,
      finalBills: enrichedFinalBills,
      confirmBills,
      allDispatches: enrichedDispatches,
      bills,
      payments,
      paymentLedger,
      stats: {
        totalOrders: orders.length,
        totalDispatchBills: dispatchBills.length,
        totalFinalBills: finalBills.length,
        totalConfirmBills: confirmBills.length,
        ...stats,
        totalClientPaid: stats.totalCashPaid,
        totalCashPaid: stats.totalCashPaid,
        totalAppliedToBills: stats.totalAppliedToBills,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("customers");
  if (auth instanceof Response) return auth;

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = customerSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0].message, 400);
    }

    await connectDB();
    const customer = await Customer.findByIdAndUpdate(
      id,
      { ...parsed.data, email: parsed.data.email || undefined },
      { new: true }
    );
    if (!customer) return apiError("Customer not found", 404);

    await Dispatch.updateMany(
      { customerId: id },
      {
        $set: {
          customerName: customer.name,
          customerCode: customer.customerId,
          customerCompany: customer.companyName,
          customerPhone: customer.phone,
          customerAddress: customer.address,
          customerCity: customer.city,
        },
      }
    );
    await ConfirmBill.updateMany(
      { customerId: id },
      {
        $set: {
          customerName: customer.name,
          customerCode: customer.customerId,
        },
      }
    );

    await logActivity(
      auth.user,
      "Customer Updated",
      `Updated customer ${customer.name}`,
      customer.customerId,
      "customer"
    );

    return apiSuccess({ customer });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("customers");
  if (auth instanceof Response) return auth;

  try {
    const { id } = await params;
    await connectDB();
    const orderCount = await Order.countDocuments({ customerId: id });
    const dispatchCount = await Dispatch.countDocuments({ customerId: id });
    const paymentCount = await Payment.countDocuments({ customerId: id });
    const confirmCount = await ConfirmBill.countDocuments({ customerId: id });
    if (orderCount > 0 || dispatchCount > 0 || paymentCount > 0 || confirmCount > 0) {
      return apiError("Cannot delete customer with existing bills or payments", 400);
    }
    const customer = await Customer.findByIdAndDelete(id);
    if (!customer) return apiError("Customer not found", 404);
    return apiSuccess({ message: "Customer deleted" });
  } catch (error) {
    return apiError(error);
  }
}
