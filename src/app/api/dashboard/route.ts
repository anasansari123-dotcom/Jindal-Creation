import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Dispatch, Product } from "@/lib/models";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { getStockStatus } from "@/lib/utils";
import {
  startOfDay,
  endOfDay,
  subDays,
} from "date-fns";
import {
  summarizeDispatchSales,
  buildSalesChartData,
  dispatchToSalesRow,
} from "@/lib/dispatch-sales-stats";
import { enrichDispatchesList } from "@/lib/bill-pricing";

function getDateRange(period: string, startDate?: string, endDate?: string) {
  const now = new Date();
  switch (period) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now), label: "Today" };
    case "7days":
      return {
        start: startOfDay(subDays(now, 7)),
        end: endOfDay(now),
        label: "Last 7 Days",
      };
    case "30days":
      return {
        start: startOfDay(subDays(now, 30)),
        end: endOfDay(now),
        label: "Last 30 Days",
      };
    case "custom":
      return {
        start: startDate
          ? startOfDay(new Date(startDate))
          : startOfDay(subDays(now, 30)),
        end: endDate ? endOfDay(new Date(endDate)) : endOfDay(now),
        label: "Custom Range",
      };
    default:
      return { start: startOfDay(now), end: endOfDay(now), label: "Today" };
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth("dashboard");
  if (auth instanceof Response) return auth;

  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "today";
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;

    const { start, end, label: periodLabel } = getDateRange(
      period,
      startDate,
      endDate
    );

    const dispatchStatsFields =
      "total advance pending cashPaid creditAdded creditApplied items billStatus dispatchId finalBillId customerName paymentStatus dispatchDate salespersonName";
    const dispatchListFields =
      "dispatchId finalBillId billStatus customerName total advance pending cashPaid creditAdded creditApplied paymentStatus dispatchDate salespersonName";

    const [periodDispatches, recentDispatches, products] = await Promise.all([
      Dispatch.find({ dispatchDate: { $gte: start, $lte: end } })
        .select(dispatchStatsFields)
        .lean(),
      Dispatch.find()
        .sort({ dispatchDate: -1 })
        .limit(10)
        .select(dispatchListFields)
        .lean(),
      Product.find({ status: "active" })
        .select("name productId currentStock minimumStock costPrice")
        .lean(),
    ]);

    const periodSummary = summarizeDispatchSales(enrichDispatchesList(periodDispatches));
    const enrichedRecent = enrichDispatchesList(recentDispatches);
    const enrichedPeriod = enrichDispatchesList(periodDispatches);

    const lowStockProducts = products.filter(
      (p) =>
        getStockStatus(p.currentStock, p.minimumStock) === "Low Stock" ||
        getStockStatus(p.currentStock, p.minimumStock) === "Out of Stock"
    );

    const inventoryValue = products.reduce(
      (s, p) => s + p.currentStock * p.costPrice,
      0
    );

    return apiSuccess({
      periodLabel,
      stats: {
        todaySales: periodSummary.totalSales,
        todayOrders: periodSummary.totalOrders,
        todayPieces: periodSummary.totalPieces,
        todayBoxes: periodSummary.totalBoxes,
        periodCashPaid: periodSummary.totalCashPaid,
        periodBillPending: periodSummary.totalPending,
        inventoryValue,
        lowStockCount: lowStockProducts.length,
      },
      recentOrders: enrichedRecent.map(dispatchToSalesRow),
      lowStockProducts: lowStockProducts.slice(0, 10).map((p) => ({
        ...p,
        stockStatus: getStockStatus(p.currentStock, p.minimumStock),
      })),
      chartData: buildSalesChartData(enrichedPeriod),
      periodStats: periodSummary,
    });
  } catch (error) {
    return apiError(error);
  }
}
