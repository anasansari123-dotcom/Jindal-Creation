import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Product, InventoryTransaction, Dispatch } from "@/lib/models";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { productSchema } from "@/lib/validations";
import { logActivity } from "@/lib/activity";
import { stockInputToStorage } from "@/lib/product-units";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("products");
  if (auth instanceof Response) return auth;

  try {
    const { id } = await params;
    await connectDB();
    const product = await Product.findById(id).lean();
    if (!product) return apiError("Product not found", 404);
    return apiSuccess({ product });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("products");
  if (auth instanceof Response) return auth;

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = productSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0].message, 400);
    }

    await connectDB();
    const existing = await Product.findById(id);
    if (!existing) return apiError("Product not found", 404);

    const { stockUnit, currentStock: stockQty, ...productData } = parsed.data;

    let nextStock = existing.currentStock;
    if (stockQty !== undefined) {
      nextStock = stockInputToStorage(
        stockQty,
        stockUnit ?? "pieces",
        productData.piecesPerBox ?? existing.piecesPerBox,
        productData.sellingUnit ?? existing.sellingUnit
      );
    }

    const product = await Product.findByIdAndUpdate(
      id,
      {
        ...productData,
        unit: productData.sellingUnit === "kg" ? "Kg" : productData.unit,
        currentStock: nextStock,
      },
      { new: true }
    );
    if (!product) return apiError("Product not found", 404);

    if (stockQty !== undefined && nextStock !== existing.currentStock) {
      await InventoryTransaction.create({
        productId: product._id,
        productName: product.name,
        productCode: product.productId,
        type: "ADJUSTMENT",
        quantity: Math.abs(nextStock - existing.currentStock),
        pieces: nextStock,
        boxes: Math.floor(nextStock / (product.piecesPerBox || 1)),
        previousStock: existing.currentStock,
        newStock: nextStock,
        notes: "Stock updated from Create Product",
        createdBy: auth.user.id,
        createdByName: auth.user.name,
      });
    }

    await logActivity(
      auth.user,
      "Product Updated",
      `Updated product ${product.name}`,
      product.productId,
      "product"
    );

    return apiSuccess({ product });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("products");
  if (auth instanceof Response) return auth;

  try {
    const { id } = await params;
    await connectDB();
    const product = await Product.findById(id);
    if (!product) return apiError("Product not found", 404);

    const billRefs = await Dispatch.countDocuments({ "items.productId": id });
    if (billRefs > 0) {
      return apiError(
        "Product bills me use ho raha hai — delete ki jagah inactive karein.",
        400
      );
    }

    await Product.findByIdAndDelete(id);
    return apiSuccess({ message: "Product deleted" });
  } catch (error) {
    return apiError(error);
  }
}
