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
} from "@/lib/bill-export";
import { uploadDispatchFile } from "@/lib/cloudinary-upload-client";
import { Download, MessageCircle } from "lucide-react";

interface BillExportActionsProps {
  bill: BillData;
  dispatchMongoId?: string;
  whatsappNumber?: string;
  compact?: boolean;
  /** Final bill export (default) or original dispatch bill */
  variant?: "final" | "dispatch";
}

async function archiveBillOnCloudinary(
  dispatchMongoId: string | undefined,
  file: Blob,
  filename: string,
  fileType: "bill-pdf" | "bill-image" | "dispatch-bill-pdf" | "dispatch-bill-image"
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
  variant = "final",
}: BillExportActionsProps) {
  const billRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const isDispatch = variant === "dispatch";
  const pdfFileType = isDispatch ? "dispatch-bill-pdf" : "bill-pdf";
  const imageFileType = isDispatch ? "dispatch-bill-image" : "bill-image";

  const handleDownloadPDF = async () => {
    if (!billRef.current) {
      toast("Bill load nahi hui", "error");
      return;
    }
    setExporting(true);
    try {
      const filename = `${isDispatch ? "dispatch" : bill.billType}-${bill.billId}.pdf`;
      const blob = await billElementToPDF(billRef.current, filename);
      await archiveBillOnCloudinary(dispatchMongoId, blob, filename, pdfFileType);
      toast(
        isDispatch
          ? "Dispatch bill PDF download + Cloudinary par save ho gayi"
          : "PDF download + Cloudinary par save ho gayi",
        "success"
      );
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
      const imageFilename = `${bill.billId}-${isDispatch ? "dispatch" : "bill"}.png`;
      const imageBlob = await billElementToImage(billRef.current);
      await archiveBillOnCloudinary(dispatchMongoId, imageBlob, imageFilename, imageFileType);
      await shareBillImageWhatsApp(
        billRef.current,
        whatsappNumber,
        imageFilename,
        imageBlob
      );
      toast("Bill image WhatsApp par share karein (sirf photo jayegi)", "success");
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
          title={isDispatch ? "Download Dispatch PDF" : "Download PDF"}
        >
          <Download className="h-4 w-4" />
          {!compact &&
            (exporting
              ? " Generating..."
              : isDispatch
                ? " Download Dispatch PDF"
                : " Download PDF")}
        </Button>
        <Button
          variant={compact ? "ghost" : "gold"}
          size={compact ? "sm" : "default"}
          onClick={handleWhatsApp}
          disabled={exporting}
          title={isDispatch ? "Send Dispatch Bill on WhatsApp" : "Send on WhatsApp"}
        >
          <MessageCircle className="h-4 w-4" />
          {!compact &&
            (exporting
              ? " Please wait..."
              : isDispatch
                ? " Dispatch WhatsApp"
                : " Send on WhatsApp")}
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
