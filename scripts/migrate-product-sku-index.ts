/**
 * Migration: product name and number may both repeat.
 * Drops legacy unique indexes; syncs current non-unique indexes.
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDB } from "../src/lib/db/connect";
import { Product } from "../src/lib/models/Product";

dotenv.config({ path: ".env.local" });

async function dropIndexIfExists(collection: mongoose.mongo.Collection, name: string) {
  try {
    await collection.dropIndex(name);
    console.log(`Dropped index ${name}`);
  } catch {
    /* index may not exist */
  }
}

async function main() {
  await connectDB();
  const collection = mongoose.connection.collection("products");

  await dropIndexIfExists(collection, "productId_1");
  await dropIndexIfExists(collection, "category_1_productId_1");
  await dropIndexIfExists(collection, "name_1");

  await Product.syncIndexes();
  console.log("Product indexes synced (name and product number may repeat).");
  console.log(
    (await collection.indexes())
      .map((idx) => `${idx.name}: ${JSON.stringify(idx.key)} unique=${!!idx.unique}`)
      .join("\n")
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
