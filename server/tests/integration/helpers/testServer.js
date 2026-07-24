import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

let mongod = null;
let started = false;

/**
 * Starts an in-memory MongoDB instance, points MONGODB_URI at it, and
 * connects Mongoose directly so collections are ready before any test runs
 * (the app itself only connects lazily on the first HTTP request).
 */
export async function startTestDb() {
  if (started) return;
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  process.env.MONGODB_URI = uri;
  process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";
  process.env.CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";
  process.env.NODE_ENV = "test";

  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });

  started = true;
}

export async function stopTestDb() {
  await mongoose.connection.close();
  if (mongod) await mongod.stop();
  started = false;
}

/** Wipes all collections between tests so each test starts from a clean slate. */
export async function clearDatabase() {
  const collections = mongoose.connection.collections;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
}