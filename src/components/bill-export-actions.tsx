"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { BillPreview, type BillData } from "@/components/bill-preview";
import { DEFAULT_WHATSAPP_NUMBER } from "@/lib/constants";
import {
  billElementToPDF,
  billElementToImage,
  shareBillImageWhatsApp,
  generateBillWhatsAppMessage,
} from "@/lib/bill-export";
import { uploadDispatchFile } from "@/lib/cloudinary-upload-client";
import { Download, MessageCircle } from "lucide-react";

interface BillExportActionsProps {
  bill: BillData;
  dispatchMongoId?: string;
  whatsappNumber?: string;
  compact?: boolean;
}

async function archiveBillOnCloudinary(
  dispatchMongoId: string | undefined,
  file: Blob,
  filename: string,
  fileType: "bill-pdf" | "bill-image"
) {
  if (!dispatchMongoId) return;
  try {
    await uploadDispatchFile({
      dispatchId: dispatchMongoId,
      file,
      filename,
      fileType,
      mimeType: fileType === "bill-pdf" ? "application/pdf" : "image/png",
    });
  } catch (err) {
    console.warn("Cloudinary archive failed:", err);
  }
}

export function BillExportActions({
  bill,
  dispatchMongoId,
  whatsappNumber = DEFAULT_WHATSAPP_NUMBER,
  compact = false,
}: BillExportActionsProps) {
  const billRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const handleDownloadPDF = async () => {
    if (!billRef.current) {
      toast("Bill load nahi hui", "error");
      return;
    }
    setExporting(true);
    try {
      const filename = `${bill.billType}-${bill.billId}.pdf`;
      const blob = await billElementToPDF(billRef.current, filename);
      await archiveBillOnCloudinary(dispatchMongoId, blob, filename, "bill-pdf");
      toast("PDF download + Cloudinary par save ho gayi", "success");
    } catch (err) {
      console.error(err);
      toast("PDF download fail — dubara try karein", "error");
    } finally {
      setExporting(false);
    }
  };

  const handleWhatsApp = async () => {
    if (!billRef.current) {
      toast("Bill load nahi hui", "error");
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
      const imageFilename = `${bill.billId}-bill.png`;
      const imageBlob = await billElementToImage(billRef.current);
      await archiveBillOnCloudinary(dispatchMongoId, imageBlob, imageFilename, "bill-image");
      await shareBillImageWhatsApp(
        billRef.current,
        whatsappNumber,
        msg,
        imageFilename,
        imageBlob
      );
      toast("Bill Cloudinary par save + WhatsApp open ho gaya", "success");
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
          left: "-10000px",
          top: 0,
          width: 794,
          pointerEvents: "none",
          zIndex: -1,
        }}
      >
        <BillPreview ref={billRef} bill={bill} />
      </div>
    </>
  );
}
