import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Dispatch } from "@/lib/models";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import {
  startOfDay,
  endOfDay,
  subDays,
  startOfWeek,
  startOfMonth,
} from "date-fns";
import {
  summarizeDispatchSales,
  dispatchToSalesRow,
} from "@/lib/dispatch-sales-stats";
import { enrichDispatchesList } from "@/lib/bill-pricing";

function getDateRange(filter: string, startDate?: string, endDate?: string) {
  const now = new Date();
  switch (filter) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "yesterday": {
      const y = subDays(now, 1);
      return { start: startOfDay(y), end: endOfDay(y) };
    }
    case "week":
      return { start: startOfWeek(now), end: endOfDay(now) };
    case "month":
      return { start: startOfMonth(now), end: endOfDay(now) };
    case "custom":
      return {
        start: startDate ? startOfDay(new Date(startDate)) : startOfMonth(now),
        end: endDate ? endOfDay(new Date(endDate)) : endOfDay(now),
      };
    default:
      return { start: startOfDay(now), end: endOfDay(now) };
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth("sales");
  if (auth instanceof Response) return auth;

  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter") || "today";
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const { start, end } = getDateRange(filter, startDate, endDate);
    const query = { dispatchDate: { $gte: start, $lte: end } };

    const skip = (page - 1) * limit;
    const [statsDispatches, paginatedDispatches, total] = await Promise.all([
      Dispatch.find(query)
        .select("total advance pending cashPaid creditAdded creditApplied items billStatus dispatchId finalBillId customerName paymentStatus dispatchDate salespersonName")
        .lean(),
      Dispatch.find(query).sort({ dispatchDate: -1 }).skip(skip).limit(limit).lean(),
      Dispatch.countDocuments(query),
    ]);

    const stats = summarizeDispatchSales(enrichDispatchesList(statsDispatches));
    const orders = enrichDispatchesList(paginatedDispatches).map(dispatchToSalesRow);

    return apiSuccess({
      orders,
      stats,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return apiError(error);
  }
}
