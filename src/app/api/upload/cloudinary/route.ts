import { NextRequest } from "next/server";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { hasPermission } from "@/lib/auth/session";
import type { Permission } from "@/lib/constants";
import type { SessionUser } from "@/lib/auth/session";
import {
  uploadBufferToCloudinary,
  type CloudinaryUploadCategory,
} from "@/lib/cloudinary";

const CATEGORY_PERMISSION: Record<CloudinaryUploadCategory, Permission> = {
  "bill-photo": "dispatch",
  "bill-pdf": "dispatch",
  "bill-image": "dispatch",
  "inventory-pdf": "inventory",
  account: "customers",
  website: "settings",
  logo: "settings",
};

function canUpload(category: CloudinaryUploadCategory, user: SessionUser) {
  return hasPermission(user, CATEGORY_PERMISSION[category]);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const category = String(formData.get("category") || "website") as CloudinaryUploadCategory;
    const ref = String(formData.get("ref") || "").trim() || undefined;
    const filename = String(formData.get("filename") || "").trim() || undefined;

    const validCategories: CloudinaryUploadCategory[] = [
      "bill-photo",
      "bill-pdf",
      "bill-image",
      "inventory-pdf",
      "account",
      "website",
      "logo",
    ];
    if (!validCategories.includes(category)) {
      return apiError("Invalid upload category", 400);
    }

    if (!canUpload(category, auth.user)) {
      return apiError("Forbidden", 403);
    }

    if (!(file instanceof File)) {
      return apiError("File required hai", 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const uploaded = await uploadBufferToCloudinary({
      buffer,
      mimeType: file.type || "application/octet-stream",
      category,
      ref,
      filename: filename || file.name,
    });

    return apiSuccess({
      url: uploaded.url,
      publicId: uploaded.publicId,
      resourceType: uploaded.resourceType,
      bytes: uploaded.bytes,
      message: "Cloudinary par upload ho gaya",
    });
  } catch (error) {
    return apiError(error);
  }
}
