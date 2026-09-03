import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { ProductReturn } from "@/lib/models";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { getReturnableBillItems } from "@/lib/services/product-return";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("dispatch");
  if (auth instanceof Response) return auth;

  try {
    const { id } = await params;
    await connectDB();
    const productReturn = await ProductReturn.findById(id).lean();
    if (!productReturn) return apiError("Return not found", 404);
    return apiSuccess({ return: productReturn });
  } catch (error) {
    return apiError(error);
  }
}
