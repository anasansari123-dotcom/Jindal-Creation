export const PERMISSIONS = [
  "dashboard",
  "customers",
  "products",
  "inventory",
  "orders",
  "sales",
  "payments",
  "dispatch",
  "reports",
  "users",
  "settings",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "VERIFIED",
  "DISPATCHED",
  "COMPLETED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ["UNPAID", "PARTIAL", "PAID"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = [
  "Cash",
  "UPI",
  "Bank Transfer",
  "Cheque",
  "Other",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Map stored/display payment labels to a valid bill payment method */
export function normalizePaymentMode(mode?: string | null): PaymentMethod {
  if (mode && (PAYMENT_METHODS as readonly string[]).includes(mode)) {
    return mode as PaymentMethod;
  }
  return "Cash";
}

export const INVENTORY_TRANSACTION_TYPES = [
  "STOCK_IN",
  "SALE",
  "ADJUSTMENT",
  "RETURN",
] as const;

export type InventoryTransactionType =
  (typeof INVENTORY_TRANSACTION_TYPES)[number];

export const ACTIVITY_ACTIONS = [
  "Admin Login",
  "Customer Created",
  "Customer Updated",
  "Product Created",
  "Product Updated",
  "Stock Added",
  "Stock Adjusted",
  "Order Created",
  "Order Updated",
  "Order Verified",
  "Order Dispatched",
  "Order Confirmed",
  "Confirm Bill Generated",
  "Payment Added",
  "Admin Created",
  "Admin Updated",
  "Permission Updated",
] as const;

export const DEFAULT_CATEGORIES = [
  "PVC Stock",
  "PVC Panels",
  "Home Decor",
  "Interior Products",
  "Other",
];

export const BRAND = {
  name: "Jindal Creation",
  tagline: "PVC Panels | Home Decor",
  slogan: "Designing Spaces, Defining Style",
};

/** Brand aliases — used in schema markup & on-page SEO */
export const SEO_ALTERNATE_NAMES = [
  "Jindal MZN",
  "Jindal Muzaffarnagar",
  "Jindal Creation MZN",
  "Jindal Creation Muzaffarnagar",
  "Jindal PVC Muzaffarnagar",
  "Jindal Home Decor Muzaffarnagar",
] as const;

/** Local SEO — Muzaffarnagar (update street address in Admin if needed) */
export const LOCAL_BUSINESS = {
  address: {
    street: "Muzaffarnagar",
    city: "Muzaffarnagar",
    state: "Uttar Pradesh",
    pincode: "251001",
    country: "India",
  },
  geo: {
    lat: 29.4727,
    lng: 77.7085,
  },
  phoneDisplay: "+91 95480 00895",
  phoneE164: "919548000895",
  email: "admin@jindalcreation.com",
  googleMapsQuery: "Jindal Creation Muzaffarnagar",
  serviceAreas: [
    "Muzaffarnagar",
    "Saharanpur",
    "Meerut",
    "Shamli",
    "Bijnor",
    "Deoband",
  ],
  services: [
    "PVC Panels",
    "PVC Stock",
    "Home Decor",
    "Interior Products",
    "Wholesale Supply",
  ],
  sameAs: [
    "https://www.google.com/maps/search/?api=1&query=Jindal+Creation+Muzaffarnagar",
  ] as string[],
};

export const DEFAULT_WHATSAPP_NUMBER = "919548000895";
export const DEFAULT_WHATSAPP_DISPLAY = "+91 95480 00895";
