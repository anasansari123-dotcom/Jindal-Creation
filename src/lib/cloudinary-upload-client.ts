"use client";

/** Upload any file to Cloudinary via server API */
export async function uploadToCloudinary(params: {
  file: Blob;
  filename: string;
  category:
    | "bill-photo"
    | "bill-pdf"
    | "bill-image"
    | "inventory-pdf"
    | "account"
    | "website"
    | "logo";
  ref?: string;
  mimeType?: string;
}) {
  const formData = new FormData();
  formData.append(
    "file",
    new File([params.file], params.filename, {
      type: params.mimeType || params.file.type || "application/octet-stream",
    })
  );
  formData.append("category", params.category);
  if (params.ref) formData.append("ref", params.ref);
  formData.append("filename", params.filename);

  const res = await fetch("/api/upload/cloudinary", {
    method: "POST",
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Cloudinary upload failed");
  }
  return data as { url: string; publicId: string; resourceType: string };
}

/** Upload + link file to dispatch bill record */
export async function uploadDispatchFile(params: {
  dispatchId: string;
  file: Blob;
  filename: string;
  fileType: "load-photo" | "bill-pdf" | "bill-image" | "dispatch-bill-pdf" | "dispatch-bill-image";
  mimeType?: string;
}) {
  const formData = new FormData();
  formData.append(
    "file",
    new File([params.file], params.filename, {
      type: params.mimeType || params.file.type || "application/octet-stream",
    })
  );
  formData.append("fileType", params.fileType);

  const res = await fetch(`/api/dispatch/${params.dispatchId}/files`, {
    method: "POST",
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Upload failed");
  }
  return data as { url: string; publicId: string; fileType: string };
}
