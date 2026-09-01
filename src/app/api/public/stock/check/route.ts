import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Product } from "@/lib/models";
import { apiError, apiSuccess } from "@/lib/api-helpers";

interface CartCheckItem {
  id?: string;
  productId: string;
  unitType: "pieces" | "boxes";
  quantity: number;
}

function toPieces(
  unitType: "pieces" | "boxes",
  quantity: number,
  piecesPerBox: number
): number {
  return unitType === "boxes" ? quantity * piecesPerBox : quantity;
}

async function resolveActiveProduct(body: {
  id?: string;
  category?: string;
  productId?: string;
}) {
  const mongoId = body.id?.trim();
  const productId = body.productId?.trim();
  const category = body.category?.trim();

  if (mongoId) {
    return Product.findOne({ _id: mongoId, status: "active" }).lean();
  }

  if (category && productId) {
    return Product.findOne({ category, productId, status: "active" }).lean();
  }

  if (!productId) return null;

  const matches = await Product.find({ productId, status: "active" }).lean();
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    throw new Error(
      "MULTIPLE_SKU: Ye product number multiple categories me hai. Product dubara select karein."
    );
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const productId = body.productId as string;
    const unitType = body.unitType as "pieces" | "boxes";
    const quantity = Number(body.quantity);
    const cartItems = (body.cartItems || []) as CartCheckItem[];

    if (!productId || !unitType || !quantity || quantity < 1) {
      return apiError("Invalid product or quantity", 400);
    }

    await connectDB();
    let product;
    try {
      product = await resolveActiveProduct({
        id: body.id as string | undefined,
        category: body.category as string | undefined,
        productId,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Product not found";
      if (message.startsWith("MULTIPLE_SKU:")) {
        return apiError(message.replace("MULTIPLE_SKU: ", ""), 400);
      }
      throw err;
    }

    if (!product) return apiError("Product not found", 404);

    const resolvedId = String(product._id);
    const piecesPerBox = product.piecesPerBox || 1;
    const currentStock = product.currentStock;

    if (currentStock <= 0) {
      return apiSuccess({
        available: false,
        message: "Yeh product abhi available nahi hai (Out of Stock).",
      });
    }

    let totalPiecesNeeded = toPieces(unitType, quantity, piecesPerBox);

    for (const item of cartItems) {
      const sameLine =
        (item.id && item.id === resolvedId) ||
        (!item.id && item.productId === product.productId);
      if (!sameLine) continue;
      totalPiecesNeeded += toPieces(item.unitType, item.quantity, piecesPerBox);
    }

    if (totalPiecesNeeded > currentStock) {
      return apiSuccess({
        available: false,
        message:
          "Aapki maangi hui quantity available nahi hai. Kam quantity try karein ya WhatsApp button par click karein.",
      });
    }

    return apiSuccess({
      available: true,
      message: "Product order list me add ho gaya!",
    });
  } catch (error) {
    return apiError(error);
  }
}
