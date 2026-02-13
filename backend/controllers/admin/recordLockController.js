import Record from "../../models/Record.js";
import RecordLock from "../../models/RecordLock.js";
import LockAuditLog from "../../models/LockAuditLog.js";
import { createNotification } from "./notificationController.js";
import { createCounselorNotification } from "../counselorNotificationController.js";
import Admin from "../../models/Admin.js";
import User from "../../models/User.js";

/**
 * Helper to get user info from request
 */
const getUserInfo = (req) => {
  const isAdmin = !!req.admin;
  if (isAdmin && !req.admin) {
    throw new Error("Admin information not found in request");
  }
  if (!isAdmin && !req.user) {
    throw new Error("User information not found in request");
  }
  return {
    userId: isAdmin ? req.admin._id : req.user._id,
    userName: isAdmin ? req.admin.name : req.user.name,
    userRole: isAdmin ? "admin" : "counselor",
    userEmail: isAdmin ? req.admin.email : req.user.email,
  };
};

/**
 * Helper to log lock action
 */
export const logLockAction = async (recordId, action, performedBy, lockOwner = null, reason = null, metadata = {}) => {
  try {
    await LockAuditLog.create({
      recordId,
      action,
      performedBy,
      lockOwner,
      reason,
      metadata,
    });
  } catch (error) {
    console.error("Error logging lock action:", error);
    // Don't throw - logging failure shouldn't break the operation
  }
};

/**
 * Clean up expired locks (can be called periodically)
 */
export const cleanupExpiredLocks = async () => {
  try {
    const expiredLocks = await RecordLock.find({
      isActive: true,
      expiresAt: { $lt: new Date() },
    });

    for (const lock of expiredLocks) {
      // Log the expiration before deleting
      await logLockAction(
        lock.recordId,
        "LOCK_EXPIRED",
        {
          userId: lock.lockedBy.userId,
          userName: lock.lockedBy.userName,
          userRole: lock.lockedBy.userRole,
          userEmail: lock.lockedBy.userEmail,
        },
        lock.lockedBy,
        "Lock expired after 24 hours"
      );
      
      // Delete expired locks instead of marking inactive to prevent duplicate key errors
      await RecordLock.deleteOne({ _id: lock._id });
    }

    return expiredLocks.length;
  } catch (error) {
    console.error("Error cleaning up expired locks:", error);
    throw error;
  }
};

/**
 * Check if user can lock a record
 * - Any authenticated user (admin or counselor) can lock any record
 * - This allows strict 2PL where any user can acquire a lock for editing
 */
const canUserLockRecord = async (userInfo, record) => {
  // Any authenticated user can lock any record (for strict 2PL)
  if (userInfo.userRole === "admin" || userInfo.userRole === "counselor") {
    return { canLock: true };
  }

  return { canLock: false, reason: "Unauthorized to lock records." };
};

/**
 * Lock a record (Admin or Counselor) - Strict 2PL with atomic conditional update
 * POST /api/admin/records/:id/lock
 * POST /api/records/:id/lock
 * 
 * Uses atomic conditional update to ensure only one user can acquire the lock at a time.
 * This implements strict Two-Phase Locking (2PL) where locks are acquired atomically.
 */
