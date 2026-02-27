import mongoose from "mongoose";
import Backup from "../../models/Backup.js";
import Record from "../../models/Record.js";
import Counselor from "../../models/Counselor.js";
import Admin from "../../models/Admin.js";
import GoogleUser from "../../models/GoogleUser.js";
import Report from "../../models/report.js";
import Notification from "../../models/Notification.js";
import ActivityLog from "../../models/ActivityLog.js";
import AuditLog from "../../models/AuditLog.js";
// Helper function to get admin info from request
const getAdminInfo = (req) => {
  const admin = req.admin || req.user;
  return {
    adminId: admin._id,
    adminModel: admin.constructor.modelName || "Admin",
    adminName: admin.name || "Unknown",
    adminEmail: admin.email || "unknown@example.com",
  };
};

// Helper function to generate backup ID
const generateBackupId = () => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `backup_${timestamp}_${random}`;
};

// Helper function to get collection size in bytes (approximate)
const getCollectionSize = async (model) => {
  try {
    const count = await model.countDocuments();
    // Rough estimate: average document size * count
    // This is approximate and may not be exact
    return count * 1024; // Assume average 1KB per document
  } catch (error) {
    console.error("Error calculating collection size:", error);
    return 0;
  }
};

// Helper function to copy collection data to backup collection
const copyCollectionToBackup = async (session, sourceModel, backupCollectionName) => {
  try {
    const sourceCollection = mongoose.connection.db.collection(sourceModel.collection.name);
    const backupCollection = mongoose.connection.db.collection(backupCollectionName);

    // Get all documents from source collection
    const documents = await sourceCollection.find({}).toArray();

    if (documents.length === 0) {
      return 0;
    }

    // Insert documents into backup collection within transaction
    if (documents.length > 0) {
      await backupCollection.insertMany(documents, { session });
    }

    return documents.length;
  } catch (error) {
    console.error(`Error copying collection ${sourceModel.collection.name}:`, error);
    throw error;
  }
};

