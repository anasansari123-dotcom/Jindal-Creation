import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Payment, Order, Customer } from "@/lib/models";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { paymentSchema } from "@/lib/validations";
import { generatePaymentId } from "@/lib/generators";
import { logActivity } from "@/lib/activity";
import { getPaymentStatus } from "@/lib/utils";
import { applyCustomerPayment } from "@/lib/payment-allocation";

export async function GET(request: NextRequest) {
  const auth = await requireAuth("payments");
  if (auth instanceof Response) return auth;

  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("orderId");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const query: Record<string, unknown> = {};
    if (orderId) query.orderId = orderId;

    const skip = (page - 1) * limit;
    const [payments, total] = await Promise.all([
      Payment.find(query).sort({ date: -1 }).skip(skip).limit(limit).lean(),
      Payment.countDocuments(query),
    ]);

    return apiSuccess({
      payments,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth("payments");
  if (auth instanceof Response) return auth;

  try {
    const body = await request.json();
    const parsed = paymentSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0].message, 400);
    }

    await connectDB();

    if (parsed.data.customerId) {
      const result = await applyCustomerPayment({
        customerId: parsed.data.customerId,
        amount: parsed.data.amount,
        method: parsed.data.method,
        date: parsed.data.date ? new Date(parsed.data.date) : new Date(),
        referenceNumber: parsed.data.referenceNumber,
        notes: parsed.data.notes,
        user: auth.user,
      });

      await logActivity(
        auth.user,
        "Customer Payment",
        `₹${parsed.data.amount} allocated across bills for customer`,
        result.payment.paymentId,
        "payment"
      );

      return apiSuccess(result, 201);
    }

    if (!parsed.data.orderId) {
      return apiError("Order or customer is required", 400);
    }

    const order = await Order.findById(parsed.data.orderId);
    if (!order) return apiError("Order not found", 404);

    const paymentId = await generatePaymentId();
    const payment = await Payment.create({
      paymentId,
      orderId: order._id,
      orderCode: order.orderId,
      customerId: order.customerId,
      customerName: order.customerName,
      amount: parsed.data.amount,
      date: parsed.data.date ? new Date(parsed.data.date) : new Date(),
      method: parsed.data.method,
      referenceNumber: parsed.data.referenceNumber,
      addedBy: auth.user.id,
      addedByName: auth.user.name,
      notes: parsed.data.notes,
    });

    order.paidAmount = (order.paidAmount || 0) + parsed.data.amount;
    order.advance = order.paidAmount;
    order.pending = Math.max(0, order.total - order.paidAmount);
    order.paymentStatus = getPaymentStatus(order.total, order.paidAmount);
    await order.save();

    await logActivity(
      auth.user,
      "Payment Added",
      `Payment of ₹${parsed.data.amount} for order ${order.orderId}`,
      paymentId,
      "payment"
    );

    return apiSuccess({ payment, order }, 201);
  } catch (error) {
    return apiError(error);
  }
}
