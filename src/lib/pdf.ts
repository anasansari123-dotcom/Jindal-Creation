"use client";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency, formatDate } from "@/lib/utils";
import { BRAND } from "@/lib/constants";
import {
  formatAvailableStockBoxCell,
  formatAvailableStockPieceCell,
  formatAvailableStockUnit,
  summarizeInventoryExport,
} from "@/lib/stock-display";

interface OrderData {
  orderId: string;
  orderDate: string | Date;
  customerName: string;
  customerCode: string;
  customerPhone?: string;
  customerAddress?: string;
  items: Array<{
    productName: string;
    productCode: string;
    quantity: number;
    pieces: number;
    boxes: number;
    unitPrice: number;
    discount: number;
    total: number;
  }>;
  subtotal: number;
  discount: number;
  total: number;
  advance: number;
  pending: number;
  paymentStatus: string;
  salespersonName: string;
}

interface DispatchData extends OrderData {
  dispatchId: string;
  dispatchDate: string | Date;
  verifiedByName: string;
}

export function generateInvoicePDF(order: OrderData): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(20);
  doc.setTextColor(26, 35, 50);
  doc.text(BRAND.name, pageWidth / 2, 20, { align: "center" });

  doc.setFontSize(10);
  doc.setTextColor(201, 162, 39);
  doc.text(BRAND.tagline, pageWidth / 2, 27, { align: "center" });

  doc.setDrawColor(201, 162, 39);
  doc.line(20, 32, pageWidth - 20, 32);

  doc.setFontSize(14);
  doc.setTextColor(26, 35, 50);
  doc.text("INVOICE", 20, 42);

  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text(`Invoice/Order ID: ${order.orderId}`, 20, 50);
  doc.text(`Date: ${formatDate(order.orderDate)}`, 20, 56);
  doc.text(`Customer: ${order.customerName}`, 20, 62);
  doc.text(`Customer ID: ${order.customerCode}`, 20, 68);
  if (order.customerPhone) doc.text(`Phone: ${order.customerPhone}`, 20, 74);
  if (order.customerAddress) doc.text(`Address: ${order.customerAddress}`, 20, 80);

  autoTable(doc, {
    startY: 88,
    head: [["Product", "Qty", "Pieces", "Boxes", "Unit Price", "Discount", "Total"]],
    body: order.items.map((item) => [
      `${item.productName}\n(${item.productCode})`,
      item.quantity,
      item.pieces,
      item.boxes,
      formatCurrency(item.unitPrice),
      formatCurrency(item.discount),
      formatCurrency(item.total),
    ]),
    headStyles: { fillColor: [26, 35, 50], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [248, 248, 248] },
  });

  const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  doc.setFontSize(10);
  doc.setTextColor(26, 35, 50);
  doc.text(`Subtotal: ${formatCurrency(order.subtotal)}`, pageWidth - 20, finalY, { align: "right" });
  doc.text(`Discount: ${formatCurrency(order.discount)}`, pageWidth - 20, finalY + 6, { align: "right" });
  doc.setFontSize(12);
  doc.text(`Grand Total: ${formatCurrency(order.total)}`, pageWidth - 20, finalY + 14, { align: "right" });
  doc.setFontSize(10);
  doc.text(`Advance: ${formatCurrency(order.advance)}`, pageWidth - 20, finalY + 22, { align: "right" });
  doc.text(`Pending: ${formatCurrency(order.pending)}`, pageWidth - 20, finalY + 28, { align: "right" });
  doc.text(`Payment Status: ${order.paymentStatus}`, pageWidth - 20, finalY + 34, { align: "right" });
  doc.text(`Salesperson: ${order.salespersonName}`, 20, finalY + 34);

  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(
    `Calculation: Bill ${formatCurrency(order.total)} - Paid ${formatCurrency(order.advance)} = Pending ${formatCurrency(order.pending)}`,
    pageWidth / 2,
    finalY + 42,
    { align: "center" }
  );

  doc.setFontSize(11);
  doc.setTextColor(201, 162, 39);
  doc.text("Thank You for Your Business", pageWidth / 2, finalY + 50, { align: "center" });
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(BRAND.slogan, pageWidth / 2, finalY + 57, { align: "center" });

  return doc;
}

