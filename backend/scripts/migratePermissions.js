/**
 * Migration Script: Add RBAC Permissions to Existing Users
 * 
 * This script adds default permissions to all existing users in the database.
 * Run this script once after deploying the RBAC feature.
 * 
 * Usage (from project root):
 *   node backend/scripts/migratePermissions.js
 * 
 * Loads .env from backend folder. Uses MONGO_URI or MONGODB_URI.
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

import mongoose from "mongoose";
import Counselor from "../models/Counselor.js";
import GoogleUser from "../models/GoogleUser.js";
import Admin from "../models/Admin.js";

const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://localhost:27017/counseling_db";

async function migratePermissions() {
  try {
    console.log("🔄 Starting permissions migration...");
    console.log(`📡 Connecting to MongoDB: ${MONGODB_URI.replace(/\/\/.*@/, "//***@")}`);

    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    let migratedCount = 0;
    let skippedCount = 0;

    // Migrate regular Users
    console.log("\n📋 Migrating User collection...");
    const users = await Counselor.find({});
    for (const user of users) {
      if (!user.permissions) {
        user.permissions = {};
      }

      const isAdmin = user.role === "admin";

      // Set default permissions based on role
      user.permissions.can_view_records = user.permissions.can_view_records ?? (isAdmin ? true : true);
      user.permissions.can_edit_records = user.permissions.can_edit_records ?? (isAdmin ? true : true);
      user.permissions.can_view_reports = user.permissions.can_view_reports ?? (isAdmin ? true : true);
      user.permissions.can_generate_reports = user.permissions.can_generate_reports ?? (isAdmin ? true : false);
      user.permissions.is_admin = user.permissions.is_admin ?? isAdmin;

      await user.save();
      migratedCount++;
      console.log(`  ✓ Updated user: ${user.email} (${user.role})`);
    }

    // Migrate GoogleUsers
    console.log("\n📋 Migrating GoogleUser collection...");
    const googleUsers = await GoogleUser.find({});
    for (const googleUser of googleUsers) {
      if (!googleUser.permissions) {
        googleUser.permissions = {};
      }

      const isAdmin = googleUser.role === "admin";

      googleUser.permissions.can_view_records = googleUser.permissions.can_view_records ?? (isAdmin ? true : true);
      googleUser.permissions.can_edit_records = googleUser.permissions.can_edit_records ?? (isAdmin ? true : true);
      googleUser.permissions.can_view_reports = googleUser.permissions.can_view_reports ?? (isAdmin ? true : true);
      googleUser.permissions.can_generate_reports = googleUser.permissions.can_generate_reports ?? (isAdmin ? true : false);
      googleUser.permissions.is_admin = googleUser.permissions.is_admin ?? isAdmin;

      await googleUser.save();
      migratedCount++;
      console.log(`  ✓ Updated Google user: ${googleUser.email} (${googleUser.role})`);
    }

    // Migrate Admins
    console.log("\n📋 Migrating Admin collection...");
    const admins = await Admin.find({});
    for (const admin of admins) {
      if (!admin.permissions) {
        admin.permissions = {};
      }

      // Admins always have all permissions
      admin.permissions.can_view_records = true;
      admin.permissions.can_edit_records = true;
      admin.permissions.can_view_reports = true;
      admin.permissions.can_generate_reports = true;
      admin.permissions.is_admin = true;

      await admin.save();
      migratedCount++;
      console.log(`  ✓ Updated admin: ${admin.email}`);
    }

    console.log(`\n✅ Migration completed successfully!`);
    console.log(`   - Migrated: ${migratedCount} users`);
    console.log(`   - Skipped: ${skippedCount} users`);
    console.log(`\n💡 All users now have default permissions set.`);

    // Close connection
    await mongoose.connection.close();
    console.log("✅ Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

// Run migration
migratePermissions();