export const lockRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const userInfo = getUserInfo(req);

    // Find the record
    const record = await Record.findById(id);
    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Record not found.",
      });
    }

    // Check if user can lock this record
    const lockPermission = await canUserLockRecord(userInfo, record);
    if (!lockPermission.canLock) {
      await logLockAction(
        id,
        "LOCK_ATTEMPT_BLOCKED",
        userInfo,
        null,
        lockPermission.reason
      );
      return res.status(403).json({
        success: false,
        message: lockPermission.reason,
      });
    }

    // Clean up expired locks first
    await cleanupExpiredLocks();

    // ATOMIC CONDITIONAL UPDATE: Only acquire lock if no active lock exists or lock is expired
    // This ensures strict 2PL - only one user can hold the lock at any time
    const now = new Date();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // First, check if there's an existing active lock
    const existingActiveLock = await RecordLock.findOne({
      recordId: id,
      isActive: true,
      expiresAt: { $gte: now },
    });

    if (existingActiveLock) {
      const isLockOwner = existingActiveLock.lockedBy.userId.toString() === userInfo.userId.toString();
      
      if (!isLockOwner) {
        // Another user holds the lock
        const lockOwner = existingActiveLock.lockedBy;
        await logLockAction(
          id,
          "LOCK_ATTEMPT_BLOCKED",
          userInfo,
          lockOwner,
          `Record is currently locked by ${lockOwner.userName}.`
        );

        return res.status(423).json({
          success: false,
          message: `Record is currently locked by ${lockOwner.userName}. Only one user can edit at a time.`,
          lockedBy: {
            userId: lockOwner.userId,
            userName: lockOwner.userName,
            userRole: lockOwner.userRole,
          },
          lockedAt: existingActiveLock.lockedAt,
        });
      }
      // User already owns the lock - return success (refresh expiration)
      existingActiveLock.expiresAt = expiresAt;
      await existingActiveLock.save();
      var lock = existingActiveLock;
    } else {
      // No active lock - try to acquire lock atomically using conditional update
      // Condition: No lock exists OR existing lock is expired OR existing lock is inactive
      var lock = await RecordLock.findOneAndUpdate(
        {
          recordId: id,
          $or: [
            { isActive: { $ne: true } }, // No active lock
            { expiresAt: { $lt: now } }, // Lock expired
            { isActive: false }, // Lock inactive
          ],
        },
        {
          $set: {
            recordId: id,
            lockedBy: userInfo,
            lockedAt: now,
            expiresAt: expiresAt,
            isActive: true,
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }
      );

      // Double-check: if another user acquired the lock between our check and update
      const verifyLock = await RecordLock.findOne({
        recordId: id,
        isActive: true,
        expiresAt: { $gte: now },
      });

      if (verifyLock && verifyLock.lockedBy.userId.toString() !== userInfo.userId.toString()) {
        // Race condition: another user got the lock
        const lockOwner = verifyLock.lockedBy;
        await logLockAction(
          id,
          "LOCK_ATTEMPT_BLOCKED",
          userInfo,
          lockOwner,
          `Record is currently locked by ${lockOwner.userName}.`
        );

        return res.status(423).json({
          success: false,
          message: `Record is currently locked by ${lockOwner.userName}. Only one user can edit at a time.`,
          lockedBy: {
            userId: lockOwner.userId,
            userName: lockOwner.userName,
            userRole: lockOwner.userRole,
          },
          lockedAt: verifyLock.lockedAt,
        });
      }
    }

    // Log the lock action
    await logLockAction(id, "LOCK", userInfo, userInfo);

    // Send notification
    try {
      if (userInfo.userRole === "admin") {
        // Find and notify the counselor who created the record
        let counselorUser = null;
        
        // Try to find counselor by userId from auditTrail
        if (record.auditTrail?.createdBy?.userId) {
          counselorUser = await User.findById(record.auditTrail.createdBy.userId);
        }
        
        // If not found by userId, try to find by counselor name
        if (!counselorUser && record.counselor) {
          counselorUser = await User.findOne({ 
            $or: [
              { name: record.counselor },
              { email: record.counselor }
            ],
            role: "counselor"
          });
        }
        
        // Send notification to the counselor if found
        if (counselorUser) {
          await createCounselorNotification({
            counselorId: counselorUser._id,
            counselorEmail: counselorUser.email,
            title: "Record Locked by Admin",
            description: `Your record for client "${record.clientName} - Session ${record.sessionNumber}" has been locked by Admin ${userInfo.userName}. Editing is temporarily restricted until the lock is released.`,
            category: "System Alert",
            priority: "high",
            metadata: {
              recordId: record._id.toString(),
              clientName: record.clientName,
              sessionNumber: record.sessionNumber,
              lockedBy: userInfo.userName,
              lockedByRole: "admin",
              action: "LOCK",
            },
            relatedId: record._id,
            relatedType: "record",
          });
        }
        
        // Also notify all admins (existing behavior)
        const admins = await Admin.find({});
        for (const admin of admins) {
          await createNotification({
            title: "Record Locked",
            description: `Admin ${userInfo.userName} has locked record "${record.clientName} - Session ${record.sessionNumber}".`,
            category: "User Activity",
            priority: "low",
            metadata: {
              recordId: record._id.toString(),
              clientName: record.clientName,
              sessionNumber: record.sessionNumber,
              lockedBy: userInfo.userName,
            },
            relatedId: record._id,
            relatedType: "record",
          });
        }
      } else {
        // Counselor locked their own record - notify admins
        const admins = await Admin.find({});
        for (const admin of admins) {
          await createNotification({
            title: "Record Locked",
            description: `Record "${record.clientName} - Session ${record.sessionNumber}" has been locked by Counselor ${userInfo.userName}.`,
            category: "User Activity",
            priority: "low",
            metadata: {
              recordId: record._id.toString(),
              clientName: record.clientName,
              sessionNumber: record.sessionNumber,
              lockedBy: userInfo.userName,
            },
            relatedId: record._id,
            relatedType: "record",
          });
        }
      }
    } catch (notifError) {
      console.error("Error sending notification:", notifError);
      // Don't fail the lock operation if notification fails
    }

    return res.status(200).json({
      success: true,
      message: "Record locked successfully.",
      lock: {
        recordId: lock.recordId,
        lockedBy: lock.lockedBy,
        lockedAt: lock.lockedAt,
        expiresAt: lock.expiresAt,
      },
    });
  } catch (error) {
    console.error("Error locking record:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to lock record.",
      error: error.message,
    });
  }
};

