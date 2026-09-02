import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Dispatch } from "@/lib/models";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import {
  uploadBufferToCloudinary,
  deleteFromCloudinary,
  type CloudinaryUploadCategory,
} from "@/lib/cloudinary";

type DispatchFileType = "load-photo" | "bill-pdf" | "bill-image";

const FILE_TYPE_CONFIG: Record<
  DispatchFileType,
  {
    category: CloudinaryUploadCategory;
    urlField: "loadPhotoUrl" | "billPdfUrl" | "billImageUrl";
    publicIdField: "loadPhotoPublicId" | "billPdfPublicId" | "billImagePublicId";
    resourceType: "image" | "raw";
  }
> = {
  "load-photo": {
    category: "bill-photo",
    urlField: "loadPhotoUrl",
    publicIdField: "loadPhotoPublicId",
    resourceType: "image",
  },
  "bill-pdf": {
    category: "bill-pdf",
    urlField: "billPdfUrl",
    publicIdField: "billPdfPublicId",
    resourceType: "raw",
  },
  "bill-image": {
    category: "bill-image",
    urlField: "billImageUrl",
    publicIdField: "billImagePublicId",
    resourceType: "image",
  },
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("dispatch");
  if (auth instanceof Response) return auth;

  try {
    const { id } = await params;
    const formData = await request.formData();
    const file = formData.get("file");
    const fileType = String(formData.get("fileType") || "") as DispatchFileType;

    if (!(fileType in FILE_TYPE_CONFIG)) {
      return apiError("Invalid fileType — use load-photo, bill-pdf, or bill-image", 400);
    }
    if (!(file instanceof File)) {
      return apiError("File required hai", 400);
    }

    await connectDB();
    const dispatch = await Dispatch.findById(id);
    if (!dispatch) return apiError("Dispatch bill not found", 404);

    const config = FILE_TYPE_CONFIG[fileType];
    const billRef = dispatch.finalBillId || dispatch.dispatchId;
    const buffer = Buffer.from(await file.arrayBuffer());

    const uploaded = await uploadBufferToCloudinary({
      buffer,
      mimeType: file.type || (fileType === "bill-pdf" ? "application/pdf" : "image/png"),
      category: config.category,
      ref: billRef,
      filename: file.name,
    });

    const oldPublicId = dispatch[config.publicIdField];
    if (oldPublicId && oldPublicId !== uploaded.publicId) {
      await deleteFromCloudinary(oldPublicId, config.resourceType).catch(() => {});
    }

    dispatch[config.urlField] = uploaded.url;
    dispatch[config.publicIdField] = uploaded.publicId;
    await dispatch.save();

    return apiSuccess({
      url: uploaded.url,
      publicId: uploaded.publicId,
      fileType,
      message: "Cloudinary par save ho gaya",
    });
  } catch (error) {
    return apiError(error);
  }
}
