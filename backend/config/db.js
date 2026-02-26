import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const connectDB = async () => {
  const primaryUri = process.env.MONGO_URI;
  const directUri = process.env.MONGO_URI_DIRECT;

  if (!primaryUri && !directUri) {
    console.error("❌ MongoDB connection failed: MONGO_URI or MONGO_URI_DIRECT is required");
    process.exit(1);
  }

  const connect = async (uri, label) => {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
    });
    console.log(`✅ MongoDB connected (${label})`);
  };

  try {
    await connect(primaryUri || directUri, "primary URI");
  } catch (error) {
    const srvLookupFailed =
      typeof error?.message === "string" &&
      error.message.includes("querySrv ECONNREFUSED");

    if (srvLookupFailed && directUri) {
      try {
        console.warn("⚠️ SRV DNS lookup failed, retrying with direct Atlas hosts...");
        await connect(directUri, "direct URI fallback");
        return;
      } catch (fallbackError) {
        console.error("❌ MongoDB direct fallback failed:", fallbackError.message);
        process.exit(1);
      }
    }

    console.error("❌ MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

export default connectDB;
