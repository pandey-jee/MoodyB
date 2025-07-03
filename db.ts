import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL;

if (!MONGODB_URI) {
  console.warn(
    "⚠️  MONGODB_URI not set. Database operations will fail. Please check your .env file."
  );
  console.warn("   Copy .env.example to .env and configure your MongoDB connection.");
}

let isConnected = false;

export async function connectToDatabase() {
  if (isConnected) {
    return;
  }

  if (!MONGODB_URI) {
    throw new Error("MongoDB connection string not provided. Please set MONGODB_URI in your .env file.");
  }

  try {
    await mongoose.connect(MONGODB_URI);
    isConnected = true;
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }
}

export function ensureDatabaseConnection() {
  if (!isConnected) {
    throw new Error("Database not connected. Please ensure MongoDB connection is established.");
  }
}