export function generateDispatchPDF(dispatch: DispatchData): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(20);
  doc.setTextColor(26, 35, 50);
  doc.text(BRAND.name, pageWidth / 2, 20, { align: "center" });

  doc.setFontSize(10);
  doc.setTextColor(201, 162, 39);
  doc.text(BRAND.tagline, pageWidth / 2, 27, { align: "center" });

  doc.setDrawColor(201, 162, 39);
  doc.line(20, 32, pageWidth - 20, 32);

  doc.setFontSize(14);
  doc.setTextColor(26, 35, 50);
  doc.text("DISPATCH DOCUMENT", 20, 42);

  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text(`Dispatch ID: ${dispatch.dispatchId}`, 20, 50);
  doc.text(`Order ID: ${dispatch.orderId}`, 20, 56);
  doc.text(`Dispatch Date: ${formatDate(dispatch.dispatchDate)}`, 20, 62);
  doc.text(`Customer: ${dispatch.customerName} (${dispatch.customerCode})`, 20, 68);
  doc.text(`Verified By: ${dispatch.verifiedByName}`, 20, 74);
  doc.text(`Salesperson: ${dispatch.salespersonName}`, 20, 80);

  autoTable(doc, {
    startY: 88,
    head: [["Product", "Qty", "Pieces", "Boxes", "Price", "Total", "Verified"]],
    body: dispatch.items.map((item) => [
      `${item.productName}\n(${item.productCode})`,
      item.quantity,
      item.pieces,
      item.boxes,
      formatCurrency(item.unitPrice),
      formatCurrency(item.total),
      "✓",
    ]),
    headStyles: { fillColor: [26, 35, 50], textColor: [255, 255, 255] },
  });

  const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  doc.setFontSize(10);
  doc.text(`Total: ${formatCurrency(dispatch.total)}`, pageWidth - 20, finalY, { align: "right" });
  doc.text(`Advance: ${formatCurrency(dispatch.advance)}`, pageWidth - 20, finalY + 6, { align: "right" });
  doc.text(`Pending: ${formatCurrency(dispatch.pending)}`, pageWidth - 20, finalY + 12, { align: "right" });
  doc.text(`Payment Status: ${dispatch.paymentStatus}`, pageWidth - 20, finalY + 18, { align: "right" });
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(
    `Bill ${formatCurrency(dispatch.total)} - Client Paid ${formatCurrency(dispatch.advance)} = Pending ${formatCurrency(dispatch.pending)}`,
    pageWidth / 2,
    finalY + 26,
    { align: "center" }
  );

  doc.setFontSize(11);
  doc.setTextColor(201, 162, 39);
  doc.text("Thank You for Your Business", pageWidth / 2, finalY + 35, { align: "center" });

  return doc;
}

interface ConfirmBillData extends OrderData {
  confirmBillId: string;
  confirmDate: string | Date;
  confirmedByName: string;
}

export function generateConfirmBillPDF(bill: ConfirmBillData): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(20);
  doc.setTextColor(26, 35, 50);
  doc.text(BRAND.name, pageWidth / 2, 20, { align: "center" });

  doc.setFontSize(10);
  doc.setTextColor(201, 162, 39);
  doc.text(BRAND.tagline, pageWidth / 2, 27, { align: "center" });

  doc.setDrawColor(201, 162, 39);
  doc.line(20, 32, pageWidth - 20, 32);

  doc.setFontSize(14);
  doc.setTextColor(26, 35, 50);
  doc.text("CONFIRM BILL", 20, 42);

  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text(`Confirm Bill ID: ${bill.confirmBillId}`, 20, 50);
  doc.text(`Order ID: ${bill.orderId}`, 20, 56);
  doc.text(`Confirm Date: ${formatDate(bill.confirmDate)}`, 20, 62);
  doc.text(`Customer: ${bill.customerName}`, 20, 68);
  doc.text(`Customer ID: ${bill.customerCode}`, 20, 74);
  doc.text(`Confirmed By: ${bill.confirmedByName}`, 20, 80);
  doc.text(`Salesperson: ${bill.salespersonName}`, 20, 86);

  autoTable(doc, {
    startY: 94,
    head: [["Product", "Qty", "Pieces", "Boxes", "Unit Price", "Discount", "Total"]],
    body: bill.items.map((item) => [
      `${item.productName}\n(${item.productCode})`,
      item.quantity,
      item.pieces,
      item.boxes,
      formatCurrency(item.unitPrice),
      formatCurrency(item.discount),
      formatCurrency(item.total),
    ]),
    headStyles: { fillColor: [26, 35, 50], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [248, 248, 248] },
  });

  const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  doc.setFontSize(10);
  doc.setTextColor(26, 35, 50);
  doc.text(`Subtotal: ${formatCurrency(bill.subtotal)}`, pageWidth - 20, finalY, { align: "right" });
  doc.text(`Discount: ${formatCurrency(bill.discount)}`, pageWidth - 20, finalY + 6, { align: "right" });
  doc.setFontSize(12);
  doc.text(`Grand Total: ${formatCurrency(bill.total)}`, pageWidth - 20, finalY + 14, { align: "right" });
  doc.setFontSize(10);
  doc.text(`Advance Received: ${formatCurrency(bill.advance)}`, pageWidth - 20, finalY + 22, { align: "right" });
  doc.text(`Pending Amount: ${formatCurrency(bill.pending)}`, pageWidth - 20, finalY + 28, { align: "right" });
  doc.text(`Payment Status: ${bill.paymentStatus}`, pageWidth - 20, finalY + 34, { align: "right" });

  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(
    `Bill ${formatCurrency(bill.total)} - Client Paid ${formatCurrency(bill.advance)} = Pending ${formatCurrency(bill.pending)}`,
    pageWidth / 2,
    finalY + 42,
    { align: "center" }
  );
  doc.text("* Stock deducted from inventory upon confirmation", 20, finalY + 34);

  doc.setFontSize(11);
  doc.setTextColor(201, 162, 39);
  doc.text("Thank You for Your Business", pageWidth / 2, finalY + 50, { align: "center" });

  return doc;
}

