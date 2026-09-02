import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Settings } from "@/lib/models";
import { getSetting, setSetting } from "@/lib/models/Settings";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { settingsSchema } from "@/lib/validations";
import { DEFAULT_CATEGORIES, BRAND } from "@/lib/constants";

export async function GET() {
  const auth = await requireAuth("settings");
  if (auth instanceof Response) return auth;

  try {
    await connectDB();
    const whatsappNumber = await getSetting("whatsappNumber", process.env.WHATSAPP_NUMBER || "");
    const companyName = await getSetting("companyName", BRAND.name);
    const companyTagline = await getSetting("companyTagline", BRAND.tagline);
    const logoUrl = await getSetting("logoUrl", "");
    const categories = await getSetting("categories", DEFAULT_CATEGORIES);

    return apiSuccess({
      settings: { whatsappNumber, companyName, companyTagline, logoUrl, categories },
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAuth("settings");
  if (auth instanceof Response) return auth;

  if (auth.user.role !== "MAIN_ADMIN") {
    return apiError("Only Main Admin can update settings", 403);
  }

  try {
    const body = await request.json();
    const parsed = settingsSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0].message, 400);
    }

    if (parsed.data.whatsappNumber !== undefined) {
      await setSetting("whatsappNumber", parsed.data.whatsappNumber);
    }
    if (parsed.data.companyName !== undefined) {
      await setSetting("companyName", parsed.data.companyName);
    }
    if (parsed.data.companyTagline !== undefined) {
      await setSetting("companyTagline", parsed.data.companyTagline);
    }
    if (parsed.data.logoUrl !== undefined) {
      await setSetting("logoUrl", parsed.data.logoUrl || "");
    }
    if (parsed.data.categories !== undefined) {
      await setSetting("categories", parsed.data.categories);
    }

    return apiSuccess({ message: "Settings updated" });
  } catch (error) {
    return apiError(error);
  }
}

export async function GET_PUBLIC() {
  try {
    await connectDB();
    const whatsappNumber = await getSetting("whatsappNumber", process.env.WHATSAPP_NUMBER || "");
    return { whatsappNumber };
  } catch {
    return { whatsappNumber: process.env.WHATSAPP_NUMBER || "" };
  }
}
