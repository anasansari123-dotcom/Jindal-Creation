import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Product } from "@/lib/models";
import { apiError, apiSuccess } from "@/lib/api-helpers";

interface CartCheckItem {
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
    const product = await Product.findOne({ productId, status: "active" }).lean();
    if (!product) return apiError("Product not found", 404);

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
      if (item.productId !== productId) continue;
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
