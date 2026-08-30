"use client";

import { forwardRef, type CSSProperties } from "react";
import {
  formatCurrency,
  formatDate,
  formatPaymentStatusLabel,
  formatBillPaymentModeLabel,
} from "@/lib/utils";
import {
  getBillPaymentDisplay,
  formatBillPaymentFormula,
} from "@/lib/bill-payment-display";
import {
  enrichBillLineItem,
  expandItemsForBillDisplay,
  formatBillLineCalculation,
  formatLineDetail,
  formatLineRate,
  formatLineUnit,
  formatQtyDisplay,
} from "@/lib/bill-pricing";
import { BRAND } from "@/lib/constants";

/** Hex colors only — html2canvas cannot parse Tailwind v4 lab() colors */
const C = {
  navy: "#1a2332",
  gold: "#c9a227",
  white: "#ffffff",
  gray50: "#f9fafb",
  gray400: "#9ca3af",
  gray500: "#6b7280",
  red600: "#dc2626",
  green700: "#15803d",
  border: "#e5e7eb",
};

export interface BillData {
  billId: string;
  billType: "DISPATCH" | "FINAL";
  date: string | Date;
  orderType?: "immediate" | "advance";
  readyByDate?: string | Date;
  customerName: string;
  customerCode?: string;
  customerCompany?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerCity?: string;
  items: Array<{
    productName: string;
    productCode: string;
    quantity: number;
    pieces: number;
    boxes: number;
    piecesPerBox?: number;
    unitPrice: number;
    piecePrice?: number;
    fullBoxes?: number;
    loosePieces?: number;
    discount: number;
    total: number;
    sellMode?: "box" | "piece" | "mixed";
  }>;
  subtotal: number;
  discount: number;
  total: number;
  advance: number;
  pending: number;
  /** Current bill amount before carried-forward pending */
  currentBillAmount?: number;
  carriedForwardPending?: number;
  creditApplied?: number;
  /** Overpayment saved to customer account */
  creditAdded?: number;
  /** Actual cash/UPI paid by customer */
  cashPaid?: number;
  paymentStatus: string;
  paymentMode?: string;
  salespersonName: string;
  notes?: string;
}

const rootStyle: CSSProperties = {
  fontFamily: "Georgia, serif",
  backgroundColor: C.white,
  color: C.navy,
  padding: 32,
  width: 794,
};

const thStyle: CSSProperties = {
  padding: "8px 6px",
  fontSize: 12,
  fontWeight: 600,
  lineHeight: 1.3,
};

