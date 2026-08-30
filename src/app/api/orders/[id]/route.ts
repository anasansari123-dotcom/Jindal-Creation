import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Order, Dispatch, ConfirmBill } from "@/lib/models";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { logActivity } from "@/lib/activity";
import { getPaymentStatus } from "@/lib/utils";
import type { OrderStatus } from "@/lib/constants";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("orders");
  if (auth instanceof Response) return auth;

  try {
    const { id } = await params;
    await connectDB();
    const order = await Order.findById(id).lean();
    if (!order) return apiError("Order not found", 404);

    const [dispatch, confirmBill] = await Promise.all([
      Dispatch.findOne({ orderId: id }).lean(),
      ConfirmBill.findOne({ orderId: id }).lean(),
    ]);

    return apiSuccess({ order, dispatch, confirmBill });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("orders");
  if (auth instanceof Response) return auth;

  try {
    const { id } = await params;
    const body = await request.json();
    await connectDB();

    const order = await Order.findById(id);
    if (!order) return apiError("Order not found", 404);

    if (body.status) {
      const validStatuses: OrderStatus[] = ["PENDING", "CONFIRMED", "VERIFIED", "DISPATCHED", "COMPLETED"];
      if (!validStatuses.includes(body.status)) {
        return apiError("Invalid status", 400);
      }
      order.status = body.status;
    }

    if (body.notes !== undefined) order.notes = body.notes;
    if (body.advance !== undefined) {
      const advance = Math.max(0, Number(body.advance) || 0);
      order.advance = advance;
      order.pending = Math.max(0, order.total - advance);
      order.paidAmount = advance;
      order.paymentStatus = getPaymentStatus(order.total, advance);
    }

    await order.save();

    await logActivity(
      auth.user,
      "Order Updated",
      `Updated order ${order.orderId}`,
      order.orderId,
      "order"
    );

    return apiSuccess({ order });
  } catch (error) {
    return apiError(error);
  }
}

/** Legacy POST disabled — use Dispatch → Final Bill workflow */
export async function POST(
  _request: NextRequest,
  _ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("dispatch");
  if (auth instanceof Response) return auth;

  return apiError(
    "Legacy order actions disabled. Use Create Bill → Dispatch → Final Bill workflow instead.",
    400
  );
}
