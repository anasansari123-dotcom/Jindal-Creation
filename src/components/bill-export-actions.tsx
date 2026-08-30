"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { BillPreview, type BillData } from "@/components/bill-preview";
import { DEFAULT_WHATSAPP_NUMBER } from "@/lib/constants";
import {
  billElementToPDF,
  shareBillImageWhatsApp,
  generateBillWhatsAppMessage,
} from "@/lib/bill-export";
import { Download, MessageCircle } from "lucide-react";

interface BillExportActionsProps {
  bill: BillData;
  whatsappNumber?: string;
  compact?: boolean;
}

export function BillExportActions({
  bill,
  whatsappNumber = DEFAULT_WHATSAPP_NUMBER,
  compact = false,
}: BillExportActionsProps) {
  const billRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const handleDownloadPDF = async () => {
    if (!billRef.current) {
      toast("Bill load nahi hua", "error");
      return;
    }
    setExporting(true);
    try {
      await billElementToPDF(billRef.current, `${bill.billType}-${bill.billId}.pdf`);
      toast("PDF download ho gayi", "success");
    } catch (err) {
      console.error(err);
      toast("PDF download fail — dubara try karein", "error");
    } finally {
      setExporting(false);
    }
  };

  const handleWhatsApp = async () => {
    if (!billRef.current) {
      toast("Bill load nahi hua", "error");
      return;
    }
    setExporting(true);
    try {
      const msg = generateBillWhatsAppMessage({
        billId: bill.billId,
        billType: bill.billType,
        customerName: bill.customerName,
        total: bill.total,
        advance: bill.advance,
        pending: bill.pending,
        paymentMode: bill.paymentMode,
      });
      await shareBillImageWhatsApp(
        billRef.current,
        whatsappNumber,
        msg,
        `${bill.billId}-bill.png`
      );
      toast("Bill image download + WhatsApp open ho gaya", "success");
    } catch (err) {
      console.error(err);
      toast("WhatsApp share fail — dubara try karein", "error");
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          variant={compact ? "ghost" : "outline"}
          size={compact ? "sm" : "default"}
          onClick={handleDownloadPDF}
          disabled={exporting}
          title="Download PDF"
        >
          <Download className="h-4 w-4" />
          {!compact && (exporting ? " Generating..." : " Download PDF")}
        </Button>
        <Button
          variant={compact ? "ghost" : "gold"}
          size={compact ? "sm" : "default"}
          onClick={handleWhatsApp}
          disabled={exporting}
          title="Send on WhatsApp"
        >
          <MessageCircle className="h-4 w-4" />
          {!compact && (exporting ? " Please wait..." : " Send on WhatsApp")}
        </Button>
      </div>

      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          opacity: 0,
          pointerEvents: "none",
          zIndex: -9999,
          overflow: "hidden",
        }}
      >
        <BillPreview ref={billRef} bill={bill} />
      </div>
    </>
  );
}
