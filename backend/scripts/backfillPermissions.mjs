import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const Counselor = (await import("../models/Counselor.js")).default;
const GoogleUser = (await import("../models/GoogleUser.js")).default;
const Admin = (await import("../models/Admin.js")).default;

const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!uri) {
  console.error("Missing MONGO_URI or MONGODB_URI in environment.");
  process.exit(1);
}

const counselorDefaults = {
  can_view_records: true,
  can_edit_records: true,
  can_view_reports: true,
  can_generate_reports: false,
  is_admin: false,
};

const adminDefaults = {
  can_view_records: true,
  can_edit_records: true,
  can_view_reports: true,
  can_generate_reports: true,
  is_admin: true,
};

const fillPermissions = (doc, defaults) => {
  const current = doc.permissions && typeof doc.permissions === "object" ? doc.permissions : {};
  let changed = false;
  for (const [key, value] of Object.entries(defaults)) {
    if (typeof current[key] !== "boolean") {
      current[key] = value;
      changed = true;
    }
  }
  doc.permissions = current;
  return changed;
};

async function backfillModel(Model, defaults, modelName) {
  let updated = 0;
  const cursor = Model.find({}).cursor();
  for await (const doc of cursor) {
    if (fillPermissions(doc, defaults)) {
      await doc.save();
      updated += 1;
    }
  }
  console.log(`[permissions-backfill] ${modelName}: updated ${updated}`);
}

async function main() {
  await mongoose.connect(uri);
  console.log("[permissions-backfill] connected");

  await backfillModel(Counselor, counselorDefaults, "Counselor");
  await backfillModel(GoogleUser, counselorDefaults, "GoogleUser");
  await backfillModel(Admin, adminDefaults, "Admin");

  await mongoose.disconnect();
  console.log("[permissions-backfill] complete");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