/**
 * Unlock a record (only by lock owner)
 * POST /api/admin/records/:id/unlock
 * POST /api/records/:id/unlock
 */
export const unlockRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const userInfo = getUserInfo(req);

    // Find the record
    const record = await Record.findById(id);
    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Record not found.",
      });
    }

    // Find the lock
    const lock = await RecordLock.findOne({
      recordId: id,
      isActive: true,
    });

    if (!lock) {
      return res.status(200).json({
        success: true,
        message: "Record is not currently locked.",
        locked: false,
      });
    }

    // Check if user is the lock owner
    const isLockOwner = lock.lockedBy.userId.toString() === userInfo.userId.toString();
    if (!isLockOwner) {
      await logLockAction(
        id,
        "UNLOCK",
        userInfo,
        lock.lockedBy,
        `Attempted to unlock record locked by ${lock.lockedBy.userName}.`
      );
      return res.status(403).json({
        success: false,
        message: `You cannot unlock this record. It is locked by ${lock.lockedBy.userName}.`,
      });
    }

    // Delete the lock document (cleaner than just marking inactive)
    await RecordLock.deleteOne({ _id: lock._id });

    // Log the unlock action
    await logLockAction(id, "UNLOCK", userInfo, lock.lockedBy);

    // Send notification
    try {
      if (userInfo.userRole === "admin") {
        // Find and notify the counselor who created the record
        let counselorUser = null;
        
        // Try to find counselor by userId from auditTrail
        if (record.auditTrail?.createdBy?.userId) {
          counselorUser = await User.findById(record.auditTrail.createdBy.userId);
        }
        
        // If not found by userId, try to find by counselor name
        if (!counselorUser && record.counselor) {
          counselorUser = await User.findOne({ 
            $or: [
              { name: record.counselor },
              { email: record.counselor }
            ],
            role: "counselor"
          });
        }
        
        // Send notification to the counselor if found
        if (counselorUser) {
          await createCounselorNotification({
            counselorId: counselorUser._id,
            counselorEmail: counselorUser.email,
            title: "Record Unlocked by Admin",
            description: `Your record for client "${record.clientName} - Session ${record.sessionNumber}" has been unlocked by Admin ${userInfo.userName}. You can now edit the record.`,
            category: "System Alert",
            priority: "medium",
            metadata: {
              recordId: record._id.toString(),
              clientName: record.clientName,
              sessionNumber: record.sessionNumber,
              unlockedBy: userInfo.userName,
              unlockedByRole: "admin",
              action: "UNLOCK",
            },
            relatedId: record._id,
            relatedType: "record",
          });
        }
        
        // Also notify all admins (existing behavior)
        const admins = await Admin.find({});
        for (const admin of admins) {
          await createNotification({
            title: "Record Unlocked",
            description: `Admin ${userInfo.userName} has unlocked record "${record.clientName} - Session ${record.sessionNumber}".`,
            category: "User Activity",
            priority: "low",
            metadata: {
              recordId: record._id.toString(),
              clientName: record.clientName,
              sessionNumber: record.sessionNumber,
              unlockedBy: userInfo.userName,
            },
            relatedId: record._id,
            relatedType: "record",
          });
        }
      } else {
        // Counselor unlocked their own record - notify admins
        const admins = await Admin.find({});
        for (const admin of admins) {
          await createNotification({
            title: "Record Unlocked",
            description: `Record "${record.clientName} - Session ${record.sessionNumber}" has been unlocked by Counselor ${userInfo.userName}.`,
            category: "User Activity",
            priority: "low",
            metadata: {
              recordId: record._id.toString(),
              clientName: record.clientName,
              sessionNumber: record.sessionNumber,
              unlockedBy: userInfo.userName,
            },
            relatedId: record._id,
            relatedType: "record",
          });
        }
      }
    } catch (notifError) {
      console.error("Error sending notification:", notifError);
      // Don't fail the unlock operation if notification fails
    }

    return res.status(200).json({
      success: true,
      message: "Record unlocked successfully.",
      locked: false,
    });
  } catch (error) {
    console.error("Error unlocking record:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to unlock record.",
      error: error.message,
    });
  }
};

