"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { uploadDispatchFile } from "@/lib/cloudinary-upload-client";
import { Camera, Loader2, Trash2, Upload } from "lucide-react";

interface BillLoadPhotoUploadProps {
  dispatchId: string;
  photoUrl: string;
  onPhotoChange: (url: string) => void;
  disabled?: boolean;
}

export function BillLoadPhotoUpload({
  dispatchId,
  photoUrl,
  onPhotoChange,
  disabled = false,
}: BillLoadPhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File | null) => {
    if (!file || disabled) return;

    if (!file.type.startsWith("image/")) {
      toast("Sirf image file select karein", "error");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast("Image 8MB se chhoti honi chahiye", "error");
      return;
    }

    setUploading(true);
    try {
      const result = await uploadDispatchFile({
        dispatchId,
        file,
        filename: file.name || "load-photo.jpg",
        fileType: "load-photo",
        mimeType: file.type,
      });
      onPhotoChange(result.url);
      toast("Gadi load photo Cloudinary par save ho gayi", "success");
    } catch {
      toast("Photo upload fail — dubara try karein", "error");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <Label>Gadi Me Maal Load Photo (Final Bill par dikhega)</Label>
        <p className="text-xs text-gray-500 mt-1">
          Photo Cloudinary par save hogi — bill PDF / WhatsApp me bhi dikhegi
        </p>
      </div>

      {photoUrl ? (
        <div className="relative rounded-lg border overflow-hidden bg-gray-50 max-w-md">
          <Image
            src={photoUrl}
            alt="Gadi load photo"
            width={480}
            height={320}
            className="w-full h-auto max-h-64 object-contain"
            unoptimized
          />
          {!disabled && (
            <div className="absolute top-2 right-2 flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="bg-white/90"
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Change
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="bg-white/90 text-red-600"
                disabled={uploading}
                onClick={() => onPhotoChange("")}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 w-full max-w-md h-36 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 hover:border-gold hover:bg-gold/5 transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="h-8 w-8 text-gold animate-spin" />
          ) : (
            <Camera className="h-8 w-8 text-gray-400" />
          )}
          <span className="text-sm text-gray-600">
            {uploading ? "Cloudinary par upload ho rahi hai..." : "Photo click karein ya gallery se choose karein"}
          </span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        disabled={disabled || uploading}
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}
