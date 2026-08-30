import { NextRequest } from "next/server";
import { getFreshSessionUser } from "@/lib/auth/load-user";
import { apiError, apiSuccess } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  try {
    const user = await getFreshSessionUser(request);
    if (!user) {
      return apiError("Not authenticated", 401);
    }
    return apiSuccess({ user });
  } catch (error) {
    return apiError(error);
  }
}
