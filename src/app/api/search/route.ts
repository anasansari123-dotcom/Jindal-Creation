import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Customer, Product, Dispatch } from "@/lib/models";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { sanitizeSearchQuery } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const auth = await requireAuth("dashboard");
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";
    if (!q || q.length < 2) {
      return apiSuccess({ results: [] });
    }

    await connectDB();
    const sanitized = sanitizeSearchQuery(q);

    const [customers, products, dispatches] = await Promise.all([
      Customer.find({
        $or: [
          { name: { $regex: sanitized, $options: "i" } },
          { customerId: { $regex: sanitized, $options: "i" } },
          { phone: { $regex: sanitized, $options: "i" } },
        ],
      })
        .limit(5)
        .lean(),
      Product.find({
        $or: [
          { name: { $regex: sanitized, $options: "i" } },
          { productId: { $regex: sanitized, $options: "i" } },
        ],
      })
        .limit(5)
        .lean(),
      Dispatch.find({
        $or: [
          { dispatchId: { $regex: sanitized, $options: "i" } },
          { finalBillId: { $regex: sanitized, $options: "i" } },
          { customerName: { $regex: sanitized, $options: "i" } },
        ],
      })
        .limit(5)
        .lean(),
    ]);

    const results = [
      ...customers.map((c) => ({
        type: "customer" as const,
        id: c._id.toString(),
        label: c.name,
        sublabel: c.customerId,
        href: `/admin/customers/${c._id}`,
      })),
      ...products.map((p) => ({
        type: "product" as const,
        id: p._id.toString(),
        label: p.name,
        sublabel: p.productId,
        href: `/admin/products`,
      })),
      ...dispatches.map((d) => ({
        type: "order" as const,
        id: d._id.toString(),
        label:
          d.billStatus === "FINAL" && d.finalBillId ? d.finalBillId : d.dispatchId,
        sublabel: d.customerName,
        href: `/admin/dispatch/${d._id.toString()}`,
      })),
    ];

    return apiSuccess({ results });
  } catch (error) {
    return apiError(error);
  }
}
