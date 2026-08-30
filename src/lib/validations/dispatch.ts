import { z } from "zod";
import { PAYMENT_METHODS } from "@/lib/constants";

export const dispatchItemSchema = z
  .object({
    productId: z.string().min(1),
    /** Legacy */
    sellMode: z.enum(["box", "piece", "mixed", "kg"]).optional(),
    unitType: z.enum(["pieces", "boxes", "kg"]).optional(),
    quantity: z.coerce.number().min(0).optional(),
    boxQty: z.coerce.number().min(0).default(0),
    pieceQty: z.coerce.number().min(0).default(0),
    kgQty: z.coerce.number().min(0).default(0),
    boxDiscount: z.coerce.number().min(0).default(0),
    pieceDiscount: z.coerce.number().min(0).default(0),
    kgDiscount: z.coerce.number().min(0).default(0),
    itemDiscount: z.coerce.number().min(0).default(0),
    unitPrice: z.coerce.number().min(0).optional(),
  })
  .superRefine((item, ctx) => {
    const boxQty = item.boxQty || (item.sellMode === "box" || item.unitType === "boxes" ? item.quantity : 0) || 0;
    const pieceQty =
      item.pieceQty || (item.sellMode === "piece" || item.unitType === "pieces" ? item.quantity : 0) || 0;
    const kgQty = item.kgQty || (item.sellMode === "kg" || item.unitType === "kg" ? item.quantity : 0) || 0;

    if (boxQty <= 0 && pieceQty <= 0 && kgQty <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter box, piece, or kg qty (at least one)",
      });
    }
  });

export const dispatchBillSchema = z.object({
  customerId: z.string().optional(),
  customerName: z.string().min(1, "Customer name is required"),
  customerCompany: z.string().optional(),
  customerPhone: z.string().optional(),
  customerAddress: z.string().optional(),
  customerCity: z.string().optional(),
  dispatchDate: z.string().optional(),
  orderType: z.enum(["immediate", "advance"]).default("immediate"),
  readyByDate: z.string().optional(),
  items: z.array(dispatchItemSchema).min(1, "Add at least one product"),
  discount: z.coerce.number().min(0).default(0),
  advance: z.coerce.number().min(0).default(0),
  paymentMode: z.enum(PAYMENT_METHODS).optional(),
  salespersonName: z.string().min(1, "Bill banane wale ka naam required hai").optional(),
  notes: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.orderType === "advance") {
    if (!data.readyByDate?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Advance order ke liye maal ready date required hai",
        path: ["readyByDate"],
      });
    }
    if ((data.advance || 0) <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Advance order me kam se kam kuch payment (advance) required hai",
        path: ["advance"],
      });
    }
  }
});

export type DispatchBillInput = z.infer<typeof dispatchBillSchema>;
