import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Customer } from "@/lib/models";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { uploadBufferToCloudinary } from "@/lib/cloudinary";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("customers");
  if (auth instanceof Response) return auth;

  try {
    const { id } = await params;
    const formData = await request.formData();
    const file = formData.get("file");
    const label = String(formData.get("label") || "Account Document").trim();

    if (!(file instanceof File)) {
      return apiError("File required hai", 400);
    }

    await connectDB();
    const customer = await Customer.findById(id);
    if (!customer) return apiError("Customer not found", 404);

    const buffer = Buffer.from(await file.arrayBuffer());
    const uploaded = await uploadBufferToCloudinary({
      buffer,
      mimeType: file.type || "application/octet-stream",
      category: "account",
      ref: customer.customerId,
      filename: file.name,
    });

    if (!customer.documents) customer.documents = [];
    customer.documents.push({
      label,
      url: uploaded.url,
      publicId: uploaded.publicId,
      uploadedAt: new Date(),
    });
    await customer.save();

    return apiSuccess({
      document: customer.documents[customer.documents.length - 1],
      message: "Account document Cloudinary par save ho gaya",
    });
  } catch (error) {
    return apiError(error);
  }
}
