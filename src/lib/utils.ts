import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function getStockStatus(
  currentStock: number,
  minimumStock: number
): "In Stock" | "Low Stock" | "Out of Stock" | "Negative Stock" {
  if (currentStock < 0) return "Negative Stock";
  if (currentStock <= 0) return "Out of Stock";
  if (currentStock <= minimumStock) return "Low Stock";
  return "In Stock";
}

export function getPaymentStatus(
  total: number,
  paid: number
): "UNPAID" | "PARTIAL" | "PAID" {
  if (paid <= 0) return "UNPAID";
  if (paid >= total) return "PAID";
  return "PARTIAL";
}

export function calcPendingAmount(total: number, customerPaid: number): number {
  return Math.max(0, total - customerPaid);
}

export function formatPaymentStatusLabel(status: string): string {
  if (status === "PAID") return "Fully Paid";
  if (status === "PARTIAL") return "Partial Payment — Pending Remaining";
  if (status === "UNPAID") return "Unpaid — Full Amount Pending";
  return status;
}

export function formatBillPaymentModeLabel(mode?: string, advance = 0): string {
  if (mode) return mode;
  return advance > 0 ? "—" : "Not Paid Yet";
}

export function generateWhatsAppUrl(
  phone: string,
  message: string
): string {
  const cleanPhone = phone.replace(/\D/g, "");
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

export function sanitizeSearchQuery(query: string): string {
  return query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** e.g. "5 box + 3 pcs" or "8 pcs" or "2 box" — hides zero side */
export function formatBoxPieces(
  pieces: number,
  piecesPerBox: number,
  storedBoxes?: number
): string {
  const ppb = Math.max(piecesPerBox, 1);
  const absPieces = Math.abs(Math.round(pieces));
  const fullBoxes =
    storedBoxes !== undefined && storedBoxes >= 0
      ? storedBoxes
      : Math.floor(absPieces / ppb);
  const loosePieces =
    storedBoxes !== undefined && storedBoxes >= 0
      ? absPieces - fullBoxes * ppb
      : absPieces % ppb;

  // Lazy import pattern avoided — duplicate minimal logic to keep utils free of circular deps
  if (fullBoxes === 0 && loosePieces === 0) return "0 pcs";
  if (fullBoxes > 0 && loosePieces === 0) {
    return `${fullBoxes} box${fullBoxes !== 1 ? "es" : ""}`;
  }
  if (fullBoxes === 0 && loosePieces > 0) {
    return `${loosePieces} pc${loosePieces !== 1 ? "s" : ""}`;
  }
  return `${fullBoxes} box + ${loosePieces} pcs`;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes("duplicate key")) {
      return "A record with this information already exists.";
    }
    if (error.message.includes("Insufficient stock")) {
      return "Insufficient stock available for this operation.";
    }
    return error.message;
  }
  return "Something went wrong. Please try again.";
}