export function generateWhatsAppDispatchMessage(params: {
  customerName: string;
  customerCode: string;
  dispatchId: string;
  orderId: string;
  total: number;
  advance: number;
  pending: number;
  paymentStatus: string;
}): string {
  return `Hello ${params.customerName},

Your order has been dispatched from ${BRAND.name}.

Customer ID: ${params.customerCode}
Dispatch ID: ${params.dispatchId}
Order ID: ${params.orderId}

Total: ₹${params.total.toLocaleString("en-IN")}
Advance: ₹${params.advance.toLocaleString("en-IN")}
Pending: ₹${params.pending.toLocaleString("en-IN")}
Payment Status: ${params.paymentStatus}

Thank you.
${BRAND.name}
${BRAND.tagline}`;
}

export function generateWhatsAppConfirmBillMessage(params: {
  customerName: string;
  customerCode: string;
  confirmBillId: string;
  orderId: string;
  total: number;
  advance: number;
  pending: number;
  paymentStatus: string;
}): string {
  return `Hello ${params.customerName},

Your order has been confirmed with ${BRAND.name}.

Customer ID: ${params.customerCode}
Confirm Bill ID: ${params.confirmBillId}
Order ID: ${params.orderId}

Total: ₹${params.total.toLocaleString("en-IN")}
Advance Received: ₹${params.advance.toLocaleString("en-IN")}
Pending: ₹${params.pending.toLocaleString("en-IN")}
Payment Status: ${params.paymentStatus}

Stock has been updated. Thank you for your business.

${BRAND.name}
${BRAND.tagline}`;
}

export interface InventoryExportRow {
  productId: string;
  name: string;
  category: string;
  boxes: number;
  loosePieces: number;
  currentStock: number;
  piecesPerBox: number;
  minimumStock: number;
  stockStatus: string;
}

