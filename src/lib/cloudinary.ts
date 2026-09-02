import { v2 as cloudinary } from "cloudinary";

export const CLOUDINARY_BASE_FOLDER =
  process.env.CLOUDINARY_BASE_FOLDER?.replace(/\/$/, "") || "jcrm";

/** Cloudinary folder paths */
export const CLOUDINARY_FOLDERS = {
  billPhotos: `${CLOUDINARY_BASE_FOLDER}/bills/photos`,
  billPdfs: `${CLOUDINARY_BASE_FOLDER}/bills/pdf`,
  billImages: `${CLOUDINARY_BASE_FOLDER}/bills/images`,
  inventoryPdfs: `${CLOUDINARY_BASE_FOLDER}/inventory/pdf`,
  account: `${CLOUDINARY_BASE_FOLDER}/account`,
  website: `${CLOUDINARY_BASE_FOLDER}/website`,
} as const;

export type CloudinaryUploadCategory =
  | "bill-photo"
  | "bill-pdf"
  | "bill-image"
  | "inventory-pdf"
  | "account"
  | "website"
  | "logo";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_PDF_BYTES = 15 * 1024 * 1024;
const MAX_ACCOUNT_BYTES = 10 * 1024 * 1024;

const IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/gif",
]);

export function getCloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Cloudinary not configured — set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in .env.local"
    );
  }

  return { cloudName, apiKey, apiSecret };
}

export function configureCloudinary() {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
  return cloudinary;
}

function sanitizeRef(ref: string) {
  return ref.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 80);
}

function folderForCategory(category: CloudinaryUploadCategory, ref?: string) {
  const suffix = ref ? `/${sanitizeRef(ref)}` : "";
  switch (category) {
    case "bill-photo":
      return `${CLOUDINARY_FOLDERS.billPhotos}${suffix}`;
    case "bill-pdf":
      return `${CLOUDINARY_FOLDERS.billPdfs}${suffix}`;
    case "bill-image":
      return `${CLOUDINARY_FOLDERS.billImages}${suffix}`;
    case "inventory-pdf":
      return `${CLOUDINARY_FOLDERS.inventoryPdfs}${suffix}`;
    case "account":
      return `${CLOUDINARY_FOLDERS.account}${suffix}`;
    case "website":
    case "logo":
      return `${CLOUDINARY_FOLDERS.website}${suffix}`;
    default:
      return CLOUDINARY_BASE_FOLDER;
  }
}

export interface CloudinaryUploadResult {
  url: string;
  publicId: string;
  resourceType: "image" | "raw";
  bytes: number;
}

export async function uploadBufferToCloudinary(params: {
  buffer: Buffer;
  mimeType: string;
  category: CloudinaryUploadCategory;
  ref?: string;
  filename?: string;
}): Promise<CloudinaryUploadResult> {
  const { buffer, mimeType, category, ref, filename } = params;
  const isPdf =
    mimeType === "application/pdf" ||
    (filename?.toLowerCase().endsWith(".pdf") ?? false);

  if (isPdf) {
    if (buffer.length > MAX_PDF_BYTES) {
      throw new Error("PDF 15MB se chhoti honi chahiye");
    }
  } else if (!IMAGE_MIME.has(mimeType) && !mimeType.startsWith("image/")) {
    if (category === "account" && mimeType === "application/pdf") {
      /* allowed above */
    } else if (!IMAGE_MIME.has(mimeType)) {
      throw new Error("Sirf image ya PDF file upload karein");
    }
  }

  const maxBytes =
    category === "account"
      ? MAX_ACCOUNT_BYTES
      : isPdf
        ? MAX_PDF_BYTES
        : MAX_IMAGE_BYTES;

  if (buffer.length > maxBytes) {
    throw new Error(`File ${Math.round(maxBytes / (1024 * 1024))}MB se chhoti honi chahiye`);
  }

  const cld = configureCloudinary();
  const folder = folderForCategory(category, ref);
  const resourceType = isPdf ? "raw" : "image";
  const publicIdBase = filename?.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9-_]/g, "_");

  const result = await new Promise<{
    secure_url: string;
    public_id: string;
    resource_type: string;
    bytes: number;
  }>((resolve, reject) => {
    const options: Record<string, unknown> = {
      folder,
      resource_type: resourceType,
    };

    if (resourceType === "image") {
      options.transformation = [{ quality: "auto:good", fetch_format: "auto" }];
    } else if (publicIdBase) {
      options.public_id = publicIdBase;
    }

    const stream = cld.uploader.upload_stream(options, (error, uploadResult) => {
      if (error || !uploadResult) {
        reject(error ?? new Error("Cloudinary upload failed"));
        return;
      }
      resolve(
        uploadResult as {
          secure_url: string;
          public_id: string;
          resource_type: string;
          bytes: number;
        }
      );
    });
    stream.end(buffer);
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
    resourceType: resourceType as "image" | "raw",
    bytes: result.bytes,
  };
}

export async function deleteFromCloudinary(publicId: string, resourceType: "image" | "raw" = "image") {
  if (!publicId) return;
  const cld = configureCloudinary();
  await cld.uploader.destroy(publicId, { resource_type: resourceType });
}

/** @deprecated use uploadBufferToCloudinary with category bill-photo */
export async function uploadBillLoadPhoto(
  buffer: Buffer,
  mimeType: string,
  billRef: string
): Promise<{ url: string; publicId: string }> {
  const uploaded = await uploadBufferToCloudinary({
    buffer,
    mimeType,
    category: "bill-photo",
    ref: billRef,
  });
  return { url: uploaded.url, publicId: uploaded.publicId };
}

export async function deleteBillLoadPhoto(publicId: string) {
  await deleteFromCloudinary(publicId, "image");
}
