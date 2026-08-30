import { connectDB } from "@/lib/db/connect";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { loadAllEnrichedCustomers } from "@/lib/portfolio.server";

export async function GET() {
  const auth = await requireAuth("payments");
  if (auth instanceof Response) return auth;

  try {
    await connectDB();
    const { customers, portfolio } = await loadAllEnrichedCustomers();

    const fullyPaid = customers.filter((c) => c.paymentStatus === "Fully Paid");
    const pending = customers.filter((c) => c.paymentStatus === "Pending");
    const withAdvance = customers.filter(
      (c) =>
        (c.creditBalance || 0) > 0 ||
        (c.totalCashPaid || 0) > (c.totalPurchase || 0)
    );

    return apiSuccess({
      portfolio,
      summary: {
        paidClients: fullyPaid.length,
        paidAmount: fullyPaid.reduce((s, c) => s + (c.totalPurchase || 0), 0),
        pendingClients: pending.length,
        pendingAmount: pending.reduce((s, c) => s + (c.totalPending || 0), 0),
        creditClients: withAdvance.length,
        creditAmount: withAdvance.reduce((s, c) => s + (c.creditBalance || 0), 0),
      },
      customers,
    });
  } catch (error) {
    return apiError(error);
  }
}
