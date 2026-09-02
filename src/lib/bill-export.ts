"use client";

import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { enrichDispatchBill } from "@/lib/bill-pricing";
import { getBillPaymentDisplay, formatBillPaymentFormula } from "@/lib/bill-payment-display";

const BILL_EXPORT_WIDTH_PX = 794;

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function waitForImages(element: HTMLElement) {
  const images = Array.from(element.querySelectorAll("img"));
  await Promise.all(
    images.map(
      (img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.onload = () => resolve();
              img.onerror = () => resolve();
            })
    )
  );
}

function prepareBillClone(element: HTMLElement) {
  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.width = `${BILL_EXPORT_WIDTH_PX}px`;
  clone.style.maxWidth = `${BILL_EXPORT_WIDTH_PX}px`;
  clone.style.minWidth = `${BILL_EXPORT_WIDTH_PX}px`;
  clone.style.boxSizing = "border-box";
  clone.style.margin = "0";
  clone.style.position = "relative";
  clone.style.left = "0";
  clone.style.top = "0";
  clone.style.opacity = "1";
  clone.style.visibility = "visible";
  clone.style.backgroundColor = "#ffffff";
  return clone;
}

/** Capture in isolated iframe — avoids Tailwind v4 lab() stylesheet parse errors */
async function captureBillCanvas(element: HTMLElement) {
  await waitForImages(element);

  const clone = prepareBillClone(element);
  const captureHeight = Math.max(clone.scrollHeight, element.scrollHeight, 400);

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.left = "-10000px";
  iframe.style.top = "0";
  iframe.style.width = `${BILL_EXPORT_WIDTH_PX}px`;
  iframe.style.height = `${captureHeight + 40}px`;
  iframe.style.border = "none";
  iframe.style.visibility = "hidden";
  iframe.style.pointerEvents = "none";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  if (!doc) {
    document.body.removeChild(iframe);
    throw new Error("Could not create export frame");
  }

  doc.open();
  doc.write(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      * { box-sizing: border-box; }
      body { margin: 0; padding: 0; background: #fff; width: ${BILL_EXPORT_WIDTH_PX}px; }
      table { border-collapse: collapse; }
    </style></head><body></body></html>`
  );
  doc.close();

  doc.body.appendChild(clone);
  await waitForImages(clone);

  await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));

  try {
    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      width: BILL_EXPORT_WIDTH_PX,
      height: clone.scrollHeight,
      windowWidth: BILL_EXPORT_WIDTH_PX,
      windowHeight: clone.scrollHeight,
    });
    return canvas;
  } finally {
    document.body.removeChild(iframe);
  }
}

export async function billElementToImage(element: HTMLElement): Promise<Blob> {
  const canvas = await captureBillCanvas(element);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Failed to create bill image"))),
      "image/png",
      0.95
    );
  });
}

export async function downloadBillImage(element: HTMLElement, filename: string) {
  const blob = await billElementToImage(element);
  downloadBlob(blob, filename);
}

export async function shareBillImageWhatsApp(
  element: HTMLElement,
  phone: string,
  message: string,
  filename = "bill.png",
  imageBlob?: Blob
) {
  const blob = imageBlob ?? (await billElementToImage(element));
  const file = new File([blob], filename, { type: "image/png" });

  if (typeof navigator !== "undefined" && navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], text: message, title: "Bill" });
    return;
  }

  downloadBlob(blob, filename);
  const cleanPhone = phone.replace(/\D/g, "");
  const fullMessage = `${message}\n\n(Bill image download ho gayi hai — WhatsApp me attach karein)`;
  window.open(
    `https://wa.me/${cleanPhone}?text=${encodeURIComponent(fullMessage)}`,
    "_blank"
  );
}

export async function billElementToPdfBlob(element: HTMLElement): Promise<Blob> {
  const canvas = await captureBillCanvas(element);
  const imgData = canvas.toDataURL("image/png", 1.0);
  const pdf = new jsPDF("p", "mm", "a4");

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const marginX = 8;
  const marginY = 10;
  const contentWidth = pageWidth - marginX * 2;
  const contentHeight = pageHeight - marginY * 2;
  const imgHeight = (canvas.height * contentWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = marginY;

  pdf.addImage(imgData, "PNG", marginX, position, contentWidth, imgHeight);
  heightLeft -= contentHeight;

  while (heightLeft > 0) {
    pdf.addPage();
    position = marginY - (imgHeight - heightLeft);
    pdf.addImage(imgData, "PNG", marginX, position, contentWidth, imgHeight);
    heightLeft -= contentHeight;
  }

  return pdf.output("blob");
}

export async function billElementToPDF(element: HTMLElement, filename: string) {
  const blob = await billElementToPdfBlob(element);
  downloadBlob(blob, filename);
  return blob;
}

export function generateBillWhatsAppMessage(bill: {
  billId: string;
  billType: string;
  customerName: string;
  total: number;
  advance: number;
  pending: number;
  cashPaid?: number;
  creditAdded?: number;
  creditApplied?: number;
  paymentMode?: string;
}): string {
  const payment = getBillPaymentDisplay(bill);
  const modeLine = bill.paymentMode ? `Payment Mode: ${bill.paymentMode}\n` : "";
  const thirdLine = payment.hasAdvance
    ? `Advance (Account me save): ₹${payment.creditAdded.toLocaleString("en-IN")}\n`
    : `Pending: ₹${payment.pending.toLocaleString("en-IN")}\n`;

  return `Hello ${bill.customerName},

Your ${bill.billType === "FINAL" ? "Final" : "Dispatch"} Bill from Jindal Creation.

Bill ID: ${bill.billId}
Grand Total: ₹${bill.total.toLocaleString("en-IN")}
Customer Paid: ₹${payment.cashPaid.toLocaleString("en-IN")}
${modeLine}${thirdLine}${formatBillPaymentFormula(payment)}

Please find the bill attached.
Thank you!
Jindal Creation
PVC Panels | Home Decor`;
}

/** Build BillData shape from dispatch API record */
export function dispatchToBillData(dispatch: {
  dispatchId: string;
  billStatus?: "DISPATCH" | "FINAL";
  finalBillId?: string;
  customerName: string;
  customerCode?: string;
  customerCompany?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerCity?: string;
  dispatchDate: string;
  orderType?: "immediate" | "advance";
  readyByDate?: string;
  items: import("@/components/bill-preview").BillData["items"];
  subtotal: number;
  discount: number;
  currentBillAmount?: number;
  carriedForwardPending?: number;
  creditApplied?: number;
  creditAdded?: number;
  cashPaid?: number;
  total: number;
  advance: number;
  pending: number;
  paymentStatus: string;
  paymentMode?: string;
  salespersonName: string;
  notes?: string;
  loadPhotoUrl?: string;
}): import("@/components/bill-preview").BillData {
  const enriched = enrichDispatchBill(dispatch);
  return {
    billId:
      enriched.billStatus === "FINAL" && enriched.finalBillId
        ? enriched.finalBillId
        : enriched.dispatchId,
    billType: enriched.billStatus || "DISPATCH",
    date: enriched.dispatchDate,
    orderType: enriched.orderType,
    readyByDate: enriched.readyByDate,
    customerName: enriched.customerName,
    customerCode: enriched.customerCode,
    customerCompany: enriched.customerCompany,
    customerPhone: enriched.customerPhone,
    customerAddress: enriched.customerAddress,
    customerCity: enriched.customerCity,
    items: (enriched.items ?? []).map((item) => ({
      productName: item.productName ?? "",
      productCode: item.productCode ?? "",
      quantity: item.quantity ?? 0,
      pieces: item.pieces ?? 0,
      boxes: item.boxes ?? 0,
      piecesPerBox: item.piecesPerBox,
      unitPrice: item.unitPrice ?? 0,
      piecePrice: item.piecePrice,
      fullBoxes: item.fullBoxes,
      loosePieces: item.loosePieces,
      discount: item.discount ?? 0,
      total: item.total ?? 0,
      sellMode: item.sellMode,
    })),
    subtotal: enriched.subtotal,
    discount: enriched.discount,
    currentBillAmount: enriched.currentBillAmount,
    carriedForwardPending: enriched.carriedForwardPending,
    creditApplied: enriched.creditApplied,
    creditAdded: enriched.creditAdded,
    cashPaid: enriched.cashPaid,
    total: enriched.total,
    advance: enriched.advance,
    pending: enriched.pending ?? Math.max(0, enriched.total - enriched.advance),
    paymentStatus: enriched.paymentStatus,
    paymentMode: enriched.paymentMode,
    salespersonName: enriched.salespersonName,
    notes: enriched.notes,
    loadPhotoUrl: dispatch.loadPhotoUrl,
  };
}
