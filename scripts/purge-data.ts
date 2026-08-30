/**
 * Remove all CRM business data — keeps User accounts (login) only.
 * Run: npm run purge-data
 */
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

dotenv.config({ path: ".env.local" });

const MONGODB_URI = process.env.MONGODB_URI;

async function purgeData() {
  if (!MONGODB_URI) {
    console.error("MONGODB_URI not set in .env.local");
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB");

  const userCount = await User.countDocuments();

  const results = await Promise.all([
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

  const deleted = {
    customers: results[0].deletedCount,
    products: results[1].deletedCount,
    orders: results[2].deletedCount,
    dispatches: results[3].deletedCount,
    confirmBills: results[4].deletedCount,
    payments: results[5].deletedCount,
    inventoryTransactions: results[6].deletedCount,
    activityLogs: results[7].deletedCount,
    settings: results[8].deletedCount,
  };

  console.log("\n✓ Business data removed:");
  console.log(`   Customers            : ${deleted.customers}`);
  console.log(`   Products             : ${deleted.products}`);
  console.log(`   Orders               : ${deleted.orders}`);
  console.log(`   Dispatch bills       : ${deleted.dispatches}`);
  console.log(`   Confirm bills        : ${deleted.confirmBills}`);
  console.log(`   Payments             : ${deleted.payments}`);
  console.log(`   Inventory txns       : ${deleted.inventoryTransactions}`);
  console.log(`   Activity logs        : ${deleted.activityLogs}`);
  console.log(`   Settings             : ${deleted.settings}`);
  console.log(`\n✓ Users kept           : ${userCount}`);

  const users = await User.find({}, "name email role isActive").lean();
  if (users.length === 0) {
    console.warn("\n⚠ No users found — run npm run seed to create login accounts.");
  } else {
    console.log("\n📋 Login accounts:");
    for (const u of users) {
      console.log(`   • ${u.name} (${u.email}) — ${u.role}${u.isActive ? "" : " [inactive]"}`);
    }
  }

  console.log("\nDone.\n");
  await mongoose.disconnect();
}

purgeData().catch((err) => {
  console.error("Purge failed:", err);
  process.exit(1);
});
