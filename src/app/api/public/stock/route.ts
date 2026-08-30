import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Product } from "@/lib/models";
import { getSetting } from "@/lib/models/Settings";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import { getStockStatus, sanitizeSearchQuery } from "@/lib/utils";
import { DEFAULT_WHATSAPP_NUMBER } from "@/lib/constants";
import { sortProductsForCatalog, formatProductDisplay } from "@/lib/product-display";

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";

    const query: Record<string, unknown> = { status: "active" };
    if (search) {
      const sanitized = sanitizeSearchQuery(search);
      query.$or = [
        { name: { $regex: sanitized, $options: "i" } },
        { productId: { $regex: sanitized, $options: "i" } },
      ];
    }

    const products = sortProductsForCatalog(
      await Product.find(query)
        .select("productId name category unit currentStock minimumStock piecesPerBox sellingPrice")
        .lean()
    );

    const publicProducts = products.map((p) => ({
      productId: p.productId,
      name: p.name,
      displayName: formatProductDisplay(p.name, p.productId),
      category: p.category,
      unit: p.unit,
      piecesPerBox: p.piecesPerBox || 1,
      stockStatus: getStockStatus(p.currentStock, p.minimumStock),
    }));

    const whatsappNumber =
      process.env.WHATSAPP_NUMBER ||
      (await getSetting("whatsappNumber", DEFAULT_WHATSAPP_NUMBER));

    return apiSuccess({ products: publicProducts, whatsappNumber });
  } catch (error) {
    return apiError(error);
  }
}
