import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { ConfirmBill } from "@/lib/models";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  const auth = await requireAuth("dispatch");
  if (auth instanceof Response) return auth;

  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const query: Record<string, unknown> = {};
    if (customerId) query.customerId = customerId;

    const skip = (page - 1) * limit;
    const [confirmBills, total] = await Promise.all([
      ConfirmBill.find(query).sort({ confirmDate: -1 }).skip(skip).limit(limit).lean(),
      ConfirmBill.countDocuments(query),
    ]);

    return apiSuccess({
      confirmBills,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return apiError(error);
  }
}
