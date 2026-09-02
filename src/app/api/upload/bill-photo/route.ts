import { NextRequest } from "next/server";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { uploadBufferToCloudinary } from "@/lib/cloudinary";

/** @deprecated — use /api/upload/cloudinary or /api/dispatch/[id]/files */
export async function POST(request: NextRequest) {
  const auth = await requireAuth("dispatch");
  if (auth instanceof Response) return auth;

  try {
    const formData = await request.formData();
    const file = formData.get("photo");
    const billRef = String(formData.get("billRef") || "misc").trim();

    if (!(file instanceof File)) {
      return apiError("Photo file required hai", 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const uploaded = await uploadBufferToCloudinary({
      buffer,
      mimeType: file.type || "image/jpeg",
      category: "bill-photo",
      ref: billRef,
      filename: file.name,
    });

    return apiSuccess({
      url: uploaded.url,
      publicId: uploaded.publicId,
      message: "Photo upload ho gayi",
    });
  } catch (error) {
    return apiError(error);
  }
}
