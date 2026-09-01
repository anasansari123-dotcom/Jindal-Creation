import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Dispatch, Customer, Product } from "@/lib/models";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { generateConfirmBillId } from "@/lib/generators";
import { buildDispatchItems, computeBillTotals, finalizeDispatchBill, ensureCustomerForFinalBill, applyCustomerToDispatch, linkDispatchToCustomer } from "@/lib/services/dispatch-bill";
import { enrichDispatchBill } from "@/lib/bill-pricing";
import { resolveBillPaymentMode } from "@/lib/bill-payment-mode";
import { logActivity } from "@/lib/activity";
import { ConfirmBill } from "@/lib/models/ConfirmBill";
import { dispatchBillSchema } from "@/lib/validations/dispatch";
import { applyDispatchBillPayment } from "@/lib/payment-allocation";
import { getCustomerAccountBalance } from "@/lib/bill-account-balance";
import { computeDispatchBillTotals } from "@/lib/dispatch-bill-totals";
import { normalizePaymentMode } from "@/lib/constants";

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

    const storedPaymentMode = dispatch.paymentMode;
    const paymentMode = await resolveBillPaymentMode(
      String(dispatch._id),
      dispatch.paymentMode,
      dispatch.advance
    );

    const enriched = enrichDispatchBill({
      ...dispatch,
      paymentMode,
      storedPaymentMode,
    });

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
      const updated = await Dispatch.findById(id).lean();
      return apiSuccess({
        dispatch: updated,
        message: "Final Bill pehle se complete hai — stock already deducted.",
      });
    }

    if (existing.billStatus === "FINAL" && !existing.inventoryDeducted) {
      const finalBillId = existing.finalBillId || (await generateConfirmBillId());
      await ensureCustomerForFinalBill(existing, auth.user);
      await finalizeDispatchBill(id, finalBillId, auth.user);
      const updated = await Dispatch.findById(id).lean();
      return apiSuccess({
        dispatch: updated,
        message: "Stock deduction completed for Final Bill.",
      });
    }

    if (existing.billStatus === "FINAL") {
      const updated = await Dispatch.findById(id).lean();
      return apiSuccess({
        dispatch: updated,
        message: "Final Bill pehle se complete hai.",
      });
    }

    await ensureCustomerForFinalBill(existing, auth.user);

    const finalBillId = await generateConfirmBillId();
    const dispatch = await finalizeDispatchBill(id, finalBillId, auth.user);

    await ConfirmBill.updateOne(
      { confirmBillId: finalBillId },
      {
        $set: {
          advance: dispatch.advance,
          pending: dispatch.pending,
          paymentStatus: dispatch.paymentStatus,
          customerName: dispatch.customerName,
          customerCode: dispatch.customerCode || "WALK-IN",
          total: dispatch.total,
        },
      }
    );

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
    if (dispatch.inventoryDeducted && dispatch.billStatus !== "FINAL") {
      return apiError("Stock deduct ho chuka hai — bill edit nahi ho sakti", 400);
    }

    const isFinalBill = dispatch.billStatus === "FINAL";

    const parsed = dispatchBillSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues.map((issue) => issue.message).join("; "), 400);
    }

    const previousItems = [...dispatch.items];
    let customer = null;
    if (parsed.data.customerId) {
      customer = await Customer.findById(parsed.data.customerId);
      if (!customer) return apiError("Customer not found", 404);
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
    const { discount } = computeBillTotals(subtotal, parsed.data.discount || 0);
    const cashPaid = parsed.data.advance ?? 0;
    const previousCreditAdded = dispatch.creditAdded || 0;
    const previousCreditApplied = dispatch.creditApplied || 0;

    let carriedForwardPending = dispatch.carriedForwardPending || 0;
    const customerIdStr =
      parsed.data.customerId || dispatch.customerId?.toString();
    if (!isFinalBill) {
      if (customerIdStr && parsed.data.includeCarriedForward !== false) {
        const balance = await getCustomerAccountBalance(customerIdStr);
        carriedForwardPending = balance?.pendingFromOldBills ?? 0;
      } else if (parsed.data.includeCarriedForward === false) {
        carriedForwardPending = 0;
      }
    }

    const totals = computeDispatchBillTotals({
      subtotal,
      discount,
      carriedForwardPending,
      cashPaid,
    });

    const currentBillAmount = totals.currentBillAmount;
    const billTotal = totals.total;

    if (customer) {
      applyCustomerToDispatch(dispatch, customer);
    } else {
      dispatch.customerName = parsed.data.customerName;
      dispatch.customerCode = dispatch.customerCode;
      dispatch.customerCompany = parsed.data.customerCompany;
      dispatch.customerPhone = parsed.data.customerPhone;
      dispatch.customerAddress = parsed.data.customerAddress;
      dispatch.customerCity = parsed.data.customerCity;
    }
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
    dispatch.currentBillAmount = currentBillAmount;
    dispatch.carriedForwardPending = totals.carriedForwardPending;
    dispatch.total = billTotal;
    dispatch.salespersonName =
      parsed.data.salespersonName?.trim() || dispatch.salespersonName || auth.user.name;
    dispatch.notes = parsed.data.notes;

    if (!dispatch.statusHistory) dispatch.statusHistory = [];
    dispatch.statusHistory.push({
      status: totals.pending > 0 ? "PENDING" : "COMPLETED",
      billStatus: isFinalBill ? "FINAL" : "DISPATCH",
      date: new Date(),
      note: isFinalBill
        ? "Final bill update — rates / payment revise"
        : "Dispatch bill update hui — products / customer revise",
      byName: auth.user.name,
    });

    await dispatch.save();

    await linkDispatchToCustomer(dispatch, auth.user, { createIfMissing: false });

    const linkedCustomerId = dispatch.customerId?.toString() || customer?._id?.toString();
    await applyDispatchBillPayment({
      billRef: dispatch._id.toString(),
      billTotal,
      cashPaid,
      customerId: linkedCustomerId,
      previousCreditAdded,
      previousCreditApplied,
      paymentMode:
        cashPaid > 0
          ? normalizePaymentMode(parsed.data.paymentMode || dispatch.paymentMode)
          : undefined,
    });

    await logActivity(
      auth.user,
      "Dispatch Updated",
      `Dispatch bill ${dispatch.dispatchId} updated for ${dispatch.customerName}`,
      dispatch.dispatchId,
      "order"
    );

    const fresh = await Dispatch.findById(id).lean();
    if (!fresh) return apiError("Dispatch bill not found", 404);

    const paymentMode = await resolveBillPaymentMode(
      String(fresh._id),
      fresh.paymentMode,
      fresh.advance
    );
    const enriched = enrichDispatchBill({ ...fresh, paymentMode });

    return apiSuccess({ dispatch: enriched });
  } catch (error) {
    return apiError(error);
  }
}