export const BillPreview = forwardRef<HTMLDivElement, { bill: BillData }>(
  function BillPreview({ bill }, ref) {
    const title =
      bill.billType === "FINAL"
        ? "FINAL BILL"
        : bill.orderType === "advance"
          ? "ADVANCE ORDER"
          : "DISPATCH BILL";
    const payment = getBillPaymentDisplay(bill);
    const { cashPaid, creditAdded, pending, creditApplied: creditAppliedOnBill } = payment;
    const currentBillAmount =
      bill.currentBillAmount ?? Math.max(0, bill.subtotal - bill.discount);
    const carriedForward = bill.carriedForwardPending || 0;
    const paymentStatus = formatPaymentStatusLabel(bill.paymentStatus);
    const paymentModeLabel = formatBillPaymentModeLabel(bill.paymentMode, cashPaid);
    const displayItems = expandItemsForBillDisplay(bill.items ?? []);

    return (
      <div ref={ref} style={rootStyle}>
        <div style={{ textAlign: "center", borderBottom: `2px solid ${C.gold}`, paddingBottom: 16, marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt={BRAND.name}
              width={60}
              height={60}
              crossOrigin="anonymous"
              style={{ width: 60, height: 60, objectFit: "contain" }}
            />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{BRAND.name}</h1>
          <p style={{ color: C.gold, fontSize: 14, margin: "4px 0 0" }}>{BRAND.tagline}</p>
          <p style={{ color: C.gray500, fontSize: 12, margin: "4px 0 0" }}>{BRAND.slogan}</p>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: C.gold, margin: 0 }}>{title}</h2>
            <p style={{ fontSize: 14, margin: "4px 0" }}>Bill ID: <strong>{bill.billId}</strong></p>
            <p style={{ fontSize: 14, margin: "4px 0" }}>Date: {formatDate(bill.date)}</p>
            {bill.orderType === "advance" && bill.readyByDate && (
              <p style={{ fontSize: 14, margin: "4px 0", color: C.gold, fontWeight: 600 }}>
                Maal Ready By: {formatDate(bill.readyByDate)}
              </p>
            )}
          </div>
          <div style={{ textAlign: "right", fontSize: 14 }}>
            <p style={{ fontWeight: 700, margin: 0 }}>{bill.customerName}</p>
            {bill.customerCode && <p style={{ margin: "2px 0" }}>ID: {bill.customerCode}</p>}
            {bill.customerCompany && <p style={{ margin: "2px 0" }}>{bill.customerCompany}</p>}
            {bill.customerPhone && <p style={{ margin: "2px 0" }}>Phone: {bill.customerPhone}</p>}
            {bill.customerAddress && <p style={{ margin: "2px 0" }}>{bill.customerAddress}</p>}
            {bill.customerCity && <p style={{ margin: "2px 0" }}>{bill.customerCity}</p>}
          </div>
        </div>

        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse", marginBottom: 16 }}>
          <thead>
            <tr style={{ backgroundColor: C.navy, color: C.white }}>
              <th style={{ ...thStyle, textAlign: "left" }}>Product</th>
              <th style={{ ...thStyle, textAlign: "center" }}>Item No.</th>
              <th style={{ ...thStyle, textAlign: "center" }}>Unit</th>
              <th style={{ ...thStyle, textAlign: "center" }}>Qty</th>
              <th style={{ ...thStyle, textAlign: "center" }}>Rate</th>
              <th style={{ ...thStyle, textAlign: "left" }}>Calculation</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Discount</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {displayItems.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  style={{ padding: 16, textAlign: "center", color: C.gray500, fontSize: 13 }}
                >
                  Is bill me koi product add nahi hua.
                </td>
              </tr>
            ) : (
              displayItems.map((item, i) => {
                const pricing = enrichBillLineItem(item);
                return (
                  <tr key={i} style={{ backgroundColor: i % 2 === 0 ? C.gray50 : C.white }}>
                    <td style={{ padding: 8, borderBottom: `1px solid ${C.border}` }}>
                      <div style={{ fontWeight: 500 }}>{item.productName || "—"}</div>
                      <div style={{ fontSize: 10, color: C.gray500, marginTop: 2 }}>
                        {formatLineDetail(pricing)}
                      </div>
                    </td>
                    <td style={{ padding: 8, borderBottom: `1px solid ${C.border}`, textAlign: "center", fontFamily: "monospace", fontSize: 12 }}>
                      {item.productCode || "—"}
                    </td>
                    <td style={{ padding: 8, borderBottom: `1px solid ${C.border}`, textAlign: "center", fontSize: 11, fontWeight: 600 }}>
                      {formatLineUnit(pricing)}
                    </td>
                    <td style={{ padding: 8, borderBottom: `1px solid ${C.border}`, textAlign: "center", fontWeight: 600 }}>
                      {formatQtyDisplay(pricing.fullBoxes, pricing.loosePieces)}
                    </td>
                    <td style={{ padding: 8, borderBottom: `1px solid ${C.border}`, textAlign: "center", fontSize: 11, fontWeight: 500 }}>
                      {formatLineRate(pricing)}
                    </td>
                    <td style={{ padding: 8, borderBottom: `1px solid ${C.border}`, fontSize: 11, color: C.gray500 }}>
                      {formatBillLineCalculation(pricing)}
                    </td>
                    <td style={{ padding: 8, borderBottom: `1px solid ${C.border}`, textAlign: "right", color: C.red600 }}>
                      {item.discount > 0 ? `-${formatCurrency(item.discount)}` : "—"}
                    </td>
                    <td style={{ padding: 8, borderBottom: `1px solid ${C.border}`, textAlign: "right", fontWeight: 500, color: C.green700 }}>
                      {formatCurrency(pricing.total)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <div style={{ width: 280, fontSize: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span>Subtotal:</span>
              <span>{formatCurrency(bill.subtotal)}</span>
            </div>
            {bill.discount > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", color: C.red600, marginBottom: 4 }}>
                <span>Discount:</span>
                <span>-{formatCurrency(bill.discount)}</span>
              </div>
            )}
            {carriedForward > 0 && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span>Is Bill Ka Amount:</span>
                  <span>{formatCurrency(currentBillAmount)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", color: C.gold, marginBottom: 4, fontWeight: 600 }}>
                  <span>Purani Pending (Account):</span>
                  <span>+{formatCurrency(carriedForward)}</span>
                </div>
              </>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 16, borderTop: `1px solid ${C.border}`, paddingTop: 4, marginBottom: 4 }}>
              <span>Grand Total:</span>
              <span>{formatCurrency(bill.total)}</span>
            </div>
            {cashPaid > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", color: C.green700, marginBottom: 4 }}>
                <span>Customer Paid (Cash/UPI):</span>
                <span>{formatCurrency(cashPaid)}</span>
              </div>
            )}
            {(bill.creditApplied || 0) > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", color: C.green700, marginBottom: 4 }}>
                <span>Account Advance Applied:</span>
                <span>{formatCurrency(creditAppliedOnBill)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span>Payment Mode:</span>
              <span style={{ fontWeight: 500 }}>{paymentModeLabel}</span>
            </div>
            {creditAdded > 0 ? (
              <div style={{ display: "flex", justifyContent: "space-between", color: C.gold, fontWeight: 700, marginBottom: 4 }}>
                <span>Advance (Account me save):</span>
                <span>{formatCurrency(creditAdded)}</span>
              </div>
            ) : (
              <div style={{ display: "flex", justifyContent: "space-between", color: C.red600, fontWeight: 700, marginBottom: 4 }}>
                <span>Pending:</span>
                <span>{formatCurrency(pending)}</span>
              </div>
            )}
            <div style={{ fontSize: 12, color: C.gray500, borderTop: `1px solid ${C.border}`, paddingTop: 4, marginBottom: 4 }}>
              {formatBillPaymentFormula(payment)}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.gray500 }}>
              <span>Status:</span>
              <span>{paymentStatus}</span>
            </div>
          </div>
        </div>

        {bill.notes && (
          <p style={{ fontSize: 12, color: C.gray500, marginTop: 16 }}>Notes: {bill.notes}</p>
        )}

        <p style={{ textAlign: "center", color: C.gold, fontSize: 14, marginTop: 32, fontWeight: 500 }}>
          Thank You for Your Business
        </p>
        <p style={{ textAlign: "center", fontSize: 12, color: C.gray400, marginTop: 4 }}>
          Bill Banaya: {bill.salespersonName}
        </p>
      </div>
    );
  }
);