/**
 * Auto-lock record when editing starts (STRICT 2PL)
 * POST /api/admin/records/:id/start-editing
 * POST /api/records/:id/start-editing
 * 
 * Automatically acquires lock when user opens record for editing.
 * This implements the growing phase of strict 2PL.
 */
export const startEditing = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Record ID is required.",
      });
    }
    
    // Validate user authentication
    if (!req.admin && !req.user) {
      console.error("❌ startEditing: No admin or user found in request");
      return res.status(401).json({
        success: false,
        message: "Authentication required. Please log in.",
      });
    }

    let userInfo;
    try {
      userInfo = getUserInfo(req);
    } catch (userInfoError) {
      console.error("❌ startEditing: Error getting user info:", userInfoError);
      return res.status(401).json({
        success: false,
        message: userInfoError.message || "Authentication error.",
      });
    }

    if (!userInfo || !userInfo.userId) {
      console.error("❌ startEditing: Invalid user info:", userInfo);
      return res.status(401).json({
        success: false,
        message: "Invalid user information.",
      });
    }

    // Find the record
    const record = await Record.findById(id);
    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Record not found.",
      });
    }

    // Check if user can lock this record
    let lockPermission;
    try {
      lockPermission = await canUserLockRecord(userInfo, record);
    } catch (permError) {
      console.error("❌ startEditing: Error checking lock permission:", permError);
      return res.status(500).json({
        success: false,
        message: "Error checking lock permissions.",
      });
    }

    if (!lockPermission.canLock) {
      await logLockAction(
        id,
        "LOCK_ATTEMPT_BLOCKED",
        userInfo,
        null,
        lockPermission.reason
      );
      return res.status(403).json({
        success: false,
        message: lockPermission.reason,
      });
    }

    // Clean up expired locks first
    try {
      await cleanupExpiredLocks();
    } catch (cleanupError) {
      console.error("❌ startEditing: Error cleaning up expired locks:", cleanupError);
      // Continue anyway - cleanup failure shouldn't block lock acquisition
    }

    // ATOMIC CONDITIONAL UPDATE: Only acquire lock if no active lock exists
    const now = new Date();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Check if there's an existing active lock
    const existingActiveLock = await RecordLock.findOne({
      recordId: id,
      isActive: true,
      expiresAt: { $gte: now },
    });

    if (existingActiveLock) {
      const isLockOwner = existingActiveLock.lockedBy.userId.toString() === userInfo.userId.toString();
      
      if (!isLockOwner) {
        // Another user holds the lock
        const lockOwner = existingActiveLock.lockedBy;
        await logLockAction(
          id,
          "LOCK_ATTEMPT_BLOCKED",
          userInfo,
          lockOwner,
          `Edit attempt blocked - record locked by ${lockOwner.userName}.`
        );

        return res.status(423).json({
          success: false,
          message: `Record is currently locked by ${lockOwner.userName}. You cannot edit this record.`,
          lockedBy: {
            userId: lockOwner.userId,
            userName: lockOwner.userName,
            userRole: lockOwner.userRole,
          },
          lockedAt: existingActiveLock.lockedAt,
        });
      }
      // User already owns the lock - refresh expiration
      existingActiveLock.expiresAt = expiresAt;
      await existingActiveLock.save();
      var lock = existingActiveLock;
    } else {
      // No active lock - try to acquire lock atomically
      // First, delete any expired or inactive locks
      await RecordLock.deleteMany({
        recordId: id,
        $or: [
          { isActive: false },
          { expiresAt: { $lt: now } },
        ],
      });

      // Now try to create/update the lock atomically
      var lock = await RecordLock.findOneAndUpdate(
        {
          recordId: id,
        },
        {
          $set: {
            recordId: id,
            lockedBy: userInfo,
            lockedAt: now,
            expiresAt: expiresAt,
            isActive: true,
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }
      );

      // Verify lock ownership (race condition check)
      const verifyLock = await RecordLock.findOne({
        recordId: id,
        isActive: true,
        expiresAt: { $gte: now },
      });

      if (verifyLock && verifyLock.lockedBy.userId.toString() !== userInfo.userId.toString()) {
        const lockOwner = verifyLock.lockedBy;
        await logLockAction(
          id,
          "LOCK_ATTEMPT_BLOCKED",
          userInfo,
          lockOwner,
          `Edit attempt blocked - record locked by ${lockOwner.userName}.`
        );

        return res.status(423).json({
          success: false,
          message: `Record is currently locked by ${lockOwner.userName}. You cannot edit this record.`,
          lockedBy: {
            userId: lockOwner.userId,
            userName: lockOwner.userName,
            userRole: lockOwner.userRole,
          },
          lockedAt: verifyLock.lockedAt,
        });
      }
    }

    // Verify lock was created/updated successfully
    if (!lock) {
      console.error("❌ startEditing: Lock was not created/updated");
      return res.status(500).json({
        success: false,
        message: "Failed to acquire lock. Please try again.",
      });
    }

    // Log the lock action
    try {
      await logLockAction(id, "LOCK", userInfo, userInfo, "Auto-locked when editing started");
    } catch (logError) {
      console.error("❌ startEditing: Error logging lock action:", logError);
      // Continue anyway - logging failure shouldn't block the operation
    }

    return res.status(200).json({
      success: true,
      message: "Record locked for editing. Lock will persist until you explicitly unlock it.",
      lock: {
        recordId: lock.recordId,
        lockedBy: lock.lockedBy,
        lockedAt: lock.lockedAt,
        expiresAt: lock.expiresAt,
      },
    });
  } catch (error) {
    console.error("Error starting edit session:", error);
    console.error("Error stack:", error.stack);
    
    // Provide more specific error messages
    if (error.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }
    
    if (error.message.includes("Authentication") || error.message.includes("not found in request")) {
      return res.status(401).json({
        success: false,
        message: error.message || "Authentication required.",
      });
    }
    
    return res.status(500).json({
      success: false,
      message: "Failed to start editing session.",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get lock status for a record
 * GET /api/admin/records/:id/lock-status
 * GET /api/records/:id/lock-status
 */
export const getLockStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const userInfo = getUserInfo(req);

    // Clean up expired locks first
    await cleanupExpiredLocks();

    // Find the record
    const record = await Record.findById(id);
    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Record not found.",
      });
    }

    // Find active lock
    const lock = await RecordLock.findOne({
      recordId: id,
      isActive: true,
    });

    if (!lock || lock.isExpired()) {
      return res.status(200).json({
        success: true,
        locked: false,
        canLock: true,
        canUnlock: false,
      });
    }

    // Check if current user is the lock owner
    const isLockOwner = lock.lockedBy.userId.toString() === userInfo.userId.toString();

    return res.status(200).json({
      success: true,
      locked: true,
      lockedBy: {
        userId: lock.lockedBy.userId,
        userName: lock.lockedBy.userName,
        userRole: lock.lockedBy.userRole,
      },
      lockedAt: lock.lockedAt,
      expiresAt: lock.expiresAt,
      canLock: false,
      canUnlock: isLockOwner,
      isLockOwner,
    });
  } catch (error) {
    console.error("Error getting lock status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get lock status.",
      error: error.message,
    });
  }
};

