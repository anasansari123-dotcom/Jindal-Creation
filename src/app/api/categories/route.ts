import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { getSetting, setSetting } from "@/lib/models/Settings";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { DEFAULT_CATEGORIES } from "@/lib/constants";
import { z } from "zod";

const categorySchema = z.object({
  name: z.string().min(1, "Category name is required").max(64),
});

export async function GET() {
  const auth = await requireAuth("products");
  if (auth instanceof Response) return auth;

  try {
    await connectDB();
    const categories = await getSetting("categories", DEFAULT_CATEGORIES);
    return apiSuccess({ categories });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth("products");
  if (auth instanceof Response) return auth;

  try {
    const body = await request.json();
    const parsed = categorySchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0].message, 400);
    }

    const name = parsed.data.name.trim();
    await connectDB();
    const categories = await getSetting("categories", DEFAULT_CATEGORIES);
    if (categories.some((c) => c.toLowerCase() === name.toLowerCase())) {
      return apiError("Category already exists", 400);
    }

    const updated = [...categories, name];
    await setSetting("categories", updated);
    return apiSuccess({ categories: updated }, 201);
  } catch (error) {
    return apiError(error);
  }
}
