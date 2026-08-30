import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Dispatch, Customer, Product } from "@/lib/models";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { generateConfirmBillId } from "@/lib/generators";
import { buildDispatchItems, computeBillTotals, finalizeDispatchBill } from "@/lib/services/dispatch-bill";
import { enrichDispatchBill } from "@/lib/bill-pricing";
import { resolveBillPaymentMode } from "@/lib/bill-payment-mode";
import { getPaymentStatus } from "@/lib/utils";
import { logActivity } from "@/lib/activity";
import { ConfirmBill } from "@/lib/models/ConfirmBill";
import { dispatchBillSchema } from "@/lib/validations/dispatch";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("dispatch");
  if (auth instanceof Response) return auth;

  try {
    const { id } = await params;
    await connectDB();
    const dispatch = await Dispatch.findById(id).lean();
    if (!dispatch) return apiError("Dispatch bill not found", 404);

    const paymentMode = await resolveBillPaymentMode(
      String(dispatch._id),
      dispatch.paymentMode,
      dispatch.advance
    );

    const enriched = enrichDispatchBill({ ...dispatch, paymentMode });

    return apiSuccess({ dispatch: enriched });
  } catch (error) {
    return apiError(error);
  }
}

/** Convert dispatch bill to final bill — atomically deducts inventory */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("dispatch");
  if (auth instanceof Response) return auth;

  try {
    const { id } = await params;
    await connectDB();

    const existing = await Dispatch.findById(id);
    if (!existing) return apiError("Dispatch bill not found", 404);

    if (existing.inventoryDeducted) {
      return apiError("Stock already deducted for this bill", 400);
    }

    if (existing.billStatus === "FINAL" && !existing.inventoryDeducted) {
      const finalBillId = existing.finalBillId || (await generateConfirmBillId());
      await finalizeDispatchBill(id, finalBillId, auth.user);
      const updated = await Dispatch.findById(id).lean();
      return apiSuccess({
        dispatch: updated,
        message: "Stock deduction completed for Final Bill.",
      });
    }

    if (existing.billStatus === "FINAL") {
      return apiError("This bill is already converted to Final Bill", 400);
    }

    if (!existing.customerId) {
      return apiError(
        "Final bill ke liye customer select karein. Bill edit karke customer add karein.",
        400
      );
    }

    const finalBillId = await generateConfirmBillId();
    const dispatch = await finalizeDispatchBill(id, finalBillId, auth.user);

    const existingConfirm = await ConfirmBill.findOne({ confirmBillId: finalBillId }).lean();
    if (!existingConfirm) {
      await ConfirmBill.create({
        confirmBillId: finalBillId,
        orderId: dispatch._id,
        orderCode: dispatch.dispatchId,
        customerId: dispatch.customerId,
        customerName: dispatch.customerName,
        customerCode: dispatch.customerCode || "WALK-IN",
        items: dispatch.items,
        confirmDate: dispatch.convertedAt || new Date(),
        subtotal: dispatch.subtotal,
        discount: dispatch.discount,
        total: dispatch.total,
        advance: dispatch.advance,
        pending: dispatch.pending,
        paymentStatus: dispatch.paymentStatus,
        confirmedBy: auth.user.id,
        confirmedByName: auth.user.name,
        salespersonName: dispatch.salespersonName,
        inventoryDeducted: true,
      });
    }

    await logActivity(
      auth.user,
      "Order Completed",
      `Final bill ${finalBillId} — order complete for ${dispatch.customerName}`,
      finalBillId,
      "order"
    );

    const updated = await Dispatch.findById(id).lean();
    return apiSuccess({
      dispatch: updated,
      message: "Converted to Final Bill. Stock deducted from inventory.",
    });
  } catch (error) {
    return apiError(error);
  }
}

/** Edit dispatch bill before converting to final */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("dispatch");
  if (auth instanceof Response) return auth;

  try {
    const { id } = await params;
    const body = await request.json();
    await connectDB();

    const dispatch = await Dispatch.findById(id);
    if (!dispatch) return apiError("Dispatch bill not found", 404);
    if (dispatch.billStatus === "FINAL") {
      return apiError("Final Bill edit nahi ho sakti", 400);
    }
    if (dispatch.inventoryDeducted) {
      return apiError("Stock deduct ho chuka hai — bill edit nahi ho sakti", 400);
    }

    const parsed = dispatchBillSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0].message, 400);
    }

    const previousItems = [...dispatch.items];
    let customer = null;
    if (parsed.data.customerId) {
      customer = await Customer.findById(parsed.data.customerId);
    }

    const productIds = parsed.data.items.map((i) => i.productId);
    const products = await Product.find({ _id: { $in: productIds } }).lean();
    const dispatchItems = buildDispatchItems(
      parsed.data.items,
      products,
      previousItems,
      parsed.data.orderType === "advance"
    );

    const subtotal = dispatchItems.reduce((s, i) => s + i.total, 0);
    const { discount, total } = computeBillTotals(subtotal, parsed.data.discount || 0);
    const advance = parsed.data.advance ?? dispatch.advance ?? 0;
    const pending = Math.max(0, total - advance);

    dispatch.customerId = customer?._id ?? dispatch.customerId;
    dispatch.customerName = parsed.data.customerName;
    dispatch.customerCode = customer?.customerId ?? dispatch.customerCode;
    dispatch.customerCompany = parsed.data.customerCompany || customer?.companyName;
    dispatch.customerPhone = parsed.data.customerPhone || customer?.phone;
    dispatch.customerAddress = parsed.data.customerAddress || customer?.address;
    dispatch.customerCity = parsed.data.customerCity || customer?.city;
    dispatch.items = dispatchItems;
    dispatch.dispatchDate = parsed.data.dispatchDate
      ? new Date(parsed.data.dispatchDate)
      : dispatch.dispatchDate;
    dispatch.orderType = parsed.data.orderType || dispatch.orderType || "immediate";
    dispatch.readyByDate =
      dispatch.orderType === "advance" && parsed.data.readyByDate
        ? new Date(parsed.data.readyByDate)
        : dispatch.orderType === "immediate"
          ? undefined
          : dispatch.readyByDate;
    dispatch.subtotal = subtotal;
    dispatch.discount = discount;
    dispatch.total = total;
    dispatch.advance = advance;
    dispatch.pending = pending;
    dispatch.paymentStatus = getPaymentStatus(total, advance);
    dispatch.paymentMode = advance > 0 ? parsed.data.paymentMode || dispatch.paymentMode || "Cash" : undefined;
    dispatch.salespersonName = parsed.data.salespersonName?.trim() || dispatch.salespersonName;
    dispatch.notes = parsed.data.notes;

    if (!dispatch.statusHistory) dispatch.statusHistory = [];
    dispatch.statusHistory.push({
      status: "PENDING",
      billStatus: "DISPATCH",
      date: new Date(),
      note: "Dispatch bill update hui — products / customer / payment revise",
      byName: auth.user.name,
    });

    await dispatch.save();

    await logActivity(
      auth.user,
      "Dispatch Updated",
      `Dispatch bill ${dispatch.dispatchId} updated for ${dispatch.customerName}`,
      dispatch.dispatchId,
      "order"
    );

    const paymentMode = await resolveBillPaymentMode(
      String(dispatch._id),
      dispatch.paymentMode,
      dispatch.advance
    );
    const enriched = enrichDispatchBill({
      ...dispatch.toObject(),
      paymentMode,
    });

    return apiSuccess({ dispatch: enriched });
  } catch (error) {
    return apiError(error);
  }
}
