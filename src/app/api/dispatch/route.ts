import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Dispatch, Customer, Product } from "@/lib/models";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { dispatchBillSchema } from "@/lib/validations/dispatch";
import { generateDispatchId } from "@/lib/generators";
import { buildDispatchItems, computeBillTotals } from "@/lib/services/dispatch-bill";
import { enrichDispatchBill } from "@/lib/bill-pricing";
import { logActivity } from "@/lib/activity";
import { getPaymentStatus } from "@/lib/utils";
import { enrichDispatchesPaymentModes, resolveBillPaymentMode } from "@/lib/bill-payment-mode";
import { applyCreditToNewBill } from "@/lib/payment-allocation";

export async function GET(request: NextRequest) {
  const auth = await requireAuth("dispatch");
  if (auth instanceof Response) return auth;

  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "";
    const customerId = searchParams.get("customerId") || "";
    const pendingOnly = searchParams.get("pendingOnly") === "true";
    const dispatchIdSearch = searchParams.get("dispatchId") || "";
    const orderType = searchParams.get("orderType") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const query: Record<string, unknown> = {};
    if (status) query.billStatus = status;
    if (orderType) query.orderType = orderType;
    if (customerId) query.customerId = customerId;
    if (pendingOnly) {
      query.billStatus = "DISPATCH";
      query.inventoryDeducted = false;
    }
    if (dispatchIdSearch) query.dispatchId = dispatchIdSearch;

    const skip = (page - 1) * limit;
    const [rawDispatches, total] = await Promise.all([
      Dispatch.find(query).sort({ readyByDate: 1, dispatchDate: -1 }).skip(skip).limit(limit).lean(),
      Dispatch.countDocuments(query),
    ]);

    const dispatches = await enrichDispatchesPaymentModes(rawDispatches);

    return apiSuccess({
      dispatches,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth("dispatch");
  if (auth instanceof Response) return auth;

  try {
    const body = await request.json();
    const parsed = dispatchBillSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0].message, 400);
    }

    await connectDB();

    let customer = null;
    if (parsed.data.customerId) {
      customer = await Customer.findById(parsed.data.customerId);
    }

    const productIds = parsed.data.items.map((i) => i.productId);
    const products = await Product.find({ _id: { $in: productIds } }).lean();
    const dispatchItems = buildDispatchItems(
      parsed.data.items,
      products,
      undefined,
      parsed.data.orderType === "advance"
    );
    if (dispatchItems.length === 0) {
      return apiError("Add at least one product with quantity", 400);
    }

    const subtotal = dispatchItems.reduce((s, i) => s + i.total, 0);
    const { discount, total } = computeBillTotals(subtotal, parsed.data.discount || 0);
    const advance = parsed.data.advance || 0;
    const pending = Math.max(0, total - advance);

    const dispatchId = await generateDispatchId();
    const dispatchDate = parsed.data.dispatchDate
      ? new Date(parsed.data.dispatchDate)
      : new Date();
    const readyByDate =
      parsed.data.orderType === "advance" && parsed.data.readyByDate
        ? new Date(parsed.data.readyByDate)
        : undefined;
    const salespersonName = parsed.data.salespersonName?.trim() || auth.user.name;
    const orderType = parsed.data.orderType || "immediate";

    const dispatch = await Dispatch.create({
      dispatchId,
      billStatus: "DISPATCH",
      orderType,
      readyByDate,
      customerId: customer?._id,
      customerName: parsed.data.customerName,
      customerCode: customer?.customerId,
      customerCompany: parsed.data.customerCompany || customer?.companyName,
      customerPhone: parsed.data.customerPhone || customer?.phone,
      customerAddress: parsed.data.customerAddress || customer?.address,
      customerCity: parsed.data.customerCity || customer?.city,
      items: dispatchItems,
      dispatchDate,
      subtotal,
      discount,
      total,
      advance,
      pending,
      paymentStatus: getPaymentStatus(total, advance),
      paymentMode: advance > 0 ? parsed.data.paymentMode || "Cash" : undefined,
      inventoryDeducted: false,
      verifiedBy: auth.user.id,
      verifiedByName: auth.user.name,
      salespersonName,
      notes: parsed.data.notes,
      statusHistory: [
        {
          status: "PENDING",
          billStatus: "DISPATCH",
          date: dispatchDate,
          note:
            orderType === "advance" && readyByDate
              ? `Advance order — maal ready by ${readyByDate.toLocaleDateString("en-IN")}, advance ₹${advance}`
              : "Dispatch bill create hui — order pending me",
          byName: salespersonName,
        },
      ],
    });

    await logActivity(
      auth.user,
      orderType === "advance" ? "Advance Order" : "Order Pending",
      orderType === "advance"
        ? `Advance order ${dispatchId} — ready by ${readyByDate?.toLocaleDateString("en-IN")}, advance ₹${advance}`
        : `Dispatch bill ${dispatchId} created — order pending for ${parsed.data.customerName}`,
      dispatchId,
      "order"
    );

    if (customer?._id && pending > 0) {
      await applyCreditToNewBill({
        customerId: customer._id.toString(),
        billRef: dispatch._id.toString(),
        billSource: "Dispatch",
        billTotal: total,
        existingPaid: advance,
      });
      const updated = await Dispatch.findById(dispatch._id).lean();
      const paymentMode = await resolveBillPaymentMode(
        String(dispatch._id),
        updated?.paymentMode ?? dispatch.paymentMode,
        updated?.advance ?? dispatch.advance
      );
      const enriched = enrichDispatchBill({ ...(updated || dispatch.toObject()), paymentMode });
      return apiSuccess({ dispatch: enriched }, 201);
    }

    const paymentMode = await resolveBillPaymentMode(
      String(dispatch._id),
      dispatch.paymentMode,
      dispatch.advance
    );
    const enriched = enrichDispatchBill({ ...dispatch.toObject(), paymentMode });
    return apiSuccess({ dispatch: enriched }, 201);
  } catch (error) {
    return apiError(error);
  }
}
