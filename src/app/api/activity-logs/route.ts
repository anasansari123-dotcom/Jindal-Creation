import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { ActivityLog } from "@/lib/models";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  const auth = await requireAuth("settings");
  if (auth instanceof Response) return auth;

  if (auth.user.role !== "MAIN_ADMIN") {
    return apiError("Only Main Admin can view activity logs", 403);
  }

  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const action = searchParams.get("action") || "";

    const query: Record<string, unknown> = {};
    if (action) query.action = action;

    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      ActivityLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ActivityLog.countDocuments(query),
    ]);

    return apiSuccess({
      logs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return apiError(error);
  }
}