// Create a new backup
export const createBackup = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  let backupId = null;
  let backup = null;

  try {
    const adminInfo = getAdminInfo(req);
    backupId = generateBackupId();
    const backupName = `Backup_${new Date().toISOString().replace(/[:.]/g, "-")}`;

    // Create backup metadata record
    backup = new Backup({
      backupId,
      backupName,
      status: "in_progress",
      createdBy: adminInfo,
      collections: [],
    });

    await backup.save({ session });

    // Collections to backup
    const collectionsToBackup = [
      { model: Record, name: "records", countField: "recordCount" },
      { model: User, name: "users", countField: "userCount" },
      { model: Admin, name: "admins", countField: "adminCount" },
      { model: GoogleUser, name: "googleusers", countField: null },
      { model: Report, name: "reports", countField: "reportCount" },
      { model: Notification, name: "notifications", countField: "notificationCount" },
      { model: ActivityLog, name: "activitylogs", countField: "activityLogCount" },
      { model: AuditLog, name: "auditlogs", countField: "auditLogCount" },
    ];

    let totalSize = 0;
    const backedUpCollections = [];

    // Backup each collection
    for (const { model, name, countField } of collectionsToBackup) {
      try {
        const backupCollectionName = `backup_${name}_${backupId}`;
        
        // Create collection if it doesn't exist (MongoDB will create it automatically on first insert)
        const count = await copyCollectionToBackup(session, model, backupCollectionName);
        
        backedUpCollections.push(backupCollectionName);
        
        if (countField && backup[countField] !== undefined) {
          backup[countField] = count;
        }

        // Estimate size
        const size = await getCollectionSize(model);
        totalSize += size;
      } catch (error) {
        console.error(`Error backing up ${name}:`, error);
        throw error;
      }
    }

    // Update backup metadata
    backup.status = "success";
    backup.backupSize = totalSize;
    backup.collections = backedUpCollections;
    
    await backup.save({ session });

    // Commit transaction
    await session.commitTransaction();

    // Log the backup activity
    try {
      await AuditLog.create({
        actorAdminId: adminInfo.adminId,
        actorModel: adminInfo.adminModel,
        actorName: adminInfo.adminName,
        actorEmail: adminInfo.adminEmail,
        targetUserId: adminInfo.adminId,
        targetModel: adminInfo.adminModel,
        targetUserName: adminInfo.adminName,
        targetUserEmail: adminInfo.adminEmail,
        action: "user_update", // Using existing action type
        changedPermissions: {},
        ipAddress: req.ip || req.connection?.remoteAddress || req.headers["x-forwarded-for"]?.split(",")[0],
        userAgent: req.headers["user-agent"],
        metadata: {
          backupId,
          backupName,
          backupSize: totalSize,
          collections: backedUpCollections,
        },
      });
    } catch (auditError) {
      console.error("⚠️ Error creating audit log (non-critical):", auditError);
    }

    res.status(201).json({
      success: true,
      message: "Backup created successfully",
      backup: {
        backupId: backup.backupId,
        backupName: backup.backupName,
        status: backup.status,
        createdAt: backup.createdAt,
        backupSize: backup.backupSize,
        recordCount: backup.recordCount,
        userCount: backup.userCount,
        adminCount: backup.adminCount,
        reportCount: backup.reportCount,
        notificationCount: backup.notificationCount,
        activityLogCount: backup.activityLogCount,
        auditLogCount: backup.auditLogCount,
      },
    });
  } catch (error) {
    // Rollback transaction
    await session.abortTransaction();

    console.error("❌ Error creating backup:", error);

    // Update backup status to failed if it was created
    if (backup) {
      try {
        backup.status = "failed";
        backup.errorMessage = error.message;
        await backup.save();
      } catch (saveError) {
        console.error("Error updating backup status:", saveError);
      }
    }

    res.status(500).json({
      success: false,
      message: "Failed to create backup",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

// Get all backups
export const getAllBackups = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {};
    if (status) {
      query.status = status;
    }

    const backups = await Backup.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select("-__v")
      .lean();

    const total = await Backup.countDocuments(query);

    // Format backups for response
    const formattedBackups = backups.map((backup) => ({
      backupId: backup.backupId,
      backupName: backup.backupName,
      status: backup.status,
      createdAt: backup.createdAt,
      backupSize: backup.backupSize,
      recordCount: backup.recordCount,
      userCount: backup.userCount,
      adminCount: backup.adminCount,
      reportCount: backup.reportCount,
      notificationCount: backup.notificationCount,
      activityLogCount: backup.activityLogCount,
      auditLogCount: backup.auditLogCount,
      createdBy: backup.createdBy,
      restoredAt: backup.restoredAt,
      restoredBy: backup.restoredBy,
      errorMessage: backup.errorMessage,
    }));

    res.status(200).json({
      success: true,
      backups: formattedBackups,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("❌ Error fetching backups:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch backups",
      error: error.message,
    });
  }
};

// Get single backup details
export const getBackupById = async (req, res) => {
  try {
    const { backupId } = req.params;

    const backup = await Backup.findOne({ backupId }).lean();

    if (!backup) {
      return res.status(404).json({
        success: false,
        message: "Backup not found",
      });
    }

    res.status(200).json({
      success: true,
      backup,
    });
  } catch (error) {
    console.error("❌ Error fetching backup:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch backup",
      error: error.message,
    });
  }
};

// Restore from backup
export const restoreBackup = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { backupId } = req.params;
    const adminInfo = getAdminInfo(req);

    // Find backup
    const backup = await Backup.findOne({ backupId });

    if (!backup) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Backup not found",
      });
    }

    if (backup.status !== "success") {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Cannot restore from a failed or incomplete backup",
      });
    }

    // Collections mapping
    const collectionMapping = [
      { model: Record, name: "records" },
      { model: User, name: "users" },
      { model: Admin, name: "admins" },
      { model: GoogleUser, name: "googleusers" },
      { model: Report, name: "reports" },
      { model: Notification, name: "notifications" },
      { model: ActivityLog, name: "activitylogs" },
      { model: AuditLog, name: "auditlogs" },
    ];

    // Restore each collection
    for (const { model, name } of collectionMapping) {
      try {
        const backupCollectionName = `backup_${name}_${backupId}`;
        const backupCollection = mongoose.connection.db.collection(backupCollectionName);
        const mainCollection = mongoose.connection.db.collection(model.collection.name);

        // Check if backup collection exists
        const collections = await mongoose.connection.db.listCollections().toArray();
        const backupExists = collections.some((col) => col.name === backupCollectionName);

        if (!backupExists) {
          console.warn(`Backup collection ${backupCollectionName} not found, skipping...`);
          continue;
        }

        // Get all documents from backup collection
        const documents = await backupCollection.find({}).toArray();

        if (documents.length === 0) {
          continue;
        }

        // Delete existing documents in main collection (within transaction)
        await mainCollection.deleteMany({}, { session });

        // Insert documents from backup (within transaction)
        if (documents.length > 0) {
          await mainCollection.insertMany(documents, { session });
        }
      } catch (error) {
        console.error(`Error restoring collection ${name}:`, error);
        throw error;
      }
    }

    // Update backup metadata
    backup.status = "success";
    backup.restoredAt = new Date();
    backup.restoredBy = adminInfo;
    
    await backup.save({ session });

    // Commit transaction
    await session.commitTransaction();

    // Log the restore activity
    try {
      await AuditLog.create({
        actorAdminId: adminInfo.adminId,
        actorModel: adminInfo.adminModel,
        actorName: adminInfo.adminName,
        actorEmail: adminInfo.adminEmail,
        targetUserId: adminInfo.adminId,
        targetModel: adminInfo.adminModel,
        targetUserName: adminInfo.adminName,
        targetUserEmail: adminInfo.adminEmail,
        action: "user_update", // Using existing action type
        changedPermissions: {},
        ipAddress: req.ip || req.connection?.remoteAddress || req.headers["x-forwarded-for"]?.split(",")[0],
        userAgent: req.headers["user-agent"],
        metadata: {
          backupId,
          backupName: backup.backupName,
          restoredAt: new Date(),
        },
      });
    } catch (auditError) {
      console.error("⚠️ Error creating audit log (non-critical):", auditError);
    }

    res.status(200).json({
      success: true,
      message: "Backup restored successfully",
      backup: {
        backupId: backup.backupId,
        backupName: backup.backupName,
        restoredAt: backup.restoredAt,
      },
    });
  } catch (error) {
    // Rollback transaction
    await session.abortTransaction();

    console.error("❌ Error restoring backup:", error);

    res.status(500).json({
      success: false,
      message: "Failed to restore backup",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

// Delete backup
export const deleteBackup = async (req, res) => {
  try {
    const { backupId } = req.params;
    const adminInfo = getAdminInfo(req);

    // Find backup
    const backup = await Backup.findOne({ backupId });

    if (!backup) {
      return res.status(404).json({
        success: false,
        message: "Backup not found",
      });
    }

    // Delete backup collections
    for (const collectionName of backup.collections || []) {
      try {
        await mongoose.connection.db.collection(collectionName).drop();
      } catch (error) {
        console.warn(`Error deleting backup collection ${collectionName}:`, error.message);
      }
    }

    // Delete backup metadata
    await Backup.deleteOne({ backupId });

    // Log the deletion
    try {
      await AuditLog.create({
        actorAdminId: adminInfo.adminId,
        actorModel: adminInfo.adminModel,
        actorName: adminInfo.adminName,
        actorEmail: adminInfo.adminEmail,
        targetUserId: adminInfo.adminId,
        targetModel: adminInfo.adminModel,
        targetUserName: adminInfo.adminName,
        targetUserEmail: adminInfo.adminEmail,
        action: "user_delete", // Using existing action type
        changedPermissions: {},
        ipAddress: req.ip || req.connection?.remoteAddress || req.headers["x-forwarded-for"]?.split(",")[0],
        userAgent: req.headers["user-agent"],
        metadata: {
          backupId,
          backupName: backup.backupName,
        },
      });
    } catch (auditError) {
      console.error("⚠️ Error creating audit log (non-critical):", auditError);
    }

    res.status(200).json({
      success: true,
      message: "Backup deleted successfully",
    });
  } catch (error) {
    console.error("❌ Error deleting backup:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete backup",
      error: error.message,
    });
  }
};

