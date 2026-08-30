import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Dispatch, Product, Customer, Order, ConfirmBill } from "@/lib/models";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { getStockStatus } from "@/lib/utils";
import {
  aggregatePortfolioStats,
  groupBillDocsByCustomer,
} from "@/lib/crm-financials";
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

    const [periodDispatches, recentDispatches, products, customers, orders, dispatches, confirmBills] =
      await Promise.all([
        Dispatch.find({ dispatchDate: { $gte: start, $lte: end } }).lean(),
        Dispatch.find().sort({ dispatchDate: -1 }).limit(10).lean(),
        Product.find({ status: "active" }).lean(),
        Customer.find().lean(),
        Order.find().lean(),
        Dispatch.find().lean(),
        ConfirmBill.find().lean(),
      ]);

    const periodSummary = summarizeDispatchSales(enrichDispatchesList(periodDispatches));
    const enrichedRecent = enrichDispatchesList(recentDispatches);
    const enrichedPeriod = enrichDispatchesList(periodDispatches);
    const { ordersByCustomer, dispatchesByCustomer, confirmByCustomer } =
      groupBillDocsByCustomer(orders, dispatches, confirmBills);
    const portfolio = aggregatePortfolioStats(
      customers,
      ordersByCustomer,
      dispatchesByCustomer,
      confirmByCustomer
    );

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
        todayAdvance: portfolio.totalAdvance,
        todayPending: portfolio.totalPending,
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
      portfolio,
    });
  } catch (error) {
    return apiError(error);
  }
}