/**
 * Get lock audit logs for a record
 * GET /api/admin/records/:id/lock-logs
 * GET /api/records/:id/lock-logs
 */
export const getLockLogs = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50 } = req.query;

    // Verify record exists
    const record = await Record.findById(id);
    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Record not found.",
      });
    }

    // Get lock logs
    const logs = await LockAuditLog.find({ recordId: id })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    return res.status(200).json({
      success: true,
      logs: logs.map((log) => ({
        action: log.action,
        performedBy: log.performedBy,
        lockOwner: log.lockOwner,
        reason: log.reason,
        timestamp: log.createdAt,
        metadata: log.metadata,
      })),
    });
  } catch (error) {
    console.error("Error getting lock logs:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get lock logs.",
      error: error.message,
    });
  }
};

/**
 * Middleware to check if record is locked before allowing updates
 * STRICT 2PL: Only lock owner can update. Lock is NOT released after save.
 * Returns 423 if locked by another user
 */
export const checkLockBeforeUpdate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userInfo = getUserInfo(req);

    console.log(`🔍 checkLockBeforeUpdate: Checking lock for record ${id} by user ${userInfo.userId}`);

    // Clean up expired locks
    await cleanupExpiredLocks();

    // Find active, non-expired lock
    let now = new Date();
    let lock = await RecordLock.findOne({
      recordId: id,
      isActive: true,
      expiresAt: { $gte: now },
    });

    console.log(`🔍 checkLockBeforeUpdate: Initial lock check result:`, lock ? `Found lock by ${lock.lockedBy.userId}` : 'No lock found');

    // If no lock found, wait a bit and check again (grace period for lock acquisition)
    if (!lock) {
      console.log(`🔍 checkLockBeforeUpdate: No lock found, waiting 200ms and rechecking...`);
      await new Promise(resolve => setTimeout(resolve, 200)); // Wait 200ms
      now = new Date();
      lock = await RecordLock.findOne({
        recordId: id,
        isActive: true,
        expiresAt: { $gte: now },
      });
      console.log(`🔍 checkLockBeforeUpdate: After wait, lock check result:`, lock ? `Found lock by ${lock.lockedBy.userId}` : 'No lock found');
    }

    if (!lock) {
      // No active lock - STRICT 2PL: Record must be locked before editing
      console.error(`❌ checkLockBeforeUpdate: No lock found for record ${id}`);
      await logLockAction(
        id,
        "EDIT_ATTEMPT_BLOCKED",
        userInfo,
        null,
        "Edit attempt blocked - record must be locked before editing (strict 2PL)."
      );

      return res.status(423).json({
        success: false,
        message: "Record must be locked before editing. Please lock the record first.",
      });
    }

    // STRICT 2PL: Validate lock ownership - only lock owner can update
    const isLockOwner = lock.lockedBy.userId.toString() === userInfo.userId.toString();
    console.log(`🔍 checkLockBeforeUpdate: Lock owner check - Lock owner: ${lock.lockedBy.userId}, Current user: ${userInfo.userId}, Is owner: ${isLockOwner}`);

    if (!isLockOwner) {
      // Log blocked edit attempt
      console.error(`❌ checkLockBeforeUpdate: User ${userInfo.userId} is not lock owner. Lock owned by ${lock.lockedBy.userId}`);
      await logLockAction(
        id,
        "EDIT_ATTEMPT_BLOCKED",
        userInfo,
        lock.lockedBy,
        `Edit attempt blocked - record locked by ${lock.lockedBy.userName}.`
      );

      return res.status(423).json({
        success: false,
        message: `Record is locked by ${lock.lockedBy.userName}. Only the lock owner can edit.`,
        lockedBy: {
          userId: lock.lockedBy.userId,
          userName: lock.lockedBy.userName,
          userRole: lock.lockedBy.userRole,
        },
        lockedAt: lock.lockedAt,
      });
    }

    // User owns the lock - allow update (lock persists through growing phase)
    console.log(`✅ checkLockBeforeUpdate: Lock validated, allowing update`);
    next();
  } catch (error) {
    console.error("❌ Error checking lock:", error);
    console.error("❌ Error stack:", error.stack);
    return res.status(500).json({
      success: false,
      message: "Failed to verify record lock status.",
      error: error.message,
    });
  }
};

