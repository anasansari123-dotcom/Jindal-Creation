import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { ProductReturn } from "@/lib/models";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { productReturnSchema } from "@/lib/validations/return";
import { processProductReturn } from "@/lib/services/product-return";

export async function GET(request: NextRequest) {
  const auth = await requireAuth("dispatch");
  if (auth instanceof Response) return auth;

  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const dispatchId = searchParams.get("dispatchId") || "";
    const customerId = searchParams.get("customerId") || "";

    const query: Record<string, unknown> = { status: "COMPLETED" };
    if (dispatchId) query.dispatchId = dispatchId;
    if (customerId) query.customerId = customerId;

    const skip = (page - 1) * limit;
    const [returns, total] = await Promise.all([
      ProductReturn.find(query).sort({ returnDate: -1 }).skip(skip).limit(limit).lean(),
      ProductReturn.countDocuments(query),
    ]);

    return apiSuccess({
      returns,
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
    const parsed = productReturnSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0].message, 400);
    }

    const productReturn = await processProductReturn(parsed.data, auth.user);

    return apiSuccess({
      return: productReturn,
      message: `Return ${productReturn.returnId} process ho gaya — stock restore + bill update`,
    });
  } catch (error) {
    return apiError(error);
  }
}
