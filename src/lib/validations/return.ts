import { z } from "zod";
import { PAYMENT_METHODS } from "@/lib/constants";

export const productReturnItemSchema = z.object({
  productId: z.string().min(1, "Product ID required"),
  returnPieces: z.coerce.number().positive("Return quantity must be greater than 0"),
  reason: z.string().optional(),
});

export const productReturnSchema = z.object({
  dispatchMongoId: z.string().min(1, "Bill select karein"),
  items: z.array(productReturnItemSchema).min(1, "At least one product return karein"),
  refundMethod: z.enum(["credit", "cash", "adjust_pending"]),
  refundMethodDetail: z
    .string()
    .optional()
    .transform((v) => v?.trim() || undefined),
  notes: z
    .string()
    .optional()
    .transform((v) => v?.trim() || undefined),
  returnDate: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : new Date())),
});

export const cashRefundDetailSchema = z.enum(PAYMENT_METHODS);
