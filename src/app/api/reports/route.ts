import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import {
  Dispatch,
  Customer,
  Product,
  Payment,
  InventoryTransaction,
  Order,
  ConfirmBill,
} from "@/lib/models";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { getStockStatus } from "@/lib/utils";
import { enrichDispatchesList, looseShortfallQty } from "@/lib/bill-pricing";
import { summarizeDispatchSales } from "@/lib/dispatch-sales-stats";
import { startOfDay, endOfDay } from "date-fns";
import { getCustomerPaymentStats } from "@/lib/customer-bills";
import {
  aggregatePortfolioStats,
  getBillsForCustomer,
  groupBillDocsByCustomer,
} from "@/lib/crm-financials";

export async function GET(request: NextRequest) {
  const auth = await requireAuth("reports");
  if (auth instanceof Response) return auth;

  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "sales";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const dateFilter: Record<string, Date> = {};
    if (startDate) dateFilter.$gte = startOfDay(new Date(startDate));
    if (endDate) dateFilter.$lte = endOfDay(new Date(endDate));
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    switch (type) {
      case "sales": {
        const query = hasDateFilter ? { dispatchDate: dateFilter } : {};
        const dispatches = enrichDispatchesList(await Dispatch.find(query).lean());
        const byCustomer: Record<
          string,
          { name: string; total: number; count: number }
        > = {};
        const byProduct: Record<
          string,
          { name: string; qty: number; total: number }
        > = {};
        const byAdmin: Record<
          string,
          { name: string; total: number; count: number }
        > = {};

        for (const dispatch of dispatches) {
          const code = dispatch.customerCode || dispatch.customerName;
          byCustomer[code] = byCustomer[code] || {
            name: dispatch.customerName,
            total: 0,
            count: 0,
          };
          byCustomer[code].total += dispatch.total;
          byCustomer[code].count++;

          byAdmin[dispatch.salespersonName] = byAdmin[dispatch.salespersonName] || {
            name: dispatch.salespersonName,
            total: 0,
            count: 0,
          };
          byAdmin[dispatch.salespersonName].total += dispatch.total;
          byAdmin[dispatch.salespersonName].count++;

          for (const item of dispatch.items) {
            byProduct[item.productCode] = byProduct[item.productCode] || {
              name: item.productName,
              qty: 0,
              total: 0,
            };
            byProduct[item.productCode].qty += item.pieces || item.quantity;
            byProduct[item.productCode].total += item.total;
          }
        }

        return apiSuccess({
          report: {
            totalSales: dispatches.reduce((s, d) => s + d.total, 0),
            totalOrders: dispatches.length,
            byCustomer: Object.values(byCustomer),
            byProduct: Object.values(byProduct),
            byAdmin: Object.values(byAdmin),
          },
        });
      }

      case "inventory": {
        const products = await Product.find({ status: "active" }).lean();
        const txQuery = hasDateFilter ? { createdAt: dateFilter } : {};
        const transactions = await InventoryTransaction.find(txQuery)
          .sort({ createdAt: -1 })
          .limit(100)
          .lean();

        return apiSuccess({
          report: {
            currentStock: products.map((p) => ({
              name: p.name,
              productId: p.productId,
              stock: p.currentStock,
              status: getStockStatus(p.currentStock, p.minimumStock),
            })),
            lowStock: products.filter(
              (p) =>
                getStockStatus(p.currentStock, p.minimumStock) !== "In Stock"
            ),
            movements: transactions,
          },
        });
      }

      case "customers": {
        const customers = await Customer.find().lean();
        const dispatchQuery = hasDateFilter ? { dispatchDate: dateFilter } : {};
        const dispatches = await Dispatch.find(dispatchQuery).lean();
        const activeCustomerIds = new Set(
          dispatches.map((d) => d.customerId?.toString()).filter(Boolean)
        );

        const [orders, allDispatches, confirmBills] = await Promise.all([
          Order.find().lean(),
          Dispatch.find().lean(),
          ConfirmBill.find().lean(),
        ]);
        const { ordersByCustomer, dispatchesByCustomer, confirmByCustomer } =
          groupBillDocsByCustomer(orders, allDispatches, confirmBills);

        const pendingByCustomer: Record<string, { name: string; pending: number }> =
          {};

        for (const customer of customers) {
          const cid = customer._id.toString();
          const bills = getBillsForCustomer(
            cid,
            ordersByCustomer,
            dispatchesByCustomer,
            confirmByCustomer
          );
          const stats = getCustomerPaymentStats(bills, customer.creditBalance || 0);
          if (stats.totalPending > 0) {
            pendingByCustomer[customer.customerId] = {
              name: customer.name,
              pending: stats.totalPending,
            };
          }
        }

        return apiSuccess({
          report: {
            totalCustomers: customers.length,
            activeCustomers: activeCustomerIds.size,
            pendingCustomers: Object.values(pendingByCustomer),
          },
        });
      }

      case "payments": {
        const dispatchQuery = hasDateFilter ? { dispatchDate: dateFilter } : {};
        const payments = await Payment.find(
          hasDateFilter ? { date: dateFilter } : {}
        ).lean();

        if (hasDateFilter) {
          const dispatches = enrichDispatchesList(
            await Dispatch.find(dispatchQuery).lean()
          );
          const periodStats = summarizeDispatchSales(dispatches);
          return apiSuccess({
            report: {
              scope: "period",
              totalCashPaid: periodStats.totalCashPaid,
              totalAdvance: periodStats.totalAdvanceSaved,
              totalPending: periodStats.totalPending,
              payments,
            },
          });
        }

        const [customers, orders, dispatches, confirmBills] = await Promise.all([
          Customer.find().lean(),
          Order.find().lean(),
          Dispatch.find().lean(),
          ConfirmBill.find().lean(),
        ]);
        const { ordersByCustomer, dispatchesByCustomer, confirmByCustomer } =
          groupBillDocsByCustomer(orders, dispatches, confirmBills);
        const portfolio = aggregatePortfolioStats(
          customers,
          ordersByCustomer,
          dispatchesByCustomer,
          confirmByCustomer
        );

        return apiSuccess({
          report: {
            scope: "portfolio",
            totalCashPaid: portfolio.totalPaid,
            totalAdvance: portfolio.totalAdvance,
            totalPending: portfolio.totalPending,
            payments,
          },
        });
      }

      case "oversales": {
        const txQuery: Record<string, unknown> = { soldWithoutPurchase: true };
        if (hasDateFilter) txQuery.createdAt = dateFilter;

        const transactions = await InventoryTransaction.find(txQuery)
          .sort({ createdAt: -1 })
          .limit(500)
          .lean();

        const dispatchIds = [
          ...new Set(transactions.map((t) => t.orderId).filter(Boolean)),
        ] as string[];
        const dispatches = dispatchIds.length
          ? await Dispatch.find({ dispatchId: { $in: dispatchIds } }).lean()
          : [];
        const dispatchMap = new Map(dispatches.map((d) => [d.dispatchId, d]));

        const productIds = [
          ...new Set(transactions.map((t) => t.productId.toString())),
        ];
        const productsList = productIds.length
          ? await Product.find({ _id: { $in: productIds } }).lean()
          : [];
        const productMap = new Map(productsList.map((p) => [p._id.toString(), p]));

        const items = transactions
          .map((tx) => {
            const dispatch = tx.orderId ? dispatchMap.get(tx.orderId) : undefined;
            const product = productMap.get(tx.productId.toString());
            const dispatchItem = dispatch?.items.find(
              (i) =>
                i.productId?.toString() === tx.productId.toString() ||
                i.productCode === tx.productCode
            );
            const shortfallStored = tx.shortfallQty || 0;
            const shortfallQty = dispatchItem
              ? looseShortfallQty(shortfallStored, {
                  pieces: dispatchItem.pieces,
                  boxes: dispatchItem.boxes,
                  fullBoxes: dispatchItem.fullBoxes,
                  loosePieces: dispatchItem.loosePieces,
                  piecesPerBox: product?.piecesPerBox,
                  unitPrice: dispatchItem.unitPrice,
                  sellMode: dispatchItem.sellMode,
                  quantity: dispatchItem.quantity,
                })
              : shortfallStored;
            return {
              date: tx.createdAt,
              productName: tx.productName,
              productCode: tx.productCode,
              qtySold: tx.quantity,
              shortfallQty,
              stockBefore: tx.previousStock,
              stockAfter: tx.newStock,
              billId: tx.orderId,
              customerName: dispatch?.customerName || "—",
              sellingUnit: product?.sellingUnit || "piece",
              createdByName: tx.createdByName,
              notes: tx.notes,
            };
          })
          .filter((item) => item.shortfallQty > 0);

        return apiSuccess({
          report: {
            totalEntries: items.length,
            totalShortfall: items.reduce((s, i) => s + i.shortfallQty, 0),
            items,
          },
        });
      }

      default:
        return apiError("Invalid report type", 400);
    }
  } catch (error) {
    return apiError(error);
  }
}
