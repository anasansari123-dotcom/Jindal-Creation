import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { getCustomerAccountBalance } from "@/lib/bill-account-balance";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("dispatch");
  if (auth instanceof Response) return auth;

  try {
    const { id } = await params;
    const balance = await getCustomerAccountBalance(id);
    if (!balance) return apiError("Customer not found", 404);
    return apiSuccess(balance);
  } catch (error) {
    return apiError(error);
  }
}
