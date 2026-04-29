/**
 * One-time migration: populate problemsPresentedCodes + problemsPresentedNotes
 * from legacy problemsPresented string on all counseling records.
 *
 * Usage (from backend/):
 *   node scripts/migrateProblemsPresentedFields.mjs
 *
 * Requires MONGO_URI or MONGODB_URI in .env (same as the app).
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const Record = (await import("../models/Record.js")).default;
const {
  parseProblemsPresentedParts,
  mergeProblemsPresented,
} = await import("../utils/problemsPresented.js");

const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!uri) {
  console.error("Missing MONGO_URI or MONGODB_URI in environment.");
  process.exit(1);
}

async function main() {
  await mongoose.connect(uri);
  const total = await Record.countDocuments({});
  let updated = 0;

  const cursor = Record.find({}).cursor();
  for await (const doc of cursor) {
    const raw = doc.problemsPresented || "";
    const { codes, rest } = parseProblemsPresentedParts(raw);
    doc.set("problemsPresentedCodes", codes);
    doc.set("problemsPresentedNotes", rest);
    doc.set("problemsPresented", mergeProblemsPresented(codes, rest));
    await doc.save();
    updated++;
    if (updated % 100 === 0) {
      console.log(`… ${updated} / ${total}`);
    }
  }

  console.log(`Done. Migrated ${updated} record(s).`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
