/**
 * Jindal Creation CRM — Clean reset for client delivery
 * Wipes all business data; keeps only 2 users + default settings.
 * Run: npm run seed
 */
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import mongoose from "mongoose";
import {
  User,
  Customer,
  Product,
  Order,
  Dispatch,
  ConfirmBill,
  Payment,
  InventoryTransaction,
  ActivityLog,
  Settings,
} from "../src/lib/models";
import { DEFAULT_CATEGORIES } from "../src/lib/constants";

dotenv.config({ path: ".env.local" });

const MONGODB_URI = process.env.MONGODB_URI;

async function seed() {
  if (!MONGODB_URI) {
    console.error("MONGODB_URI not set in .env.local");
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB");

  await Promise.all([
    User.deleteMany({}),
    Customer.deleteMany({}),
    Product.deleteMany({}),
    Order.deleteMany({}),
    Dispatch.deleteMany({}),
    ConfirmBill.deleteMany({}),
    Payment.deleteMany({}),
    InventoryTransaction.deleteMany({}),
    ActivityLog.deleteMany({}),
    Settings.deleteMany({}),
  ]);
  console.log("✓ Cleared all CRM data");

  const mainAdminPassword = process.env.MAIN_ADMIN_PASSWORD || "Admin@123";
  const staffAdminPassword = process.env.STAFF_ADMIN_PASSWORD || "Staff@123";

  const mainAdmin = await User.create({
    name: process.env.MAIN_ADMIN_NAME || "Saksham Jindal",
    email: (process.env.MAIN_ADMIN_EMAIL || "admin@jindalcreation.com").toLowerCase(),
    password: await bcrypt.hash(mainAdminPassword, 12),
    role: "MAIN_ADMIN",
    permissions: [],
    isActive: true,
  });

  const staffAdmin = await User.create({
    name: process.env.STAFF_ADMIN_NAME || "Yash Dhiman",
    email: (process.env.STAFF_ADMIN_EMAIL || "staff@jindalcreation.com").toLowerCase(),
    password: await bcrypt.hash(staffAdminPassword, 12),
    role: "STAFF_ADMIN",
    permissions: [
      "dashboard",
      "customers",
      "products",
      "inventory",
      "orders",
      "sales",
      "payments",
      "dispatch",
      "reports",
    ],
    isActive: true,
  });
  console.log("✓ Users created");

  await Settings.create([
    { key: "whatsappNumber", value: process.env.WHATSAPP_NUMBER || "919548000895" },
    { key: "companyName", value: process.env.COMPANY_NAME || "Jindal Creation" },
    { key: "companyTagline", value: process.env.COMPANY_TAGLINE || "PVC Panels | Home Decor" },
    { key: "categories", value: DEFAULT_CATEGORIES },
  ]);
  console.log("✓ Default settings created");

  await ActivityLog.create({
    userId: mainAdmin._id,
    userName: mainAdmin.name,
    action: "System Reset",
    details: "CRM reset for client delivery — clean slate",
    createdAt: new Date(),
  });

  console.log("\n══════════════════════════════════════════");
  console.log("  JINDAL CREATION CRM — CLEAN DELIVERY READY");
  console.log("══════════════════════════════════════════");
  console.log("\n📋 Login Credentials:");
  console.log(`   Admin : ${mainAdmin.name} — ${mainAdmin.email} / ${mainAdminPassword}`);
  console.log(`   Staff : ${staffAdmin.name} — ${staffAdmin.email} / ${staffAdminPassword}`);
  console.log("\n📦 Data:");
  console.log("   Products   : 0");
  console.log("   Customers  : 0");
  console.log("   Orders     : 0");
  console.log("   Dispatch   : 0");
  console.log("   Payments   : 0");
  console.log("   Inventory  : 0");
  console.log("══════════════════════════════════════════\n");

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
