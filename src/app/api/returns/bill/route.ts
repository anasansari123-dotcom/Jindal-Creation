import { NextRequest } from "next/server";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { getReturnableBillItems } from "@/lib/services/product-return";

export async function GET(request: NextRequest) {
  const auth = await requireAuth("dispatch");
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const dispatchMongoId = searchParams.get("dispatchMongoId") || "";
    if (!dispatchMongoId) {
      return apiError("dispatchMongoId required hai", 400);
    }

    const data = await getReturnableBillItems(dispatchMongoId);
    return apiSuccess(data);
  } catch (error) {
    return apiError(error);
  }
}
