import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Customer } from "@/lib/models";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { customerSchema } from "@/lib/validations";
import { generateCustomerId } from "@/lib/generators";
import { logActivity } from "@/lib/activity";
import { sanitizeSearchQuery } from "@/lib/utils";
import {
  enrichCustomerPage,
  loadAllEnrichedCustomers,
} from "@/lib/portfolio.server";

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
    const lite = searchParams.get("lite") === "true";
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

    const needsFullScan =
      fetchAll || includePortfolio || !!paymentFilter;

    if (lite && !needsFullScan) {
      const skip = (page - 1) * limit;
      const [customers, total] = await Promise.all([
        Customer.find(query)
          .sort(sort)
          .select("customerId name companyName phone city creditBalance createdAt")
          .skip(skip)
          .limit(limit)
          .lean(),
        Customer.countDocuments(query),
      ]);

      return apiSuccess({
        customers,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    }

    if (needsFullScan) {
      const { customers: allEnriched, portfolio } = await loadAllEnrichedCustomers();

      let enriched = search
        ? allEnriched.filter((c) => {
            const sanitized = sanitizeSearchQuery(search).toLowerCase();
            const name = String(c.name || "").toLowerCase();
            const customerId = String(c.customerId || "").toLowerCase();
            const phone = String(c.phone || "").toLowerCase();
            const companyName = String(c.companyName || "").toLowerCase();
            return (
              name.includes(sanitized) ||
              customerId.includes(sanitized) ||
              phone.includes(sanitized) ||
              companyName.includes(sanitized)
            );
          })
        : allEnriched;

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

      const total = enriched.length;
      const skip = (page - 1) * limit;
      const paginated = fetchAll ? enriched : enriched.slice(skip, skip + limit);

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
    }

    const skip = (page - 1) * limit;
    const [pageCustomers, total] = await Promise.all([
      Customer.find(query).sort(sort).skip(skip).limit(limit).lean(),
      Customer.countDocuments(query),
    ]);

    const enriched = await enrichCustomerPage(pageCustomers);

    return apiSuccess({
      customers: enriched,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
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
