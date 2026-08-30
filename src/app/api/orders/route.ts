import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Dispatch } from "@/lib/models";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { sanitizeSearchQuery } from "@/lib/utils";
import {
  dispatchToOrderEntry,
  groupOrdersByDay,
  periodRange,
  summarizeDispatchesLean,
  type OrderPeriod,
} from "@/lib/dispatch-orders";

function buildBaseQuery(search: string, status: string) {
  const query: Record<string, unknown> = {};

  if (search) {
    const sanitized = sanitizeSearchQuery(search);
    query.$or = [
      { dispatchId: { $regex: sanitized, $options: "i" } },
      { finalBillId: { $regex: sanitized, $options: "i" } },
      { customerName: { $regex: sanitized, $options: "i" } },
      { customerCode: { $regex: sanitized, $options: "i" } },
    ];
  }

  if (status === "PENDING") query.billStatus = "DISPATCH";
  if (status === "COMPLETED") query.billStatus = "FINAL";

  return query;
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth("orders");
  if (auth instanceof Response) return auth;

  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const period = (searchParams.get("period") || "today") as OrderPeriod;
    const customDate = searchParams.get("date") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const { start, end, label: periodLabel } = periodRange(period, customDate || undefined);
    const query = {
      ...buildBaseQuery(search, status),
      dispatchDate: { $gte: start, $lte: end },
    };

    const skip = (page - 1) * limit;

    const [allInPeriodLean, dispatches, total] = await Promise.all([
      Dispatch.find(query).select("billStatus total").lean(),
      Dispatch.find(query).sort({ dispatchDate: -1 }).skip(skip).limit(limit).lean(),
      Dispatch.countDocuments(query),
    ]);

    const summary = summarizeDispatchesLean(
      allInPeriodLean as Array<{ billStatus: "DISPATCH" | "FINAL"; total: number }>
    );
    const orders = dispatches.map((d) => dispatchToOrderEntry(d));

    let dailyGroups: ReturnType<typeof groupOrdersByDay> = [];
    if (period === "week" || period === "month") {
      const allFull = await Dispatch.find(query).sort({ dispatchDate: -1 }).lean();
      dailyGroups = groupOrdersByDay(allFull.map((d) => dispatchToOrderEntry(d)));
    }

    return apiSuccess({
      orders,
      dailyGroups,
      summary,
      periodLabel,
      period,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      meta: {
        source: "dispatch",
        dateRange: { start: start.toISOString(), end: end.toISOString() },
        statusMap: {
          PENDING: "Dispatch Bill (pending)",
          COMPLETED: "Final Bill (complete)",
        },
      },
    });
  } catch (error) {
    return apiError(error);
  }
}

/** Legacy order create — redirect users to Create Bill instead */
export async function POST() {
  return apiError(
    "Orders ab Dispatch Bill se banate hain. Admin → Create Bill use karein.",
    400
  );
}
