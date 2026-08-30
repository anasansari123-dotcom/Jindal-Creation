import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Customer, Order, Dispatch, ConfirmBill } from "@/lib/models";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { customerSchema } from "@/lib/validations";
import { generateCustomerId } from "@/lib/generators";
import { logActivity } from "@/lib/activity";
import { sanitizeSearchQuery } from "@/lib/utils";
import { getCustomerPaymentStats } from "@/lib/customer-bills";
import {
  aggregatePortfolioStats,
  getBillsForCustomer,
  groupBillDocsByCustomer,
} from "@/lib/crm-financials";

export async function GET(request: NextRequest) {
  const auth = await requireAuth("customers");
  if (auth instanceof Response) return auth;

  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const paymentFilter = searchParams.get("paymentFilter") || "";
    const includePortfolio = searchParams.get("includePortfolio") === "true";
    const fetchAll = searchParams.get("all") === "true";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const sort = searchParams.get("sort") || "-createdAt";

    const query: Record<string, unknown> = {};
    if (search) {
      const sanitized = sanitizeSearchQuery(search);
      query.$or = [
        { name: { $regex: sanitized, $options: "i" } },
        { customerId: { $regex: sanitized, $options: "i" } },
        { phone: { $regex: sanitized, $options: "i" } },
        { companyName: { $regex: sanitized, $options: "i" } },
      ];
    }

    const allCustomers = await Customer.find(query).sort(sort).lean();
    const customerIds = allCustomers.map((c) => c._id);

    const [orders, dispatches, confirmBills] = await Promise.all([
      Order.find({ customerId: { $in: customerIds } }).lean(),
      Dispatch.find({ customerId: { $in: customerIds } }).lean(),
      ConfirmBill.find({ customerId: { $in: customerIds } }).lean(),
    ]);

    const { ordersByCustomer, dispatchesByCustomer, confirmByCustomer } =
      groupBillDocsByCustomer(orders, dispatches, confirmBills);

    let enriched = allCustomers.map((c) => {
      const cid = c._id.toString();
      const bills = getBillsForCustomer(
        cid,
        ordersByCustomer,
        dispatchesByCustomer,
        confirmByCustomer
      );
      const stats = getCustomerPaymentStats(bills, c.creditBalance || 0);

      return {
        ...c,
        totalAdvance: stats.totalAdvance,
        totalPending: stats.totalPending,
        totalPurchase: stats.totalPurchase,
        creditBalance: stats.creditBalance,
        paymentStatus: stats.paymentStatus,
      };
    });

    if (paymentFilter === "paid") {
      enriched = enriched.filter((c) => c.paymentStatus === "Fully Paid");
    } else if (paymentFilter === "pending") {
      enriched = enriched.filter((c) => c.paymentStatus === "Pending");
    } else if (paymentFilter === "credit") {
      enriched = enriched.filter((c) => (c.creditBalance || 0) > 0);
    } else if (paymentFilter === "advance") {
      enriched = enriched.filter(
        (c) =>
          c.paymentStatus === "Fully Paid" || c.paymentStatus === "Advance"
      );
    }

    const portfolio = aggregatePortfolioStats(
      allCustomers,
      ordersByCustomer,
      dispatchesByCustomer,
      confirmByCustomer
    );

    const total = enriched.length;
    const skip = (page - 1) * limit;
    const paginated = fetchAll
      ? enriched
      : enriched.slice(skip, skip + limit);

    return apiSuccess({
      customers: paginated,
      pagination: {
        page: fetchAll ? 1 : page,
        limit: fetchAll ? total : limit,
        total,
        totalPages: fetchAll ? 1 : Math.ceil(total / limit),
      },
      ...(includePortfolio ? { portfolio } : {}),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth("customers");
  if (auth instanceof Response) return auth;

  try {
    const body = await request.json();
    const parsed = customerSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0].message, 400);
    }

    await connectDB();
    const customerId = await generateCustomerId();
    const customer = await Customer.create({
      ...parsed.data,
      customerId,
      email: parsed.data.email || undefined,
      creditBalance: 0,
    });

    await logActivity(
      auth.user,
      "Customer Created",
      `Created customer ${customer.name} (${customerId})`,
      customerId,
      "customer"
    );

    return apiSuccess({ customer }, 201);
  } catch (error) {
    return apiError(error);
  }
}
