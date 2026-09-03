/**
 * Copy all collections from old MongoDB cluster to new cluster.
 * Run: npm run migrate-db
 */
import mongoose from "mongoose";

const OLD_MONGODB_URI =
  process.env.OLD_MONGODB_URI ||
  "mongodb+srv://jindal:jindal123@cluster0.pvx4phw.mongodb.net/jindal-crm?retryWrites=true&w=majority&appName=Cluster0";

const NEW_MONGODB_URI =
  process.env.NEW_MONGODB_URI ||
  process.env.MONGODB_URI ||
  "mongodb+srv://crm:crm123@cluster0.v1fkaul.mongodb.net/jindal-crm?retryWrites=true&w=majority&appName=Cluster0";

async function migrate() {
  console.log("Connecting to OLD database...");
  const oldConn = mongoose.createConnection(OLD_MONGODB_URI);
  await oldConn.asPromise();

  console.log("Connecting to NEW database...");
  const newConn = mongoose.createConnection(NEW_MONGODB_URI);
  await newConn.asPromise();

  const oldDb = oldConn.db;
  const newDb = newConn.db;
  if (!oldDb || !newDb) {
    throw new Error("Database connection failed");
  }

  const collections = await oldDb.listCollections().toArray();
  const skip = new Set(["system.indexes", "system.profile"]);

  let totalDocs = 0;

  for (const { name } of collections) {
    if (skip.has(name) || name.startsWith("system.")) continue;

    const docs = await oldDb.collection(name).find({}).toArray();
    console.log(`\n${name}: ${docs.length} documents`);

    if (docs.length === 0) continue;

    await newDb.collection(name).deleteMany({});
    await newDb.collection(name).insertMany(docs, { ordered: false });
    totalDocs += docs.length;
    console.log(`  ✓ Copied to new cluster`);
  }

  console.log(`\nDone — ${totalDocs} total documents migrated.`);

  await oldConn.close();
  await newConn.close();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
