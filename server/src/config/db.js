import mongoose from 'mongoose';
import { env } from './env.js';

let connection = null;

// Vercel reuses warm lambdas, so cache the connection instead of dialling per request.
export async function connectDatabase() {
  if (connection) return connection;
  mongoose.set('strictQuery', true);
  connection = await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: 10000,
  });
  return connection;
}
