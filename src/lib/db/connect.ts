import dns from "dns";
import mongoose from "mongoose";

const FALLBACK_DNS = ["8.8.8.8", "8.8.4.4", "1.1.1.1"];

function getMongoUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Please define MONGODB_URI in your environment variables.");
  }
  if (uri.includes("@cluster.mongodb.net")) {
    throw new Error(
      "Invalid MONGODB_URI — replace cluster.mongodb.net with your actual Atlas cluster hostname."
    );
  }
  return uri;
}

/** Node on Windows often fails SRV lookup — retry with public DNS, then use standard URI */
async function resolveSrvRecords(srvHost: string) {
  try {
    return await dns.promises.resolveSrv(srvHost);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    const msg = err instanceof Error ? err.message : "";
    const isSrvFailure =
      code === "ECONNREFUSED" || code === "ENOTFOUND" || msg.includes("querySrv");
    if (!isSrvFailure) throw err;

    const original = dns.getServers();
    dns.setServers([...new Set([...original, ...FALLBACK_DNS])]);
    try {
      return await dns.promises.resolveSrv(srvHost);
    } finally {
      dns.setServers(original);
    }
  }
}

async function resolveMongoUri(uri: string): Promise<string> {
  if (!uri.startsWith("mongodb+srv://")) return uri;

  const match = uri.match(/^mongodb\+srv:\/\/([^/]+)@([^/?]+)(\/[^?]*)?(\?.*)?$/);
  if (!match) return uri;

  const [, credentials, clusterHost, dbPath = "", query = ""] = match;
  const records = await resolveSrvRecords(`_mongodb._tcp.${clusterHost}`);
  const hosts = records.map((r) => `${r.name}:${r.port}`).join(",");

  const params = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
  if (!params.has("ssl")) params.set("ssl", "true");
  if (!params.has("authSource")) params.set("authSource", "admin");

  const path = dbPath || "/";
  const qs = params.toString();
  return `mongodb://${credentials}@${hosts}${path}${qs ? `?${qs}` : ""}`;
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
  envUri: string | null;
  resolvedUri: string | null;
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongooseCache ?? {
  conn: null,
  promise: null,
  envUri: null,
  resolvedUri: null,
};

if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

function resetCache() {
  cached.conn = null;
  cached.promise = null;
  cached.envUri = null;
  cached.resolvedUri = null;
}

export async function connectDB(): Promise<typeof mongoose> {
  const envUri = getMongoUri();

  if (cached.envUri && cached.envUri !== envUri) {
    await mongoose.disconnect().catch(() => {});
    resetCache();
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.envUri = envUri;
    cached.promise = (async () => {
      const uri = cached.resolvedUri ?? (await resolveMongoUri(envUri));
      cached.resolvedUri = uri;
      return mongoose.connect(uri, {
        bufferCommands: false,
        family: 4,
        serverSelectionTimeoutMS: 15000,
      });
    })().catch((err) => {
      resetCache();
      throw err;
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
