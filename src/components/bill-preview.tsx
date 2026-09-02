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
  formatLineRate,
  formatLineUnit,
  formatQtyDisplay,
} from "@/lib/bill-pricing";

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
  loadPhotoUrl?: string;
}

const rootStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  backgroundColor: C.white,
  color: C.navy,
  padding: 24,
  width: 794,
  maxWidth: 794,
  minWidth: 794,
  boxSizing: "border-box",
};

const cellStyle: CSSProperties = {
  padding: "6px 4px",
  borderBottom: `1px solid ${C.border}`,
  verticalAlign: "top",
  wordBreak: "break-word",
  overflowWrap: "anywhere",
};

const thStyle: CSSProperties = {
  padding: "8px 4px",
  fontSize: 11,
  fontWeight: 600,
  lineHeight: 1.3,
};

/** Fixed column widths — keeps PDF / html2canvas layout stable */
const FINAL_COL_WIDTHS = ["22%", "9%", "8%", "11%", "11%", "17%", "10%", "12%"] as const;
const DISPATCH_COL_WIDTHS = ["42%", "14%", "14%", "30%"] as const;

export const BillPreview = forwardRef<HTMLDivElement, { bill: BillData }>(
  function BillPreview({ bill }, ref) {
    const showPricing = bill.billType === "FINAL";
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
    const colSpan = showPricing ? 8 : 4;

    return (
      <div ref={ref} style={rootStyle}>
        <table style={{ width: "100%", marginBottom: 20, borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={{ verticalAlign: "top", width: "50%", padding: 0 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: C.gold, margin: 0 }}>{title}</h2>
                <p style={{ fontSize: 13, margin: "4px 0" }}>
                  Bill ID: <strong>{bill.billId}</strong>
                </p>
                <p style={{ fontSize: 13, margin: "4px 0" }}>Date: {formatDate(bill.date)}</p>
                {bill.orderType === "advance" && bill.readyByDate && (
                  <p style={{ fontSize: 13, margin: "4px 0", color: C.gold, fontWeight: 600 }}>
                    Maal Ready By: {formatDate(bill.readyByDate)}
                  </p>
                )}
              </td>
              <td style={{ verticalAlign: "top", width: "50%", textAlign: "right", fontSize: 13, padding: 0 }}>
                <p style={{ fontWeight: 700, margin: 0 }}>{bill.customerName}</p>
                {bill.customerCode && <p style={{ margin: "2px 0" }}>ID: {bill.customerCode}</p>}
                {bill.customerCompany && <p style={{ margin: "2px 0" }}>{bill.customerCompany}</p>}
                {bill.customerPhone && <p style={{ margin: "2px 0" }}>Phone: {bill.customerPhone}</p>}
                {bill.customerAddress && <p style={{ margin: "2px 0" }}>{bill.customerAddress}</p>}
                {bill.customerCity && <p style={{ margin: "2px 0" }}>{bill.customerCity}</p>}
              </td>
            </tr>
          </tbody>
        </table>

        <table
          style={{
            width: "100%",
            fontSize: 12,
            borderCollapse: "collapse",
            marginBottom: 16,
            tableLayout: "fixed",
          }}
        >
          <colgroup>
            {(showPricing ? FINAL_COL_WIDTHS : DISPATCH_COL_WIDTHS).map((width, i) => (
              <col key={i} style={{ width }} />
            ))}
          </colgroup>
          <thead>
            <tr style={{ backgroundColor: C.navy, color: C.white }}>
              <th style={{ ...thStyle, textAlign: "left" }}>Product</th>
              <th style={{ ...thStyle, textAlign: "center" }}>Item No.</th>
              <th style={{ ...thStyle, textAlign: "center" }}>Unit</th>
              <th style={{ ...thStyle, textAlign: "center" }}>Qty</th>
              {showPricing && (
                <>
                  <th style={{ ...thStyle, textAlign: "center" }}>Rate</th>
                  <th style={{ ...thStyle, textAlign: "left" }}>Calculation</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Disc.</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Total</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {displayItems.length === 0 ? (
              <tr>
                <td
                  colSpan={colSpan}
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
                    <td style={{ ...cellStyle, fontWeight: 500 }}>
                      {item.productName || "—"}
                    </td>
                    <td
                      style={{
                        ...cellStyle,
                        textAlign: "center",
                        fontFamily: "monospace",
                        fontSize: 11,
                      }}
                    >
                      {item.productCode || "—"}
                    </td>
                    <td
                      style={{
                        ...cellStyle,
                        textAlign: "center",
                        fontSize: 10,
                        fontWeight: 600,
                      }}
                    >
                      {formatLineUnit(pricing)}
                    </td>
                    <td style={{ ...cellStyle, textAlign: "center", fontWeight: 600, fontSize: 11 }}>
                      {formatQtyDisplay(pricing.fullBoxes, pricing.loosePieces)}
                    </td>
                    {showPricing && (
                      <>
                        <td
                          style={{
                            ...cellStyle,
                            textAlign: "center",
                            fontSize: 10,
                            fontWeight: 500,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {formatLineRate(pricing)}
                        </td>
                        <td style={{ ...cellStyle, fontSize: 10, color: C.gray500 }}>
                          {formatBillLineCalculation(pricing)}
                        </td>
                        <td
                          style={{
                            ...cellStyle,
                            textAlign: "right",
                            color: C.red600,
                            fontSize: 11,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {item.discount > 0 ? `-${formatCurrency(item.discount)}` : "—"}
                        </td>
                        <td
                          style={{
                            ...cellStyle,
                            textAlign: "right",
                            fontWeight: 600,
                            color: C.green700,
                            fontSize: 11,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {formatCurrency(pricing.total)}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {showPricing && (
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 8 }}>
          <tbody>
            <tr>
              <td style={{ padding: "0 12px 0 0", verticalAlign: "top", width: "auto" }}>
                {bill.loadPhotoUrl ? (
                  <div style={{ maxWidth: 200 }}>
                    <p
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: C.navy,
                        marginBottom: 4,
                        lineHeight: 1.3,
                      }}
                    >
                      Gadi Me Maal Load Photo
                    </p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={bill.loadPhotoUrl}
                      alt="Gadi me maal load"
                      crossOrigin="anonymous"
                      style={{
                        display: "block",
                        width: "100%",
                        maxWidth: 200,
                        maxHeight: 130,
                        objectFit: "contain",
                        border: `1px solid ${C.border}`,
                        borderRadius: 4,
                      }}
                    />
                  </div>
                ) : null}
              </td>
              <td style={{ padding: 0, width: 320, verticalAlign: "top" }}>
                <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: "3px 0" }}>Subtotal:</td>
                      <td style={{ padding: "3px 0", textAlign: "right", whiteSpace: "nowrap" }}>
                        {formatCurrency(bill.subtotal)}
                      </td>
                    </tr>
                    {bill.discount > 0 && (
                      <tr>
                        <td style={{ padding: "3px 0", color: C.red600 }}>Discount:</td>
                        <td style={{ padding: "3px 0", textAlign: "right", color: C.red600, whiteSpace: "nowrap" }}>
                          -{formatCurrency(bill.discount)}
                        </td>
                      </tr>
                    )}
                    {carriedForward > 0 && (
                      <>
                        <tr>
                          <td style={{ padding: "3px 0" }}>Is Bill Ka Amount:</td>
                          <td style={{ padding: "3px 0", textAlign: "right", whiteSpace: "nowrap" }}>
                            {formatCurrency(currentBillAmount)}
                          </td>
                        </tr>
                        <tr>
                          <td style={{ padding: "3px 0", color: C.gold, fontWeight: 600 }}>
                            Purani Pending:
                          </td>
                          <td
                            style={{
                              padding: "3px 0",
                              textAlign: "right",
                              color: C.gold,
                              fontWeight: 600,
                              whiteSpace: "nowrap",
                            }}
                          >
                            +{formatCurrency(carriedForward)}
                          </td>
                        </tr>
                      </>
                    )}
                    <tr>
                      <td
                        style={{
                          padding: "6px 0 3px",
                          fontWeight: 700,
                          fontSize: 15,
                          borderTop: `1px solid ${C.border}`,
                        }}
                      >
                        Grand Total:
                      </td>
                      <td
                        style={{
                          padding: "6px 0 3px",
                          textAlign: "right",
                          fontWeight: 700,
                          fontSize: 15,
                          borderTop: `1px solid ${C.border}`,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatCurrency(bill.total)}
                      </td>
                    </tr>
                    {cashPaid > 0 && (
                      <tr>
                        <td style={{ padding: "3px 0", color: C.green700 }}>Customer Paid:</td>
                        <td
                          style={{
                            padding: "3px 0",
                            textAlign: "right",
                            color: C.green700,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {formatCurrency(cashPaid)}
                        </td>
                      </tr>
                    )}
                    {(bill.creditApplied || 0) > 0 && (
                      <tr>
                        <td style={{ padding: "3px 0", color: C.green700 }}>Advance Applied:</td>
                        <td
                          style={{
                            padding: "3px 0",
                            textAlign: "right",
                            color: C.green700,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {formatCurrency(creditAppliedOnBill)}
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td style={{ padding: "3px 0" }}>Payment Mode:</td>
                      <td style={{ padding: "3px 0", textAlign: "right", fontWeight: 500 }}>
                        {paymentModeLabel}
                      </td>
                    </tr>
                    {creditAdded > 0 ? (
                      <tr>
                        <td style={{ padding: "3px 0", color: C.gold, fontWeight: 700 }}>
                          Advance Save:
                        </td>
                        <td
                          style={{
                            padding: "3px 0",
                            textAlign: "right",
                            color: C.gold,
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {formatCurrency(creditAdded)}
                        </td>
                      </tr>
                    ) : (
                      <tr>
                        <td style={{ padding: "3px 0", color: C.red600, fontWeight: 700 }}>Pending:</td>
                        <td
                          style={{
                            padding: "3px 0",
                            textAlign: "right",
                            color: C.red600,
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {formatCurrency(pending)}
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td
                        colSpan={2}
                        style={{
                          fontSize: 11,
                          color: C.gray500,
                          borderTop: `1px solid ${C.border}`,
                          paddingTop: 6,
                          paddingBottom: 3,
                        }}
                      >
                        {formatBillPaymentFormula(payment)}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: "3px 0", fontSize: 12, color: C.gray500 }}>Status:</td>
                      <td style={{ padding: "3px 0", textAlign: "right", fontSize: 12, color: C.gray500 }}>
                        {paymentStatus}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
        )}

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
