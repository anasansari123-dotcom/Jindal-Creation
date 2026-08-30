import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Customer, Order, Dispatch, ConfirmBill, Payment } from "@/lib/models";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { customerSchema } from "@/lib/validations";
import { logActivity } from "@/lib/activity";
import { buildCustomerBillLedger, collectCustomerBills, getCustomerPaymentStats } from "@/lib/customer-bills";
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

    const orders = await Order.find({ customerId: id })
      .sort({ orderDate: -1 })
      .lean();

    const orderIds = orders.map((o) => o._id);
    const [dispatches, confirmBills, payments] = await Promise.all([
      Dispatch.find({
        $or: [{ customerId: id }, { orderId: { $in: orderIds } }],
      })
        .sort({ dispatchDate: -1 })
        .lean(),
      ConfirmBill.find({
        $or: [{ customerId: id }, { orderId: { $in: orderIds } }],
      })
        .sort({ confirmDate: -1 })
        .lean(),
      Payment.find({ customerId: id }).sort({ date: -1 }).limit(30).lean(),
    ]);

    const bills = collectCustomerBills(
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

    const creditBalance = customer.creditBalance || 0;
    const paymentLedger = buildCustomerBillLedger(bills, creditBalance);
    const stats = getCustomerPaymentStats(bills, creditBalance);

    const dispatchBills = dispatches.filter((d) => d.billStatus === "DISPATCH");
    const finalBills = dispatches.filter((d) => d.billStatus === "FINAL");

    const enrichedDispatches = await enrichDispatchesPaymentModes(dispatches);
    const enrichedDispatchBills = enrichedDispatches.filter((d) => d.billStatus === "DISPATCH");
    const enrichedFinalBills = enrichedDispatches.filter((d) => d.billStatus === "FINAL");

    return apiSuccess({
      customer,
      orders,
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
        totalClientPaid: stats.totalAdvance,
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
