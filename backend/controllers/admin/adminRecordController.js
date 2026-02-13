import Record from "../../models/Record.js";
import User from "../../models/User.js";
import { createNotification } from "./notificationController.js";
import { createCounselorNotification, createNotificationForAllCounselors } from "../counselorNotificationController.js";
import { logLockAction } from "./recordLockController.js";

// Helper to get user info from request
const getUserInfo = (req) => {
  return {
    userId: req.admin?._id || req.user?._id,
    userName: req.admin?.name || req.user?.name || req.admin?.email || req.user?.email || "System",
    userRole: req.admin?.role || req.user?.role || "admin",
    userEmail: req.admin?.email || req.user?.email || "unknown@example.com",
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
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const filter = {};

    // Search filter (client name or counselor)
    if (search) {
      filter.$or = [
        { clientName: { $regex: search, $options: "i" } },
        { counselor: { $regex: search, $options: "i" } },
      ];
    }

    // Status filter
    if (status && status !== "all") {
      filter.status = status;
    }

    // Session type filter
    if (sessionType && sessionType !== "all") {
      filter.sessionType = sessionType;
    }

    // Counselor filter
    if (counselor && counselor !== "all") {
      filter.counselor = counselor;
    }

    // Date range filter
    if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // Sort options
    const sortOption = {};
    sortOption[sortBy] = order === "desc" ? -1 : 1;

    // Get records with pagination
    const records = await Record.find(filter)
      .sort(sortOption)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count
    const total = await Record.countDocuments(filter);

    // Get unique counselors for filter dropdown
    const counselors = await Record.distinct("counselor");

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

    const recordObj = record.toObject();
    
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
        // Find counselor by name or email
        const counselor = await User.findOne({
          $or: [
            { name: newCounselorName },
            { email: newCounselorName },
          ],
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
      // Record was updated but counselor didn't change - notify the counselor
      try {
        const counselor = await User.findOne({
          $or: [
            { name: newCounselorName },
            { email: newCounselorName },
          ],
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

