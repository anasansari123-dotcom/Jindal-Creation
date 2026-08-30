import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Payment } from "@/lib/models";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { paymentSchema } from "@/lib/validations";
import { applyCustomerPayment } from "@/lib/payment-allocation";
import { logActivity } from "@/lib/activity";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("customers");
  if (auth instanceof Response) return auth;

  try {
    const { id } = await params;
    await connectDB();
    const payments = await Payment.find({ customerId: id })
      .sort({ date: -1 })
      .limit(50)
      .lean();

    return apiSuccess({ payments });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("payments");
  if (auth instanceof Response) return auth;

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = paymentSchema.safeParse({ ...body, customerId: id });
    if (!parsed.success) {
      return apiError(parsed.error.issues[0].message, 400);
    }

    const result = await applyCustomerPayment({
      customerId: id,
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
      `₹${parsed.data.amount} from customer — allocated across ${result.payment.allocations.length} bill(s)${result.payment.creditAdded > 0 ? `, ₹${result.payment.creditAdded} advance credit` : ""}`,
      result.payment.paymentId,
      "payment"
    );

    return apiSuccess(result, 201);
  } catch (error) {
    console.error("[customer payment]", error);
    return apiError(error);
  }
}
