import { z } from "zod";
import { PERMISSIONS, ORDER_STATUSES, PAYMENT_METHODS } from "@/lib/constants";

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const customerSchema = z.object({
  name: z.string().min(1, "Customer name is required"),
  companyName: z.string().optional(),
  phone: z.string().min(10, "Valid phone number is required"),
  whatsappNumber: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  gstNumber: z.string().optional(),
  notes: z.string().optional(),
});

export const quickProductSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  productId: z
    .string()
    .min(1, "Product number is required")
    .max(32)
    .transform((v) => v.trim()),
  category: z.string().min(1, "Category is required"),
  sellingUnit: z.enum(["box", "piece", "kg"]).default("box"),
  sellingPrice: z.coerce.number().min(0),
  piecesPerBox: z.coerce.number().min(1).default(1),
});

export const productSchema = z.object({
  productId: z
    .string()
    .min(1, "Product number is required")
    .max(32, "Product number is too long")
    .transform((v) => v.trim()),
  name: z.string().min(1, "Product name is required"),
  category: z.string().min(1, "Category is required"),
  description: z.string().optional(),
  unit: z.string().min(1, "Unit is required"),
  sellingUnit: z.enum(["box", "piece", "kg"]).default("box"),
  price: z.coerce.number().min(0),
  costPrice: z.coerce.number().min(0),
  sellingPrice: z.coerce.number().min(0),
  piecesPerBox: z.coerce.number().min(1),
  minimumStock: z.coerce.number().min(0),
  currentStock: z.coerce.number().min(0).optional(),
  stockUnit: z.enum(["pieces", "boxes", "kg"]).optional(),
  status: z.enum(["active", "inactive"]).default("active"),
});

export const stockAdjustmentSchema = z.object({
  productId: z.string().min(1),
  type: z.enum(["STOCK_IN", "ADJUSTMENT", "RETURN"]),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
  stockUnit: z.enum(["pieces", "boxes", "kg"]).optional().default("pieces"),
  notes: z.string().optional(),
});

export const stockInDeliverySchema = z.object({
  label: z.string().optional(),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
  stockUnit: z.enum(["pieces", "boxes", "kg"]).default("boxes"),
});

export const stockInBatchSchema = z.object({
  productId: z.string().min(1),
  deliveries: z.array(stockInDeliverySchema).min(1, "At least one delivery entry required"),
  notes: z.string().optional(),
});

export const orderItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().min(1),
  unitPrice: z.coerce.number().min(0),
  discount: z.coerce.number().min(0).default(0),
});

export const orderSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  orderDate: z.string().optional(),
  items: z.array(orderItemSchema).min(1, "At least one product is required"),
  discount: z.coerce.number().min(0).default(0),
  advance: z.coerce.number().min(0).default(0),
  notes: z.string().optional(),
  status: z.enum(ORDER_STATUSES).optional(),
});

export const paymentSchema = z.object({
  orderId: z.string().min(1).optional(),
  customerId: z.string().min(1).optional(),
  amount: z.coerce.number().min(1, "Amount must be greater than 0"),
  date: z.string().optional(),
  method: z.enum(PAYMENT_METHODS),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
}).refine((d) => d.orderId || d.customerId, {
  message: "Order or customer is required",
});

export const userSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  password: z
    .string()
    .refine((val) => val === "" || val.length >= 6, "Password must be at least 6 characters")
    .optional(),
  role: z.enum(["MAIN_ADMIN", "STAFF_ADMIN"]),
  permissions: z.array(z.enum(PERMISSIONS)).default([]),
  isActive: z.boolean().default(true),
});

export const createUserSchema = userSchema.extend({
  password: z.string().min(6, "Password must be at least 6 characters"),
}).superRefine((data, ctx) => {
  if (data.role === "STAFF_ADMIN" && data.permissions.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Select at least one permission for Staff Admin",
      path: ["permissions"],
    });
  }
});

export const settingsSchema = z.object({
  whatsappNumber: z.string().optional(),
  companyName: z.string().optional(),
  companyTagline: z.string().optional(),
  categories: z.array(z.string()).optional(),
});

export const verificationSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string(),
      productVerified: z.boolean(),
      quantityVerified: z.boolean(),
      priceVerified: z.boolean(),
    })
  ),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type CustomerInput = z.infer<typeof customerSchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type OrderInput = z.infer<typeof orderSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
export type UserInput = z.infer<typeof userSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