/**
 * Get all recent lock/unlock/update logs across all records
 */
export const getAllLockLogs = async (req, res) => {
  try {
    const { limit = 50, action } = req.query;
    
    console.log("🔍 getAllLockLogs called with limit:", limit, "action:", action);
    
    // Build query - include LOCK, UNLOCK, and UPDATE actions
    const query = {
      action: { $in: ["LOCK", "UNLOCK", "UPDATE"] }
    };
    
    // If specific action is requested, filter by it
    if (action && ["LOCK", "UNLOCK", "UPDATE"].includes(action)) {
      query.action = action;
    }

    // Get lock logs with record information
    const logs = await LockAuditLog.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();
    
    console.log(`📊 Found ${logs.length} lock logs`);

    // Populate record information separately to handle null recordIds
    const logsWithRecords = await Promise.all(
      logs.map(async (log) => {
        let recordInfo = null;
        if (log.recordId) {
          try {
            const record = await Record.findById(log.recordId).select("clientName sessionNumber").lean();
            if (record) {
              recordInfo = {
                id: record._id,
                clientName: record.clientName || "Unknown",
                sessionNumber: record.sessionNumber || "N/A",
              };
            }
          } catch (err) {
            console.error(`Error fetching record ${log.recordId}:`, err);
          }
        }
        
        return {
          id: log._id,
          action: log.action,
          performedBy: log.performedBy,
          lockOwner: log.lockOwner,
          reason: log.reason,
          timestamp: log.createdAt,
          metadata: log.metadata ? (log.metadata instanceof Map ? Object.fromEntries(log.metadata) : log.metadata) : {},
          record: recordInfo,
        };
      })
    );

    return res.status(200).json({
      success: true,
      logs: logsWithRecords,
    });
  } catch (error) {
    console.error("Error getting all lock logs:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get lock logs.",
      error: error.message,
    });
  }
};

