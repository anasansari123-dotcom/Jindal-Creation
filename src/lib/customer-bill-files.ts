import type { Types } from "mongoose";
import { Customer } from "@/lib/models";
import { customerNamesMatch } from "@/lib/customer-bills";
import { getDisplayBillId } from "@/lib/bill-display";

export type CustomerBillFileType =
  | "bill-pdf"
  | "bill-image"
  | "load-photo"
  | "dispatch-bill-pdf"
  | "dispatch-bill-image";

export interface CustomerBillFileEntry {
  type: CustomerBillFileType;
  label: string;
  url: string;
  publicId?: string;
}

export interface CustomerBillArchive {
  billId: string;
  displayBillId: string;
  billStatus: "DISPATCH" | "FINAL";
  dispatchMongoId: string;
  dispatchDate: string;
  total: number;
  files: CustomerBillFileEntry[];
}

type DispatchArchiveSource = {
  _id: Types.ObjectId | string;
  dispatchId: string;
  finalBillId?: string;
  billStatus: "DISPATCH" | "FINAL";
  dispatchDate: Date | string;
  customerName?: string;
  total?: number;
  billPdfUrl?: string;
  billPdfPublicId?: string;
  billImageUrl?: string;
  billImagePublicId?: string;
  dispatchBillPdfUrl?: string;
  dispatchBillPdfPublicId?: string;
  dispatchBillImageUrl?: string;
  dispatchBillImagePublicId?: string;
  loadPhotoUrl?: string;
  loadPhotoPublicId?: string;
};

const FILE_LABELS: Record<CustomerBillFileType, string> = {
  "bill-pdf": "Bill PDF",
  "bill-image": "Bill Photo",
  "load-photo": "Gadi Load Photo",
  "dispatch-bill-pdf": "Dispatch Bill PDF",
  "dispatch-bill-image": "Dispatch Bill Photo",
};

export function collectBillFilesFromDispatch(d: DispatchArchiveSource): CustomerBillFileEntry[] {
  const displayId = getDisplayBillId({
    billStatus: d.billStatus,
    finalBillId: d.finalBillId,
    dispatchId: d.dispatchId,
  });
  const files: CustomerBillFileEntry[] = [];

  if (d.billPdfUrl) {
    files.push({
      type: "bill-pdf",
      label: `${displayId} — PDF`,
      url: d.billPdfUrl,
      publicId: d.billPdfPublicId,
    });
  }
  if (d.billImageUrl) {
    files.push({
      type: "bill-image",
      label: `${displayId} — Photo`,
      url: d.billImageUrl,
      publicId: d.billImagePublicId,
    });
  }
  if (d.dispatchBillPdfUrl) {
    files.push({
      type: "dispatch-bill-pdf",
      label: `${d.dispatchId} — Dispatch PDF`,
      url: d.dispatchBillPdfUrl,
      publicId: d.dispatchBillPdfPublicId,
    });
  }
  if (d.dispatchBillImageUrl) {
    files.push({
      type: "dispatch-bill-image",
      label: `${d.dispatchId} — Dispatch Photo`,
      url: d.dispatchBillImageUrl,
      publicId: d.dispatchBillImagePublicId,
    });
  }
  if (d.loadPhotoUrl) {
    files.push({
      type: "load-photo",
      label: `${displayId} — Load Photo`,
      url: d.loadPhotoUrl,
      publicId: d.loadPhotoPublicId,
    });
  }
  return files;
}

/** All Cloudinary bill files for a customer (from their dispatch/final bills) */
export function collectCustomerBillArchives(
  dispatches: DispatchArchiveSource[],
  customerName: string
): CustomerBillArchive[] {
  const archives: CustomerBillArchive[] = [];

  for (const d of dispatches) {
    if (!customerNamesMatch(d.customerName, customerName)) continue;
    const files = collectBillFilesFromDispatch(d);
    if (files.length === 0) continue;

    archives.push({
      billId: d.finalBillId || d.dispatchId,
      displayBillId: getDisplayBillId({
        billStatus: d.billStatus,
        finalBillId: d.finalBillId,
        dispatchId: d.dispatchId,
      }),
      billStatus: d.billStatus,
      dispatchMongoId: String(d._id),
      dispatchDate: new Date(d.dispatchDate).toISOString(),
      total: d.total || 0,
      files,
    });
  }

  return archives.sort(
    (a, b) => new Date(b.dispatchDate).getTime() - new Date(a.dispatchDate).getTime()
  );
}

export async function syncCustomerBillFile(
  customerId: Types.ObjectId | string,
  entry: {
    label: string;
    url: string;
    publicId: string;
    fileType: CustomerBillFileType;
    billId: string;
    dispatchMongoId: Types.ObjectId | string;
  }
) {
  const customer = await Customer.findById(customerId);
  if (!customer) return;

  if (!customer.billFiles) customer.billFiles = [];

  const idx = customer.billFiles.findIndex(
    (f) =>
      f.billId === entry.billId &&
      f.fileType === entry.fileType &&
      String(f.dispatchMongoId) === String(entry.dispatchMongoId)
  );

  const row = {
    label: entry.label,
    url: entry.url,
    publicId: entry.publicId,
    fileType: entry.fileType,
    billId: entry.billId,
    dispatchMongoId: entry.dispatchMongoId as Types.ObjectId,
    uploadedAt: new Date(),
  };

  if (idx >= 0) {
    customer.billFiles[idx] = row;
  } else {
    customer.billFiles.push(row);
  }

  await customer.save();
}

export { FILE_LABELS };