export function generateInventoryPDF(
  items: InventoryExportRow[],
  options?: { search?: string; status?: string; generatedAt?: Date }
): jsPDF {
  const doc = new jsPDF({ orientation: items.length > 25 ? "landscape" : "portrait" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const generatedAt = options?.generatedAt ?? new Date();

  doc.setFontSize(20);
  doc.setTextColor(26, 35, 50);
  doc.text(BRAND.name, pageWidth / 2, 18, { align: "center" });

  doc.setFontSize(10);
  doc.setTextColor(201, 162, 39);
  doc.text(BRAND.tagline, pageWidth / 2, 25, { align: "center" });

  doc.setDrawColor(201, 162, 39);
  doc.line(14, 29, pageWidth - 14, 29);

  doc.setFontSize(14);
  doc.setTextColor(26, 35, 50);
  doc.text("CURRENT AVAILABLE STOCK", 14, 38);

  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(`Report Date: ${formatDate(generatedAt)}`, 14, 44);
  doc.text(
    "Yeh report abhi godown me BACHA hua stock dikhati hai (Available). Sale/Final Bill ke baad yahi update hota hai.",
    14,
    49
  );

  let metaY = 54;
  if (options?.search) {
    doc.text(`Search: ${options.search}`, 14, metaY);
    metaY += 5;
  }
  if (options?.status) {
    doc.text(`Filter: ${options.status}`, 14, metaY);
    metaY += 5;
  }

  const stats = summarizeInventoryExport(items);

  doc.text(
    `Products: ${stats.products}  |  Full Boxes Available: ${stats.totalFullBoxes}  |  Loose Pieces Available: ${stats.totalLoosePcs}`,
    14,
    metaY
  );
  doc.text(
    `Status — In Stock: ${stats.inStock}   Low: ${stats.lowStock}   Out: ${stats.outStock}   |   Box-only: ${stats.boxOnly}   Piece-only: ${stats.pieceOnly}   Both: ${stats.both}`,
    14,
    metaY + 5
  );

  const tableStartY = metaY + 11;

  autoTable(doc, {
    startY: tableStartY,
    head: [[
      "No.",
      "Product Name",
      "Category",
      "Unit",
      "Box\nAvailable",
      "Piece\nAvailable",
      "Status",
    ]],
    body: items.map((item) => [
      item.productId,
      item.name,
      item.category,
      formatAvailableStockUnit(item.boxes, item.loosePieces),
      formatAvailableStockBoxCell(item.boxes, item.loosePieces),
      formatAvailableStockPieceCell(item.boxes, item.loosePieces),
      item.stockStatus,
    ]),
    headStyles: { fillColor: [26, 35, 50], textColor: [255, 255, 255], fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: [26, 35, 50] },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 48 },
      3: { halign: "center" },
      4: { halign: "center" },
      5: { halign: "center" },
      6: { halign: "center" },
    },
    didParseCell(data) {
      if (data.section === "body" && data.column.index === 6) {
        const status = String(data.cell.raw);
        if (status === "Out of Stock") {
          data.cell.styles.textColor = [185, 28, 28];
          data.cell.styles.fontStyle = "bold";
        } else if (status === "Low Stock") {
          data.cell.styles.textColor = [180, 83, 9];
          data.cell.styles.fontStyle = "bold";
        } else if (status === "In Stock") {
          data.cell.styles.textColor = [21, 128, 61];
        }
      }
      if (data.section === "body" && (data.column.index === 4 || data.column.index === 5)) {
        if (String(data.cell.raw) === "—") {
          data.cell.styles.textColor = [160, 160, 160];
        }
      }
    },
  });

  const finalY =
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? tableStartY + 20;

  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  const notes = [
    "Box Available = poori boxes abhi stock me | Piece Available = alag loose pieces",
    "Sirf box ho to Piece — | Sirf piece ho to Box — | Dono ho to dono alag dikhenge",
  ];
  notes.forEach((line, i) => {
    doc.text(line, pageWidth / 2, finalY + 8 + i * 4, { align: "center" });
  });
  doc.text(BRAND.slogan, pageWidth / 2, finalY + 22, { align: "center" });

  return doc;
}

export function downloadPDF(doc: jsPDF, filename: string) {
  doc.save(filename);
}

export function printPDF(doc: jsPDF) {
  doc.autoPrint();
  window.open(doc.output("bloburl"), "_blank");
}

export function sharePDF(doc: jsPDF, filename: string) {
  const blob = doc.output("blob");
  if (navigator.share && navigator.canShare) {
    const file = new File([blob], filename, { type: "application/pdf" });
    if (navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: filename });
      return;
    }
  }
  downloadPDF(doc, filename);
}

export function generateWhatsAppOrderMessage(params: {
  customerName: string;
  productName: string;
  productId: string;
  quantity: number;
  contact?: string;
}): string {
  let msg = `Hello,\n\nI would like to place an order with ${BRAND.name}.\n\n`;
  msg += `Customer Name: ${params.customerName}\n`;
  msg += `Product: ${params.productName}\n`;
  msg += `Product ID: ${params.productId}\n`;
  msg += `Quantity: ${params.quantity}\n`;
  if (params.contact) msg += `Contact: ${params.contact}\n`;
  msg += `\n${BRAND.tagline}`;
  return msg;
}

export function generateWhatsAppOrderConfirmMessage(params: {
  customerName: string;
  orderId: string;
  total: number;
  advance: number;
  pending: number;
}): string {
  return `Hello ${params.customerName},

Thank you for your order with ${BRAND.name}.

Order ID: ${params.orderId}

Total Amount: ₹${params.total.toLocaleString("en-IN")}
Advance: ₹${params.advance.toLocaleString("en-IN")}
Pending: ₹${params.pending.toLocaleString("en-IN")}

Thank you.
${BRAND.name}
${BRAND.tagline}`;
}
