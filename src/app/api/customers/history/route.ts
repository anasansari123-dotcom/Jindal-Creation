import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import {
  Customer,
  Order,
  Dispatch,
  ConfirmBill,
} from "@/lib/models";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { sanitizeSearchQuery } from "@/lib/utils";
import { getCustomerPaymentStats } from "@/lib/customer-bills";
import { getBillsForCustomer, groupBillDocsByCustomer } from "@/lib/crm-financials";

export async function GET(request: NextRequest) {
  const auth = await requireAuth("customers");
  if (auth instanceof Response) return auth;

  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";
    if (!q) return apiError("Search query required", 400);

    const sanitized = sanitizeSearchQuery(q);
    const customer = await Customer.findOne({
      $or: [
        { customerId: { $regex: sanitized, $options: "i" } },
        { name: { $regex: sanitized, $options: "i" } },
      ],
    }).lean();

    if (!customer) return apiError("Customer not found", 404);

    const [orders, dispatches, confirmBills] = await Promise.all([
      Order.find({ customerId: customer._id }).sort({ orderDate: -1 }).lean(),
      Dispatch.find({ customerId: customer._id }).sort({ dispatchDate: -1 }).lean(),
      ConfirmBill.find({ customerId: customer._id }).sort({ confirmDate: -1 }).lean(),
    ]);

    const { ordersByCustomer, dispatchesByCustomer, confirmByCustomer } =
      groupBillDocsByCustomer(orders, dispatches, confirmBills);
    const cid = customer._id.toString();
    const bills = getBillsForCustomer(
      cid,
      ordersByCustomer,
      dispatchesByCustomer,
      confirmByCustomer
    );
    const stats = getCustomerPaymentStats(bills, customer.creditBalance || 0);

    const history = bills.flatMap((bill) => {
      const sourceDispatch = dispatches.find(
        (d) => d._id.toString() === bill.refId || d.dispatchId === bill.billId
      );
      const sourceOrder = orders.find((o) => o.orderId === bill.billId);

      const items =
        sourceDispatch?.items ||
        sourceOrder?.items ||
        confirmBills.find((cb) => cb.confirmBillId === bill.billId)?.items ||
        [];

      return items.map((item) => ({
        date: bill.date,
        orderId: bill.billId,
        billType: bill.billType,
        productName: item.productName,
        productCode: item.productCode,
        quantity: item.quantity,
        pieces: item.pieces,
        boxes: item.boxes,
        unitPrice: item.unitPrice,
        total: item.total,
        advance: sourceDispatch?.advance ?? sourceOrder?.advance ?? 0,
        pending: sourceDispatch?.pending ?? sourceOrder?.pending ?? 0,
        salesperson:
          sourceDispatch?.salespersonName ?? sourceOrder?.salespersonName ?? "",
        status: bill.billType === "Final" || bill.billType === "Confirm"
          ? "COMPLETED"
          : "PENDING",
        linkPath: bill.linkPath,
      }));
    });

    return apiSuccess({
      customer,
      history: history.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      ),
      stats: {
        totalPurchase: stats.totalPurchase,
        totalAdvance: stats.totalAppliedToBills,
        totalCashPaid: stats.totalCashPaid,
        totalAppliedToBills: stats.totalAppliedToBills,
        totalPending: stats.totalPending,
        totalOrders: bills.length,
        creditBalance: stats.creditBalance,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
