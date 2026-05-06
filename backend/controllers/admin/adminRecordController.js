import mongoose from "mongoose";
import Record from "../../models/Record.js";
import { notArchivedFilter, isArchivedFilter } from "../../config/recordArchive.js";
import Counselor from "../../models/Counselor.js";
import { createNotification } from "./notificationController.js";
import { createCounselorNotification, createNotificationForAllCounselors } from "../counselorNotificationController.js";
import { logLockAction } from "./recordLockController.js";
import { hmac } from "../../utils/fieldCrypto.js";
import { sanitizeRecordForApi, sanitizeRecordsForApi } from "../../utils/recordApiSanitize.js";

// Helper to get user info from request
const getUserInfo = (req) => {
  const admin = req.admin;
  const user = req.user;
  const userId = admin?._id ?? admin?.id ?? user?._id ?? user?.id;
  return {
    userId,
    userName: admin?.name || user?.name || admin?.email || user?.email || "System",
    userRole: admin?.role || user?.role || "admin",
    userEmail: admin?.email || user?.email || "unknown@example.com",
  };
};

// 📋 Get all records with search, filter, and pagination
export const getAllRecords = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 25,
      search = "",
      sessionType = "",
      status = "",
      counselor = "",
      startDate = "",
      endDate = "",
      sortBy = "date",
      order = "desc",
      archived = "",
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const filter = {};

    // Status filter
    if (status && status !== "all") filter.status = status;
    if (sessionType && sessionType !== "all") filter.sessionType = sessionType;

    // Counselor exact match goes through counselorLookup HMAC.
    if (counselor && counselor !== "all") {
      filter.counselorLookup = hmac(counselor, "name");
    }

    if (startDate && endDate) {
      filter.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const SAFE_SORT_FIELDS = new Set([
      "date",
      "createdAt",
      "updatedAt",
      "status",
      "sessionType",
      "schoolYear",
      "yearLevel",
      "section",
      "college",
      "course",
      "gender",
    ]);
    const sortOption = {};
    if (SAFE_SORT_FIELDS.has(sortBy)) sortOption[sortBy] = order === "desc" ? -1 : 1;
    else sortOption.date = order === "desc" ? -1 : 1;

    const showArchived = archived === "true" || archived === true;
    const archFrag = showArchived ? isArchivedFilter() : notArchivedFilter();
    const listFilter =
      Object.keys(filter).length === 0 ? archFrag : { $and: [filter, archFrag] };

    // Substring search on encrypted clientName/counselor => decrypt-then-filter.
    let records = await Record.find(listFilter).sort(sortOption).lean();
    records = sanitizeRecordsForApi(records);
    if (search && typeof search === "string" && search.trim()) {
      const n = search.trim().toLowerCase();
      records = records.filter(
        (r) =>
          (r.clientName || "").toLowerCase().includes(n) ||
          (r.counselor || "").toLowerCase().includes(n)
      );
    }
    const total = records.length;
    records = records.slice(skip, skip + parseInt(limit));

    // Counselor dropdown options: small set of distinct (decrypted) counselor strings.
    const allCounselors = await Record.find({}).select("counselor").lean();
    const counselors = [
      ...new Set(sanitizeRecordsForApi(allCounselors).map((r) => r.counselor).filter(Boolean)),
    ];

    res.status(200).json({
      records,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalRecords: total,
        limit: parseInt(limit),
      },
      filters: {
        counselors,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching records:", error);
    res.status(500).json({ message: "Failed to fetch records", error: error.message });
  }
};

// 👁️ Get single record by ID
export const getRecordById = async (req, res) => {
  try {
    const { id } = req.params;
    const RecordLock = (await import("../../models/RecordLock.js")).default;
    
    // Clean up expired locks first
    const { cleanupExpiredLocks } = await import("./recordLockController.js");
    await cleanupExpiredLocks();
    
    const record = await Record.findById(id);

    if (!record) {
      return res.status(404).json({ message: "Record not found" });
    }

    // Get lock status
    const lock = await RecordLock.findOne({
      recordId: id,
      isActive: true,
    });

    const recordObj = sanitizeRecordForApi(record);
    
    // Add lock metadata
    if (lock && !lock.isExpired()) {
      recordObj.lock = {
        locked: true,
        lockedBy: {
          userId: lock.lockedBy.userId,
          userName: lock.lockedBy.userName,
          userRole: lock.lockedBy.userRole,
        },
        lockedAt: lock.lockedAt,
        expiresAt: lock.expiresAt,
      };
    } else {
      recordObj.lock = {
        locked: false,
      };
    }

    res.status(200).json(recordObj);
  } catch (error) {
    console.error("❌ Error fetching record:", error);
    res.status(500).json({ message: "Failed to fetch record", error: error.message });
  }
};

// ✏️ Update record (STRICT 2PL: Lock ownership validated by middleware)
export const updateRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const userInfo = getUserInfo(req);

    const record = await Record.findById(id);
    if (!record) {
      return res.status(404).json({ message: "Record not found" });
    }

    if (record.archivedAt) {
      return res.status(403).json({
        success: false,
        message: "This record is archived. Restore it before editing.",
      });
    }

    // STRICT 2PL: Additional lock ownership validation (defense in depth)
    const RecordLock = (await import("../../models/RecordLock.js")).default;
    const { cleanupExpiredLocks } = await import("./recordLockController.js");
    await cleanupExpiredLocks();

    const now = new Date();
    const lock = await RecordLock.findOne({
      recordId: id,
      isActive: true,
      expiresAt: { $gte: now },
    });

    if (lock) {
      const isLockOwner = lock.lockedBy.userId.toString() === userInfo.userId.toString();
      if (!isLockOwner) {
        return res.status(423).json({
          success: false,
          message: `Record is locked by ${lock.lockedBy.userName}. Only the lock owner can update.`,
          lockedBy: {
            userId: lock.lockedBy.userId,
            userName: lock.lockedBy.userName,
            userRole: lock.lockedBy.userRole,
          },
        });
      }
      // Lock ownership validated - lock persists (growing phase of 2PL)
    } else {
      // STRICT 2PL: Record must be locked before editing (but allow if lock was just acquired)
      // Give a small grace period for lock acquisition
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms
      const lockAfterWait = await RecordLock.findOne({
        recordId: id,
        isActive: true,
        expiresAt: { $gte: new Date() },
      });
      
      if (!lockAfterWait) {
        return res.status(423).json({
          success: false,
          message: "Record must be locked before editing. Please lock the record first.",
        });
      }
      
      const isLockOwner = lockAfterWait.lockedBy.userId.toString() === userInfo.userId.toString();
      if (!isLockOwner) {
        return res.status(423).json({
          success: false,
          message: `Record is locked by ${lockAfterWait.lockedBy.userName}. Only the lock owner can update.`,
        });
      }
    }

    // Track changes for audit trail
    const changes = [];
    const updateData = { ...req.body };
    delete updateData.archivedAt;
    delete updateData.archivePurgeAt;
    delete updateData.archivedBy;

    // Compare old and new values
    Object.keys(updateData).forEach((key) => {
      if (key !== "auditTrail" && key !== "attachments" && record[key] !== updateData[key]) {
        changes.push({
          field: key,
          oldValue: record[key],
          newValue: updateData[key],
          changedBy: userInfo,
          changedAt: new Date(),
        });
      }
    });

    // Update record
    Object.assign(record, updateData);

    // Update audit trail (ensure it exists)
    if (!record.auditTrail) {
      record.auditTrail = {
        createdBy: userInfo,
        createdAt: record.createdAt || new Date(),
        lastModifiedBy: userInfo,
        lastModifiedAt: new Date(),
        modificationHistory: [],
      };
    } else {
      record.auditTrail.lastModifiedBy = userInfo;
      record.auditTrail.lastModifiedAt = new Date();
    }
    
    if (changes.length > 0) {
      if (!record.auditTrail.modificationHistory) {
        record.auditTrail.modificationHistory = [];
      }
      record.auditTrail.modificationHistory.push(...changes);
    }

    // Check if counselor was changed (record assigned/reassigned)
    const counselorChanged = changes.find((c) => c.field === "counselor");
    const newCounselorName = updateData.counselor || record.counselor;
    const oldCounselorName = record.counselor;

    // Validate and save record
    try {
      await record.save();
    } catch (saveError) {
      console.error("❌ Error saving record:", saveError);
      console.error("❌ Validation errors:", saveError.errors);
      throw new Error(`Failed to save record: ${saveError.message}`);
    }

    // Log UPDATE action
    try {
      const RecordLock = (await import("../../models/RecordLock.js")).default;
      const currentLock = await RecordLock.findOne({
        recordId: id,
        isActive: true,
        expiresAt: { $gte: new Date() },
      });
      
      await logLockAction(
        id,
        "UPDATE",
        userInfo,
        currentLock?.lockedBy || null,
        `Record updated by ${userInfo.userName} (${userInfo.userRole})`,
        {
          changedFields: changes.map((c) => c.field),
          changeCount: changes.length,
          clientName: record.clientName,
          sessionNumber: record.sessionNumber,
        }
      );
    } catch (logError) {
      console.error("⚠️ Failed to log UPDATE action (non-critical):", logError);
    }

    // Create notification for admins
    try {
      await createNotification({
        title: "Record Updated",
        description: `${userInfo.userName} (${userInfo.userRole}) updated record for client: ${record.clientName} - Session ${record.sessionNumber}`,
        category: "User Activity",
        priority: "medium",
        metadata: {
          clientName: record.clientName,
          recordId: record._id.toString(),
          updatedBy: userInfo.userName,
          updatedByRole: userInfo.userRole,
          changes: changes.map((c) => c.field),
        },
        relatedId: record._id,
        relatedType: "record",
      });
    } catch (notificationError) {
      console.error("⚠️ Admin notification creation failed (non-critical):", notificationError);
    }

    // Create notification for counselor if record was assigned/reassigned
    if (counselorChanged && newCounselorName && newCounselorName !== oldCounselorName) {
      try {
        const lookup = hmac(newCounselorName, "name");
        const emailLookupHmac = hmac(newCounselorName, "email");
        const counselor = await Counselor.findOne({
          $or: [{ nameLookup: lookup }, { emailLookup: emailLookupHmac }],
          role: "counselor",
        });

        if (counselor) {
          await createCounselorNotification({
            counselorId: counselor._id,
            counselorEmail: counselor.email,
            title: "Record Assigned to You",
            description: `Admin ${userInfo.userName} has assigned a record for client ${record.clientName} (Session ${record.sessionNumber}) to you.`,
            category: "Assigned Record",
            priority: "high",
            metadata: {
              clientName: record.clientName,
              recordId: record._id.toString(),
              sessionNumber: record.sessionNumber,
              assignedBy: userInfo.userName,
            },
            relatedId: record._id,
            relatedType: "record",
          });
        }
      } catch (notificationError) {
        console.error("⚠️ Counselor notification creation failed (non-critical):", notificationError);
      }
    } else if (!counselorChanged && newCounselorName) {
      try {
        const lookup = hmac(newCounselorName, "name");
        const emailLookupHmac = hmac(newCounselorName, "email");
        const counselor = await Counselor.findOne({
          $or: [{ nameLookup: lookup }, { emailLookup: emailLookupHmac }],
          role: "counselor",
        });

        if (counselor) {
          await createCounselorNotification({
            counselorId: counselor._id,
            counselorEmail: counselor.email,
            title: "Record Updated",
            description: `Your record for client ${record.clientName} (Session ${record.sessionNumber}) has been updated by admin ${userInfo.userName}.`,
            category: "Updated Record",
            priority: "medium",
            metadata: {
              clientName: record.clientName,
              recordId: record._id.toString(),
              sessionNumber: record.sessionNumber,
              updatedBy: userInfo.userName,
              updatedFields: changes.map((c) => c.field),
            },
            relatedId: record._id,
            relatedType: "record",
          });
        }
      } catch (notificationError) {
        console.error("⚠️ Counselor notification creation failed (non-critical):", notificationError);
      }
    }

    res.status(200).json({
      message: "Record updated successfully",
      record,
    });
  } catch (error) {
    console.error("❌ Error updating record:", error);
    console.error("❌ Error stack:", error.stack);
    console.error("❌ Error details:", {
      recordId: req.params.id,
      userInfo: req.admin || req.user,
      errorMessage: error.message,
      errorName: error.name,
    });
    
    // Return more detailed error in development
    const errorMessage = process.env.NODE_ENV === 'development' 
      ? error.message 
      : "Failed to update record";
    
    res.status(500).json({ 
      success: false,
      message: errorMessage, 
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};

// 📝 Update admin recommendation only (no edit lock required)
export const patchRecordRecommendation = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid record id. Use the record’s database id from the admin records list.",
      });
    }

    const userInfo = getUserInfo(req);
    if (!userInfo.userId) {
      return res.status(401).json({
        success: false,
        message: "Admin identity missing from session. Please sign in again.",
      });
    }

    const raw = req.body?.recommendation;
    const recommendation =
      raw === undefined || raw === null ? "" : String(raw);

    const record = await Record.findById(id);
    if (!record) {
      return res.status(404).json({ success: false, message: "Record not found" });
    }

    const prev = record.recommendation ?? "";
    if (prev === recommendation) {
      return res.status(200).json({
        success: true,
        message: "No change",
        record: sanitizeRecordForApi(record),
      });
    }

    record.recommendation = recommendation;
    const recTrimmed = recommendation.trim();
    record.recommendationAuthorName = recTrimmed
      ? String(userInfo.userName || userInfo.userEmail || "").trim()
      : "";

    const changedBy = {
      userId: userInfo.userId,
      userName: userInfo.userName,
      userRole: userInfo.userRole,
    };

    if (!record.auditTrail) {
      record.auditTrail = {
        createdBy: changedBy,
        createdAt: record.createdAt || new Date(),
        lastModifiedBy: changedBy,
        lastModifiedAt: new Date(),
        modificationHistory: [],
      };
    } else {
      record.auditTrail.lastModifiedBy = changedBy;
      record.auditTrail.lastModifiedAt = new Date();
      if (!record.auditTrail.modificationHistory) {
        record.auditTrail.modificationHistory = [];
      }
      record.auditTrail.modificationHistory.push({
        field: "recommendation",
        oldValue: prev,
        newValue: recommendation,
        changedBy,
        changedAt: new Date(),
      });
    }

    await record.save();

    res.status(200).json({
      success: true,
      message: "Recommendation saved",
      record: sanitizeRecordForApi(record),
    });
  } catch (error) {
    console.error("❌ Error saving recommendation:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save recommendation",
      error: error.message,
    });
  }
};

// 🗑️ Delete record
export const deleteRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const userInfo = getUserInfo(req);

    const record = await Record.findById(id);
    if (!record) {
      return res.status(404).json({ message: "Record not found" });
    }

    // Update audit trail before deletion
    record.auditTrail.deletedBy = userInfo;
    record.auditTrail.deletedAt = new Date();
    await record.save();

    // Delete record
    await Record.findByIdAndDelete(id);

    // Create notification
    try {
      await createNotification({
        title: "Record Deleted",
        description: `${userInfo.userName} (${userInfo.userRole}) deleted record for client: ${record.clientName} - Session ${record.sessionNumber}`,
        category: "User Activity",
        priority: "high",
        metadata: {
          clientName: record.clientName,
          recordId: id,
          deletedBy: userInfo.userName,
          deletedByRole: userInfo.userRole,
        },
        relatedType: "record",
      });
    } catch (notificationError) {
      console.error("⚠️ Notification creation failed (non-critical):", notificationError);
    }

    res.status(200).json({
      message: "Record deleted successfully",
      recordId: id,
    });
  } catch (error) {
    console.error("❌ Error deleting record:", error);
    res.status(500).json({ message: "Failed to delete record", error: error.message });
  }
};

