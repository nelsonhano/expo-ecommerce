import mongoose from "mongoose";
import { ENV } from "./env.js";

export const connectDB = async () => {
  if (!ENV.DB_URL || ENV.DB_URL.startsWith("<")) {
    console.warn("⚠️ MONGODB: DB_URL is not configured in backend/.env. Provide a valid MongoDB URI for database operations.");
    return;
  }
  try {
    const conn = await mongoose.connect(ENV.DB_URL);
    console.log(`✅ Connected to MONGODB: ${conn.connection.host}`);
  } catch (error) {
    console.error("💥 MONGODB connection error:", error.message);
    if (ENV.NODE_ENV === "production") {
      process.exit(1);
    }
  }
};
